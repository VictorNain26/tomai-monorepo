/**
 * Routes Chat SSE Streaming - TanStack AI Protocol 2025
 *
 * Architecture 100% TanStack AI:
 * - Accepte format TanStack AI Protocol: { messages, data }
 * - Format SSE standard TanStack AI (data: {JSON}\n\n + data: [DONE]\n\n)
 * - Compatible @tanstack/ai-react useChat hook avec stream() adapter
 * - Auth, quota, et sauvegarde messages côté serveur
 * - RAG automatique via Server Tools
 */

import { Elysia, t, sse } from 'elysia';
import { requireAuth } from '../middleware/auth.middleware.js';
import { chatService } from '../services/chat.service.js';
import { fileContextService, streamingService } from '../services/chat/index.js';
import { tokenQuotaService } from '../services/token-quota.service.js';
import { logger } from '../lib/observability.js';
import type { EducationLevelType } from '../types/index.js';

/**
 * TanStack AI Protocol - Message format
 */
interface TanStackMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * TanStack AI Protocol - Request data
 */
interface TanStackRequestData {
  subject: string;
  sessionId?: string;
  schoolLevel?: string;
  firstName?: string;
  fileId?: string;
}

export const chatMessageRoutes = new Elysia({ prefix: '/api/chat' })
  /**
   * Route STREAMING SSE - TanStack AI Protocol 2025
   * POST /api/chat/stream
   *
   * Accepte format TanStack AI Protocol: { messages, data }
   * - messages: Array de messages conversation (ModelMessage[])
   * - data: Métadonnées custom (subject, sessionId, schoolLevel, firstName, fileId)
   *
   * Format response SSE (compatible @tanstack/ai-react):
   * - data: {"type":"content",...}\n\n
   * - data: {"type":"done",...}\n\n
   * - data: [DONE]\n\n
   */
  .post('/stream', async function* ({ body, request: { headers }, set }) {
    // ═══════════════════════════════════════════════════════════════════
    // PHASE 0: Headers SSE anti-buffering (AVANT tout yield)
    // Ces headers empêchent le buffering par les proxies (nginx, Koyeb, etc.)
    // ═══════════════════════════════════════════════════════════════════
    set.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    set.headers['X-Accel-Buffering'] = 'no'; // Désactive buffering nginx/proxy
    set.headers['Connection'] = 'keep-alive';

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 1: Validation AVANT premier yield (headers peuvent être set)
    // ═══════════════════════════════════════════════════════════════════

    // 1. Validation Better Auth
    const authResult = await requireAuth(headers);

    if (!authResult.success) {
      set.status = authResult.status;

      if (authResult.shouldClearCookies) {
        set.headers['Set-Cookie'] = [
          'better-auth.session_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax',
          'better-auth.session_data=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax'
        ].join(', ');
      }

      // Return sans yield = réponse JSON normale (pas de streaming)
      return { _error: authResult._error, message: 'Valid session required' };
    }

    const user = authResult.user;

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 1b: Parser TanStack AI Protocol { messages, data }
    // ═══════════════════════════════════════════════════════════════════
    const { messages, data } = body as {
      messages: TanStackMessage[];
      data: TanStackRequestData;
    };

    // Extraire le dernier message utilisateur
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    const content = lastUserMessage?.content ?? '';

    // Extraire les métadonnées depuis data
    const { subject, sessionId, schoolLevel, firstName, fileId } = data;

    // 2. Vérification quota tokens (rolling window 5h + daily cap)
    const quotaCheck = await tokenQuotaService.checkQuota(user.id);
    if (!quotaCheck.allowed) {
      set.status = 429;
      return {
        _error: 'Quota Exceeded',
        message: quotaCheck.message ?? 'Limite atteinte. Réessayez bientôt.',
        usage: {
          windowUsagePercent: quotaCheck.windowUsagePercent,
          dailyUsagePercent: quotaCheck.dailyUsagePercent,
          windowRefreshIn: quotaCheck.windowRefreshIn,
          plan: quotaCheck.plan,
        }
      };
    }

    // 3. Validation contenu OU fichier requis (Best Practices 2025)
    if ((!content || content.trim().length === 0) && !fileId) {
      set.status = 400;
      return { _error: 'Validation Error', message: 'Content or file is required for streaming' };
    }

    // 4. Créer ou récupérer session
    const chatSessionId = sessionId?.trim()
      ? sessionId
      : await chatService.createSession(user.id, subject);

    // 5. Récupérer historique
    const sessionHistory = await chatService.getSessionHistory(chatSessionId, { limit: 10 });

    const formattedHistory = sessionHistory
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: msg.createdAt.toISOString()
      }));

    // 5b. Préparer contexte fichier via helper consolidé (DRY)
    const { attachedFileInfo, enrichedContent } = await fileContextService.prepareFileContext({
      fileId,
      content: content ?? '',
      schoolLevel: (schoolLevel ?? user.schoolLevel) as EducationLevelType,
      userId: user.id,
      sessionHistory
    });

    const startTime = Date.now();

    logger.info('Chat streaming started (generator pattern)', {
      userId: user.id,
      subject,
      sessionId: chatSessionId,
      level: schoolLevel ?? user.schoolLevel,
      hasFile: !!fileId,
      operation: 'chat-stream:generator',
      windowTokensRemaining: quotaCheck.windowTokensRemaining,
      dailyTokensRemaining: quotaCheck.dailyTokensRemaining,
    });

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 2: Sauvegarde message user AVANT streaming (Best Practices 2025)
    // ═══════════════════════════════════════════════════════════════════

    // 6. Sauvegarder le message utilisateur AVANT streaming (avec métadonnées fichier)
    await chatService.saveMessage(
      chatSessionId,
      'user',
      content ?? '',
      attachedFileInfo ? { attachedFile: attachedFileInfo } : {}
    );

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 3: Streaming via yield sse() - Headers envoyés au premier yield
    // ═══════════════════════════════════════════════════════════════════

    // 7. Générer et yield les chunks SSE (avec contenu enrichi par fichiers)
    const streamGenerator = streamingService.generateStreamChunks({
      userId: user.id,
      content: enrichedContent, // ✅ Contenu enrichi avec transcription fichier TEXT
      subject,
      schoolLevel: (schoolLevel ?? user.schoolLevel) as EducationLevelType,
      firstName: firstName ?? user.firstName ?? undefined,
      sessionId: chatSessionId,
      conversationHistory: formattedHistory
    });

    // 8. Variable pour tracking du contenu complet
    let fullContent = '';

    // 9. Yield chaque chunk au format TanStack AI Protocol
    for await (const chunk of streamGenerator) {

      if (chunk.type === 'content') {
        // Accumuler le contenu pour sauvegarde
        fullContent = chunk.content ?? fullContent;

        // Yield chunk TanStack AI Protocol
        yield sse({ data: chunk });

      } else if (chunk.type === 'done') {
        // ═══════════════════════════════════════════════════════════════
        // Sauvegarde message assistant + tracking tokens
        // ═══════════════════════════════════════════════════════════════
        const tokensUsed = chunk.usage?.totalTokens ?? 0;

        // Sauvegarder le message assistant
        await chatService.saveMessage(chatSessionId, 'assistant', fullContent, {
          aiModel: chunk.model,
          tokensUsed,
          responseTimeMs: Date.now() - startTime,
          ...(attachedFileInfo && { attachedFile: attachedFileInfo })
        });

        // Incrémenter le compteur de tokens
        if (tokensUsed > 0) {
          await tokenQuotaService.incrementTokenUsage(user.id, tokensUsed);
        }

        logger.info('Streaming message saved (TanStack AI Protocol)', {
          userId: user.id,
          sessionId: chatSessionId,
          messageId: chunk.id,
          tokensUsed,
          model: chunk.model,
          responseTimeMs: Date.now() - startTime,
          operation: 'chat-stream:save'
        });

        // Yield done chunk TanStack AI Protocol
        yield sse({ data: chunk });

      } else if (chunk.type === 'error') {
        // Yield error chunk TanStack AI Protocol
        yield sse({ data: chunk });
      }
    }

    // 10. Yield [DONE] marker (TanStack AI Protocol standard)
    yield sse({ data: '[DONE]' });

    // Return explicite pour satisfaire TypeScript (generator terminé)
    return;
  }, {
    // TanStack AI Protocol: { messages, data }
    body: t.Object({
      messages: t.Array(t.Object({
        role: t.Union([t.Literal('user'), t.Literal('assistant'), t.Literal('system')]),
        content: t.String({ maxLength: 10000 })
      }), {
        minItems: 1,
        description: 'TanStack AI ModelMessage array'
      }),
      data: t.Object({
        subject: t.String({
          minLength: 2,
          maxLength: 50,
          description: 'Educational subject'
        }),
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
          description: 'File ID stored in Redis cache'
        }))
      })
    })
  });
