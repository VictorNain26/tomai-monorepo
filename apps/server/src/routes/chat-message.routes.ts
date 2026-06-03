/**
 * Routes Chat SSE Streaming - Gemini Agent Multi-Tool
 *
 * Token-optimized architecture:
 * - Accepts { content, data } (frontend sends ONLY new message)
 * - Backend manages history from DB (limit: 20, auto-summarization)
 * - Orchestration delegated to ChatOrchestrationService
 */

import { Elysia, t, sse } from 'elysia';
import { requireAuth } from '../middleware/auth.middleware.js';
import { chatOrchestrationService, ChatOrchestrationError } from '../services/chat/chat-orchestration.service.js';
import { tokenQuotaService } from '../services/token-quota.service.js';
import { AppError, toErrorResponse } from '../lib/errors.js';
import { logger } from '../lib/observability.js';
import { env } from '../config/env.js';
import type { EducationLevelType } from '../types/index.js';

// Track active SSE connections per user
const activeSSEConnections = new Map<string, number>();
const MAX_CONCURRENT_SSE = 2;

/** Strip null bytes and control characters from user input */
function sanitizePrompt(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

export const chatMessageRoutes = new Elysia({ prefix: '/api/chat' })
  .post('/stream', async function* ({ body, request: { headers }, set, store }) {
    const requestId = (store as { requestId?: string }).requestId;
    // SSE anti-buffering headers (BEFORE any yield)
    set.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    set.headers['X-Accel-Buffering'] = 'no';
    set.headers['Connection'] = 'keep-alive';

    // 1. Auth validation
    const authResult = await requireAuth(headers);
    if (!authResult.success) {
      set.status = authResult.status;
      if (authResult.shouldClearCookies) {
        set.headers['Set-Cookie'] = [
          'better-auth.session_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax',
          'better-auth.session_data=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax'
        ].join(', ');
      }
      return toErrorResponse(new AppError('UNAUTHORIZED'), requestId);
    }

    const user = authResult.user;
    // body is already validated and typed by Elysia's t.Object schema below — no cast needed.
    const { content, data, pronoteContext } = body;

    const fileIds = data.fileIds ?? (data.fileId ? [data.fileId] : []);
    const safeContent = sanitizePrompt(content ?? '');

    // 2. Quota check
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

    // 3. Content validation
    if (safeContent.trim().length === 0 && fileIds.length === 0) {
      set.status = 400;
      return toErrorResponse(new AppError('EMPTY_MESSAGE'), requestId);
    }

    // 4. Concurrent SSE limit
    const currentConns = activeSSEConnections.get(user.id) ?? 0;
    if (currentConns >= MAX_CONCURRENT_SSE) {
      set.status = 409;
      return toErrorResponse(new AppError('CONCURRENT_STREAM'), requestId);
    }
    activeSSEConnections.set(user.id, currentConns + 1);

    try {
      // 5. Delegate to orchestration service
      const stream = chatOrchestrationService.orchestrateStream({
        userId: user.id,
        content: safeContent,
        sessionId: data.sessionId,
        subject: data.subject,
        schoolLevel: (data.schoolLevel ?? user.schoolLevel) as EducationLevelType,
        firstName: data.firstName ?? user.firstName ?? undefined,
        fileIds,
        userRole: user.role === 'parent' ? 'parent' : 'student',
        pronoteContext,
      });

      for await (const chunk of stream) {
        yield sse({ data: chunk });
      }

      yield sse({ data: '[DONE]' });

    } catch (error) {
      if (error instanceof ChatOrchestrationError) {
        const code = error.statusCode === 403 ? 'FORBIDDEN' as const : 'SESSION_NOT_FOUND' as const;
        set.status = error.statusCode;
        return toErrorResponse(new AppError(code, error.message), requestId);
      }

      logger.error('Unexpected streaming error', {
        _error: error instanceof Error ? error.message : String(error),
        userId: user.id,
        requestId,
        operation: 'chat-stream:unexpected-error',
        severity: 'high' as const,
      });

      yield sse({ data: {
        type: 'error',
        id: `err_${Date.now()}`,
        model: env.MISTRAL_MODEL,
        timestamp: Date.now(),
        error: { message: 'Erreur inattendue. Réessaie.', code: 'INTERNAL_ERROR' },
      } });
    } finally {
      const connCount = activeSSEConnections.get(user.id) ?? 1;
      if (connCount <= 1) activeSSEConnections.delete(user.id);
      else activeSSEConnections.set(user.id, connCount - 1);
    }

    return;
  }, {
    body: t.Object({
      content: t.String({
        maxLength: 10000,
        description: 'New user message (backend manages history)'
      }),
      data: t.Object({
        subject: t.Optional(t.String({
          minLength: 2,
          maxLength: 50,
          description: 'Educational subject (optional for multi-subject chat)'
        })),
        sessionId: t.Optional(t.String({
          minLength: 36,
          maxLength: 36,
          pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
          description: 'Session UUID'
        })),
        schoolLevel: t.Optional(t.String({
          minLength: 2,
          maxLength: 20,
          description: 'Student school level'
        })),
        firstName: t.Optional(t.String({
          minLength: 1,
          maxLength: 50,
          description: 'Student first name'
        })),
        fileId: t.Optional(t.String({
          minLength: 20,
          maxLength: 100,
          description: '[DEPRECATED] Use fileIds instead'
        })),
        fileIds: t.Optional(t.Array(t.String({
          minLength: 20,
          maxLength: 100
        }), {
          maxItems: 5,
          description: 'File IDs for multimodal messages'
        }))
      }),
      pronoteContext: t.Optional(t.Object({
        homework: t.Optional(t.Array(t.Object({
          subject: t.String(),
          description: t.String(),
          dueDate: t.String(),
          done: t.Boolean()
        }))),
        recentGrades: t.Optional(t.Array(t.Object({
          subject: t.String(),
          value: t.Union([t.Number(), t.Null()]),
          outOf: t.Number(),
          date: t.String()
        }))),
        todayTimetable: t.Optional(t.Array(t.Object({
          subject: t.String(),
          startDate: t.String(),
          endDate: t.String(),
          canceled: t.Boolean()
        })))
      }, { description: 'Ephemeral Pronote context from device (never persisted)' }))
    })
  });
