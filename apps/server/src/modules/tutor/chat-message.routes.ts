/**
 * Chat streaming route — Vercel AI SDK UI Message Stream.
 *
 * Server is authoritative on history: the client sends ONLY the last
 * `UIMessage` (+ context fields); the backend reassembles system prompt +
 * history and streams the response as the standard AI SDK UI Message
 * Stream protocol (`createUIMessageStream`/`createUIMessageStreamResponse`).
 * Guards (quota, concurrency, sanitisation) run BEFORE the stream starts and
 * stay plain JSON responses, unchanged from the legacy SSE route.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { createUIMessageStream, createUIMessageStreamResponse, toUIMessageStream } from 'ai';
import { requireUser, validate, type AppEnv } from '../../platform/http/context.js';
import { createRateLimitMiddleware, RateLimitPresets } from '../../platform/http/rate-limit.js';
import { chatOrchestrationService, ChatOrchestrationError } from './chat-orchestration.service.js';
import { streamChat } from './ai-chat.service.js';
import { buildChatTools } from './chat-tools.js';
import { extractTextFromParts, sanitizePrompt, type TomChatMessage } from './chat-ui-message.js';
import { checkQuota } from '../billing/index.js';
import { AppError, toErrorResponse } from '../../platform/http/errors.js';
import { logger } from '../../platform/observability/logger.js';
import { env } from '../../platform/config/env.js';
import { educationLevelSchema, isCollegeLevel, isEducationLevel } from '../../lib/education-levels.js';

// Track active UI message streams per user
const activeStreams = new Map<string, number>();
const MAX_CONCURRENT_STREAMS = 2;

const streamBody = z.object({
  // Last UIMessage sent by the client (AI SDK UI Message format); the server rebuilds full history from DB.
  message: z.looseObject({}),
  sessionId: z.uuid().optional(),
  // Optional for multi-subject chat
  subject: z.string().min(2).max(50).optional(),
  schoolLevel: educationLevelSchema.optional(),
  firstName: z.string().min(1).max(50).optional(),
  fileIds: z.array(z.string().min(20).max(100)).max(5).optional(),
  // Input channel declared by the user gesture (mic vs keyboard); never inferred by the model. Defaults to text.
  inputMode: z.enum(['text', 'voice']).optional(),
});

const aiRateLimit = createRateLimitMiddleware(RateLimitPresets.ai);

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

    // 1. Quota check
    const quotaCheck = await checkQuota(user.id);
    if (!quotaCheck.allowed) {
      return c.json({
        error: {
          code: 'QUOTA_EXCEEDED' as const,
          message: quotaCheck.message ?? 'Limite atteinte. Réessaie bientôt.',
        },
        usage: {
          windowUsagePercent: quotaCheck.windowUsagePercent,
          dailyUsagePercent: quotaCheck.dailyUsagePercent,
          windowRefreshIn: quotaCheck.windowRefreshIn,
          plan: quotaCheck.plan,
        },
        requestId,
      }, 429);
    }

    // 2. Content validation
    if (safeContent.trim().length === 0 && fileIds.length === 0) {
      return c.json(toErrorResponse(new AppError('EMPTY_MESSAGE'), requestId), 400);
    }

    // 3. Concurrent stream limit
    const currentStreams = activeStreams.get(user.id) ?? 0;
    if (currentStreams >= MAX_CONCURRENT_STREAMS) {
      return c.json(toErrorResponse(new AppError('CONCURRENT_STREAM'), requestId), 409);
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
    // The prompt serves the collège only: another level would get a tutor that contradicts it.
    if (!isCollegeLevel(resolvedSchoolLevel)) {
      releaseStream();
      const appError = new AppError('VALIDATION_ERROR', `school level ${resolvedSchoolLevel} is outside the collège`);
      return c.json(toErrorResponse(appError, requestId), appError.statusCode);
    }

    let turnCtx: Awaited<ReturnType<typeof chatOrchestrationService.prepareTurn>>;
    try {
      turnCtx = await chatOrchestrationService.prepareTurn({
        userId: user.id,
        sessionId,
        requestedSubject: subject,
        content: safeContent,
        fileIds,
        schoolLevel: resolvedSchoolLevel,
      });
      await chatOrchestrationService.persistUserTurn({
        sessionId: turnCtx.sessionId,
        content: safeContent,
        inputMode,
        fileIds,
        attachedFileInfo: turnCtx.attachedFileInfo,
        attachedFileInfos: turnCtx.attachedFileInfos,
      });
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

    const startTime = Date.now();
    let capturedResult: ReturnType<typeof streamChat> | undefined;

    const stream = createUIMessageStream<TomChatMessage>({
      execute: ({ writer }) => {
        const tools = buildChatTools({
          userId: user.id,
          sessionId: turnCtx.sessionId,
          schoolLevel: resolvedSchoolLevel,
          emitDeckCreated: d => { writer.write({ type: 'data-deck-created', data: d }); },
        });

        capturedResult = streamChat({
          userId: user.id,
          content: safeContent,
          subject: turnCtx.subject,
          schoolLevel: resolvedSchoolLevel,
          firstName: firstName ?? user.firstName ?? undefined,
          sessionId: turnCtx.sessionId,
          conversationSummary: turnCtx.conversationSummary,
          conversationHistory: turnCtx.conversationHistory,
          cognitiveProfileSummary: turnCtx.cognitiveProfileSummary,
          learningContext: turnCtx.mergedLearningContext,
          intentReinforcement: turnCtx.intentReinforcement,
          classifiedIntent: turnCtx.classifiedIntent,
          files: turnCtx.files,
          attachedFiles: turnCtx.attachedFiles,
          inputMode,
          tools,
        });

        writer.merge(toUIMessageStream({ stream: capturedResult.stream, tools, sendReasoning: false }));
      },
      onFinish: async ({ responseMessage, isAborted }) => {
        try {
          const usage = capturedResult ? await capturedResult.usage : undefined;
          const modelMessages = capturedResult ? await capturedResult.responseMessages : undefined;
          await chatOrchestrationService.finishTurn({
            sessionId: turnCtx.sessionId,
            userId: user.id,
            userContent: safeContent,
            responseMessage,
            modelMessages,
            aborted: isAborted,
            model: env.MISTRAL_MODEL,
            usage,
            startTime,
            attachedFileInfo: turnCtx.attachedFileInfo,
            attachedFileInfos: turnCtx.attachedFileInfos,
            classifiedIntent: turnCtx.classifiedIntent,
          });
        } catch (error) {
          logger.error('Chat turn persistence failed', {
            err: error,
            userId: user.id,
            sessionId: turnCtx.sessionId,
            requestId,
            operation: 'chat-stream:onfinish-error',
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
