/**
 * Chat streaming route — Vercel AI SDK UI Message Stream.
 *
 * Server is authoritative on history: the client sends ONLY the last
 * `UIMessage` (+ context fields); the backend reassembles system prompt +
 * history and streams the response as the standard AI SDK UI Message
 * Stream protocol (`createUIMessageStream`/`createUIMessageStreamResponse`).
 * Guards (quota, concurrency, sanitisation) run BEFORE the stream starts and
 * stay plain JSON responses, except on a distress, which gets the fixed reply.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { TurnUsage } from './turn-usage.js';
import { requireUser, validate, type AppEnv } from '../../platform/http/context.js';
import { createRateLimitMiddleware, RateLimitPresets } from '../../platform/http/rate-limit.js';
import { chatOrchestrationService, ChatOrchestrationError } from './chat-orchestration.service.js';
import { runControlledTurn, type ControlledTurn } from './controlled-turn.js';
import type { OutputCheckContext } from './output-check.js';
import type { DistressTurn } from './chat-turn.types.js';
import { DISTRESS_REPLY } from './distress.js';
import { answerDistress } from './distress.service.js';
import { buildChatTools } from './chat-tools.js';
import { extractTextFromParts, sanitizePrompt, type TomChatMessage } from './chat-ui-message.js';
import { checkQuota } from '../billing/index.js';
import { AppError, toErrorResponse } from '../../platform/http/errors.js';
import { logger } from '../../platform/observability/logger.js';
import { env } from '../../platform/config/env.js';
import { educationLevelSchema, isEducationLevel } from '../../lib/education-levels.js';
import { SUBJECT_SLUGS } from '../../lib/subjects.js';

// Track active UI message streams per user
const activeStreams = new Map<string, number>();
const MAX_CONCURRENT_STREAMS = 2;

const streamBody = z.object({
  // Last UIMessage sent by the client (AI SDK UI Message format); the server rebuilds full history from DB.
  message: z.looseObject({}),
  sessionId: z.uuid().optional(),
  subject: z.enum(SUBJECT_SLUGS).optional(),
  schoolLevel: educationLevelSchema.optional(),
  firstName: z.string().min(1).max(50).optional(),
  fileIds: z.array(z.string().min(20).max(100)).max(5).optional(),
  // Input channel declared by the user gesture (mic vs keyboard); never inferred by the model. Defaults to text.
  inputMode: z.enum(['text', 'voice']).optional(),
});

const aiRateLimit = createRateLimitMiddleware(RateLimitPresets.ai);

/** The fixed reply streamed. A turn that could not be stored is logged, never kept from the student. */
async function distressResponse(turn: DistressTurn, params: { userId: string; requestId: string; content: string; inputMode?: 'text' | 'voice' | undefined }): Promise<Response> {
  try {
    await answerDistress({ turn, userId: params.userId, content: params.content, inputMode: params.inputMode });
  } catch (error) {
    logger.error('Distress turn not stored', {
      err: error,
      userId: params.userId,
      sessionId: turn.sessionId,
      requestId: params.requestId,
      operation: 'distress:store-error',
      severity: 'critical' as const,
    });
  }
  return createUIMessageStreamResponse({
    stream: createUIMessageStream<TomChatMessage>({
      execute: ({ writer }) => {
        writer.write({ type: 'text-start', id: 'distress' });
        writer.write({ type: 'text-delta', id: 'distress', delta: DISTRESS_REPLY });
        writer.write({ type: 'text-end', id: 'distress' });
      },
    }),
  });
}

// Mounted under /api/chat by app.ts. The ai rate limit keys by user id, so it
// runs after requireUser.
export const chatMessageRoutes = new Hono<AppEnv>()
  .post('/stream', requireUser, aiRateLimit, validate('json', streamBody), async (c) => {
    const user = c.var.user;
    const requestId = c.var.requestId;
    const body = c.req.valid('json');
    const { message, sessionId, subject, schoolLevel, firstName, fileIds: fileIdsBody, inputMode } = body;

    const fileIds = fileIdsBody ?? [];
    const safeContent = sanitizePrompt(extractTextFromParts((message as { parts?: unknown } | null)?.parts));
    const turnParams = { userId: user.id, requestId, content: safeContent, inputMode };

    // A refused request still gets the fixed reply on a distress: it calls no model.
    const unlessDistress = async (refusal: Response): Promise<Response> => {
      try {
        const turn = await chatOrchestrationService.screenDistress({ userId: user.id, sessionId, content: safeContent });
        return turn ? await distressResponse(turn, turnParams) : refusal;
      } catch (error) {
        if (!(error instanceof ChatOrchestrationError)) {
          logger.error('Distress screening failed on a refused request', { err: error, userId: user.id, requestId, operation: 'distress:screen-error', severity: 'high' as const });
        }
        return refusal;
      }
    };

    // 1. Quota check
    const quotaCheck = await checkQuota(user.id);
    if (!quotaCheck.allowed) {
      return unlessDistress(c.json({
        ...toErrorResponse(new AppError('QUOTA_EXCEEDED'), requestId),
        ...(quotaCheck.usage && { usage: { usagePercent: quotaCheck.usage.usagePercent, resetsIn: quotaCheck.usage.resetsIn, plan: quotaCheck.usage.plan } }),
      }, 429));
    }

    // 2. Content validation
    if (safeContent.trim().length === 0 && fileIds.length === 0) {
      return c.json(toErrorResponse(new AppError('EMPTY_MESSAGE'), requestId), 400);
    }

    // 3. Concurrent stream limit
    const currentStreams = activeStreams.get(user.id) ?? 0;
    if (currentStreams >= MAX_CONCURRENT_STREAMS) {
      return unlessDistress(c.json(toErrorResponse(new AppError('CONCURRENT_STREAM'), requestId), 409));
    }
    activeStreams.set(user.id, currentStreams + 1);

    let released = false;
    const releaseStream = () => {
      if (released) return;
      released = true;
      const count = activeStreams.get(user.id) ?? 1;
      if (count <= 1) activeStreams.delete(user.id);
      else activeStreams.set(user.id, count - 1);
    };

    const resolvedSchoolLevel = schoolLevel ?? (isEducationLevel(user.schoolLevel) ? user.schoolLevel : 'sixieme');

    let turnCtx: Awaited<ReturnType<typeof chatOrchestrationService.prepareTurn>>;
    try {
      turnCtx = await chatOrchestrationService.prepareTurn({
        userId: user.id,
        sessionId,
        requestedSubject: subject,
        content: safeContent,
        fileIds,
        schoolLevel: resolvedSchoolLevel,
        flashcards: quotaCheck.plan === 'premium',
      });
      if (turnCtx.kind === 'tutor') {
        await chatOrchestrationService.persistUserTurn({
          sessionId: turnCtx.sessionId,
          content: safeContent,
          inputMode,
          fileIds: turnCtx.fileIds,
          attachedFileInfo: turnCtx.attachedFileInfo,
          attachedFileInfos: turnCtx.attachedFileInfos,
          inputModeration: turnCtx.inputModeration,
        });
      }
    } catch (error) {
      releaseStream();
      if (error instanceof ChatOrchestrationError) {
        const code = error.statusCode === 403 ? ('FORBIDDEN' as const) : ('SESSION_NOT_FOUND' as const);
        const appError = new AppError(code, error.message);
        return c.json(toErrorResponse(appError, requestId), appError.statusCode);
      }
      logger.error('Chat turn setup failed', {
        err: error,
        userId: user.id,
        requestId,
        operation: 'chat-stream:setup-error',
        severity: 'high' as const,
      });
      return c.json(toErrorResponse(new AppError('INTERNAL_ERROR'), requestId), 500);
    }

    // A distress gets the fixed reply, never the model.
    if (turnCtx.kind === 'distress') {
      releaseStream();
      return distressResponse(turnCtx, turnParams);
    }

    const startTime = Date.now();
    // Set as the turn starts: when the client leaves, onEnd runs at once and must wait for the turn.
    let controlledTurn: Promise<ControlledTurn> | undefined;
    const turnUsage = new TurnUsage();

    // What reaches the student is checked against: the message, the cards, the title.
    const check: OutputCheckContext = {
      sheet: turnCtx.exerciseSheet,
      uncertain: turnCtx.exerciseUncertain,
      diagnosis: turnCtx.exerciseProgress?.diagnosis ?? null,
      studentText: safeContent,
      pastStudentTexts: turnCtx.conversationHistory.filter((turn) => turn.role === 'user').map((turn) => turn.content),
    };

    const stream = createUIMessageStream<TomChatMessage>({
      execute: async ({ writer }) => {
        const tools = buildChatTools({
          userId: user.id,
          sessionId: turnCtx.sessionId,
          schoolLevel: resolvedSchoolLevel,
          flashcards: quotaCheck.plan === 'premium',
          check,
          emitDeckCreated: d => { writer.write({ type: 'data-deck-created', data: d }); },
        });

        controlledTurn = runControlledTurn(writer, {
          userId: user.id,
          content: safeContent,
          subject: turnCtx.subject,
          schoolLevel: resolvedSchoolLevel,
          firstName: firstName ?? user.firstName ?? undefined,
          sessionId: turnCtx.sessionId,
          conversationSummary: turnCtx.conversationSummary,
          conversationHistory: turnCtx.conversationHistory,
          turnInstruction: turnCtx.turnInstruction,
          turnAnalysis: turnCtx.turnAnalysis,
          exerciseSheet: turnCtx.exerciseSheet,
          contracted: turnCtx.exerciseProgress !== null,
          attachedFiles: turnCtx.attachedFiles,
          inputMode,
          tools,
          usage: turnUsage,
        }, check);
        await controlledTurn;
      },
      onEnd: async ({ responseMessage }) => {
        try {
          // Wait for the model's side to end, whatever ends it (finish, timeout, error), even
          // when the client left first: only then is the usage complete.
          const controlled = await controlledTurn?.catch(() => undefined);
          await Promise.all((controlled?.results ?? []).map(result => Promise.resolve(result.steps).then(() => undefined, () => undefined)));
          const { usage, cut } = turnUsage.read();
          if (cut) {
            logger.warn('Chat turn cut: the cut call is estimated', {
              userId: user.id,
              sessionId: turnCtx.sessionId,
              requestId,
              operation: 'chat-stream:cut',
            });
          }
          const modelMessages = cut || !controlled ? undefined : await controlled.replay();
          await chatOrchestrationService.finishTurn({
            sessionId: turnCtx.sessionId,
            userId: user.id,
            userContent: safeContent,
            // The checked text, even when the client left before it was written.
            text: controlled?.text ?? extractTextFromParts(responseMessage.parts),
            modelMessages,
            aborted: cut,
            model: env.MISTRAL_MODEL,
            usage,
            startTime,
            attachedFileInfo: turnCtx.attachedFileInfo,
            attachedFileInfos: turnCtx.attachedFileInfos,
            turnAnalysis: turnCtx.turnAnalysis,
            exerciseProgress: turnCtx.exerciseProgress,
            check,
            ...(controlled && controlled.outcome !== 'passed' && {
              outputCheck: { findings: controlled.findings.map(finding => finding.kind), outcome: controlled.outcome },
            }),
          });
        } catch (error) {
          logger.error('Chat turn persistence failed', {
            err: error,
            userId: user.id,
            sessionId: turnCtx.sessionId,
            requestId,
            operation: 'chat-stream:onend-error',
            severity: 'high' as const,
          });
        } finally {
          releaseStream();
        }
      },
      onError: error => {
        logger.error('Unexpected streaming error', {
          err: error,
          userId: user.id,
          sessionId: turnCtx.sessionId,
          requestId,
          operation: 'chat-stream:unexpected-error',
          severity: 'high' as const,
        });
        releaseStream();
        return 'Erreur inattendue. Réessaie.';
      },
    });

    return createUIMessageStreamResponse({ stream });
  });
