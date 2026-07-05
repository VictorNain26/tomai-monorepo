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

import { Elysia, t } from 'elysia';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { authMacro } from '../lib/auth-macro.js';
import { createRateLimitMiddleware, RateLimitPresets } from '../middleware/rate-limit.middleware.js';
import { chatOrchestrationService, ChatOrchestrationError } from '../services/chat/chat-orchestration.service.js';
import { streamChat } from '../services/chat/ai-chat.service.js';
import { buildChatTools } from '../services/chat/chat-tools.js';
import { extractTextFromParts, type TomChatMessage } from '../services/chat/chat-ui-message.js';
import { tokenQuotaService } from '../services/token-quota.service.js';
import { AppError, toErrorResponse } from '../lib/errors.js';
import { logger } from '../lib/observability.js';
import { env } from '../config/env.js';
import { EDUCATION_LEVEL_UNION, isEducationLevel } from '../lib/education-levels.js';

// Track active UI message streams per user
const activeStreams = new Map<string, number>();
const MAX_CONCURRENT_STREAMS = 2;

/** Strip null bytes and control characters from user input */
function sanitizePrompt(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

export const chatMessageRoutes = new Elysia({ prefix: '/api/chat' })
  .use(authMacro)
  // Rate-limit AFTER the auth guard so `resolve` has injected `user` — the `ai`
  // preset keys by user id, which is undefined if this runs before the guard.
  .guard({ auth: true })
  .onBeforeHandle(createRateLimitMiddleware(RateLimitPresets.ai))
  .post('/stream', async ({ body, user, set, store }) => {
    const requestId = (store as { requestId?: string }).requestId;
    const { message, sessionId, subject, schoolLevel, firstName, fileId, fileIds: fileIdsBody, inputMode, pronoteContext } = body;

    const fileIds = fileIdsBody ?? (fileId ? [fileId] : []);
    const safeContent = sanitizePrompt(extractTextFromParts((message as { parts?: unknown } | null)?.parts));

    // 1. Quota check
    const quotaCheck = await tokenQuotaService.checkQuota(user.id);
    if (!quotaCheck.allowed) {
      set.status = 429;
      return {
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
      };
    }

    // 2. Content validation
    if (safeContent.trim().length === 0 && fileIds.length === 0) {
      set.status = 400;
      return toErrorResponse(new AppError('EMPTY_MESSAGE'), requestId);
    }

    // 3. Concurrent stream limit
    const currentStreams = activeStreams.get(user.id) ?? 0;
    if (currentStreams >= MAX_CONCURRENT_STREAMS) {
      set.status = 409;
      return toErrorResponse(new AppError('CONCURRENT_STREAM'), requestId);
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
    const userRole = user.role === 'parent' ? 'parent' : 'student';

    let turnCtx: Awaited<ReturnType<typeof chatOrchestrationService.resolveSessionContext>>;
    try {
      turnCtx = await chatOrchestrationService.resolveSessionContext({
        userId: user.id,
        sessionId,
        requestedSubject: subject,
      });
      await chatOrchestrationService.persistUserTurn({
        sessionId: turnCtx.sessionId,
        content: safeContent,
        inputMode,
      });
    } catch (error) {
      releaseStream();
      if (error instanceof ChatOrchestrationError) {
        const code = error.statusCode === 403 ? ('FORBIDDEN' as const) : ('SESSION_NOT_FOUND' as const);
        set.status = error.statusCode;
        return toErrorResponse(new AppError(code, error.message), requestId);
      }
      logger.error('Chat turn setup failed', {
        _error: error instanceof Error ? error.message : String(error),
        userId: user.id,
        requestId,
        operation: 'chat-stream:setup-error',
        severity: 'high' as const,
      });
      set.status = 500;
      return toErrorResponse(new AppError('INTERNAL_ERROR'), requestId);
    }

    const startTime = Date.now();
    let capturedResult: ReturnType<typeof streamChat> | undefined;

    const stream = createUIMessageStream<TomChatMessage>({
      execute: ({ writer }) => {
        const tools = buildChatTools({
          userId: user.id,
          sessionId: turnCtx.sessionId,
          schoolLevel: resolvedSchoolLevel,
          userRole,
          emitDeckCreated: d => writer.write({ type: 'data-deck-created', data: d }),
        });

        capturedResult = streamChat({
          userId: user.id,
          content: safeContent,
          subject: turnCtx.subject,
          schoolLevel: resolvedSchoolLevel,
          firstName: firstName ?? user.firstName ?? undefined,
          sessionId: turnCtx.sessionId,
          userRole,
          pronoteContext,
          conversationSummary: turnCtx.conversationSummary,
          conversationHistory: turnCtx.conversationHistory,
          inputMode,
          tools,
        });

        writer.merge(capturedResult.toUIMessageStream());
      },
      onFinish: async ({ responseMessage }) => {
        try {
          const usage = capturedResult ? await capturedResult.totalUsage : undefined;
          await chatOrchestrationService.finishTurn({
            sessionId: turnCtx.sessionId,
            userId: user.id,
            userContent: safeContent,
            responseMessage,
            model: env.MISTRAL_MODEL,
            usage,
            startTime,
          });
        } catch (error) {
          logger.error('Chat turn persistence failed', {
            _error: error instanceof Error ? error.message : String(error),
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
          _error: error instanceof Error ? error.message : String(error),
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
  }, {
    body: t.Object({
      message: t.Unknown({
        description: 'Last UIMessage sent by the client (AI SDK UI Message format); the server rebuilds full history from DB.',
      }),
      sessionId: t.Optional(t.String({
        minLength: 36,
        maxLength: 36,
        pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        description: 'Session UUID',
      })),
      subject: t.Optional(t.String({
        minLength: 2,
        maxLength: 50,
        description: 'Educational subject (optional for multi-subject chat)',
      })),
      schoolLevel: t.Optional(t.Union(
        [...EDUCATION_LEVEL_UNION.anyOf],
        { description: 'Student school level (CP → terminale)' },
      )),
      firstName: t.Optional(t.String({
        minLength: 1,
        maxLength: 50,
        description: 'Student first name',
      })),
      fileId: t.Optional(t.String({
        minLength: 20,
        maxLength: 100,
        description: '[DEPRECATED] Use fileIds instead',
      })),
      fileIds: t.Optional(t.Array(t.String({
        minLength: 20,
        maxLength: 100,
      }), {
        maxItems: 5,
        description: 'File IDs for multimodal messages',
      })),
      inputMode: t.Optional(t.Union([t.Literal('text'), t.Literal('voice')], {
        description: 'Input channel declared by the user gesture (mic vs keyboard); never inferred by the model. Defaults to text.',
      })),
      pronoteContext: t.Optional(t.Object({
        homework: t.Optional(t.Array(t.Object({
          subject: t.String(),
          description: t.String(),
          dueDate: t.String(),
          done: t.Boolean(),
        }))),
        recentGrades: t.Optional(t.Array(t.Object({
          subject: t.String(),
          value: t.Union([t.Number(), t.Null()]),
          outOf: t.Number(),
          date: t.String(),
        }))),
        todayTimetable: t.Optional(t.Array(t.Object({
          subject: t.String(),
          startDate: t.String(),
          endDate: t.String(),
          canceled: t.Boolean(),
        }))),
      }, { description: 'Ephemeral Pronote context from device (never persisted)' })),
    }),
  });
