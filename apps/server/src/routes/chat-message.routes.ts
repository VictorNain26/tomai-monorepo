/**
 * Routes Chat SSE Streaming - Gemini Agent Multi-Tool
 *
 * Token-optimized architecture:
 * - Accepts { content, data } (frontend sends ONLY new message)
 * - Backend manages history from DB (limit: 10, auto-summarization)
 * - Implicit caching via stable system prompt prefix
 * - Agent multi-tool: RAG, Pronote, flashcards, profil cognitif
 */

import { Elysia, t, sse } from 'elysia';
import { requireAuth } from '../middleware/auth.middleware.js';
import { chatService } from '../services/chat.service.js';
import { fileContextService, streamingService, getLearningContext, summarizationService } from '../services/chat/index.js';
import { cognitiveProfileService } from '../services/cognitive-profile.service.js';
import { ragService } from '../services/rag.service.js';
import { tokenQuotaService } from '../services/token-quota.service.js';
import { logger } from '../lib/observability.js';
import type { EducationLevelType } from '../types/index.js';

/**
 * Chat Request data - Token optimized format
 */
interface ChatRequestData {
  subject?: string;
  sessionId?: string;
  schoolLevel?: string;
  firstName?: string;
  /** @deprecated Use fileIds instead */
  fileId?: string;
  /** IDs des fichiers attachés (images, PDFs) - multimodal */
  fileIds?: string[];
}

// Track active SSE connections per user (single-instance guard)
const activeSSEConnections = new Map<string, number>();
const MAX_CONCURRENT_SSE = 2;

/** Strip null bytes and control characters from user input */
function sanitizePrompt(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

export const chatMessageRoutes = new Elysia({ prefix: '/api/chat' })
  /**
   * POST /api/chat/stream - SSE Streaming (Gemini 3 Flash)
   *
   * Token-optimized format: { content, data }
   * - content: New user message only (backend has history in DB)
   * - data: { subject, sessionId, schoolLevel, firstName, fileIds }
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
    // PHASE 1b: Parse optimized format { content, data }
    // ═══════════════════════════════════════════════════════════════════
    const { content, data } = body as {
      content: string;
      data: ChatRequestData;
    };

    // Extraire les métadonnées depuis data
    const { subject, sessionId, schoolLevel, firstName, fileId, fileIds: rawFileIds } = data;
    const fileIds = rawFileIds ?? (fileId ? [fileId] : []);
    const safeContent = sanitizePrompt(content ?? '');

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

    // 3. Validation contenu OU fichiers requis
    if (safeContent.trim().length === 0 && fileIds.length === 0) {
      set.status = 400;
      return { _error: 'Validation Error', message: 'Content or files required for streaming' };
    }

    // 3b. Concurrent SSE limit
    const currentConns = activeSSEConnections.get(user.id) ?? 0;
    if (currentConns >= MAX_CONCURRENT_SSE) {
      set.status = 429;
      return { _error: 'Too Many Streams', message: 'Trop de conversations simultanées. Attends la fin de la réponse en cours.' };
    }
    activeSSEConnections.set(user.id, currentConns + 1);

    // 4. Récupérer session existante ou en créer une nouvelle
    let chatSessionId: string;
    if (sessionId?.trim()) {
      // Verify session belongs to user (prevent session hijacking)
      const session = await chatService.getSession(sessionId);
      if (!session || session.userId !== user.id) {
        set.status = 403;
        return { _error: 'Access Denied', message: 'Session not found or access denied' };
      }
      chatSessionId = sessionId;
    } else {
      // Chat unique multi-matière
      chatSessionId = await chatService.getOrCreateActiveSession(user.id);
    }

    // 5. Charger résumé conversationnel + historique récent (SummaryBuffer pattern)
    const sessionSummary = await chatService.getSessionWithSummary(chatSessionId);

    const sessionHistory = await chatService.getSessionHistory(chatSessionId, {
      limit: 20,
      afterMessageId: sessionSummary?.summaryUpToMessageId ?? undefined,
    });

    // Formater l'historique avec les fichiers attachés pour contexte visuel persistant
    // Best Practice 2026: Gemini voit les images des messages précédents
    const formattedHistory = sessionHistory
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .map(msg => {
        // Type-safe extraction of attachedFile from JSONB
        const attachedFile = msg.attachedFile as {
          fileName?: string;
          fileId?: string;
          geminiFileId?: string;
          mimeType?: string;
          fileSizeBytes?: number;
        } | null;

        return {
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          timestamp: msg.createdAt.toISOString(),
          // Inclure référence fichier pour contexte visuel persistant
          attachedFile: attachedFile?.geminiFileId ? {
            geminiFileId: attachedFile.geminiFileId,
            mimeType: attachedFile.mimeType
          } : null
        };
      });

    // 5b. Préparer contexte fichier + fichiers multimodaux + profil cognitif + learning + RAG spéculatif en parallèle
    const [fileContext, multimodalFiles, cognitiveProfileSummary, learningContext, speculativeRag] = await Promise.all([
      // Contexte texte enrichi (analyse, extraction) pour tous les fichiers
      fileContextService.prepareFileContext({
        fileIds,
        content: safeContent,
        schoolLevel: (schoolLevel ?? user.schoolLevel) as EducationLevelType,
        userId: user.id,
        sessionHistory
      }),
      // Fichiers multimodaux pour Gemini (images, PDFs via Files API)
      fileContextService.prepareMultimodalFiles(fileIds),
      // Profil cognitif pour personnalisation du system prompt
      cognitiveProfileService.getProfileSummary(user.id),
      // Contexte learning (cartes dues, sujets faibles)
      getLearningContext(user.id),
      // RAG spéculatif — lancer en parallèle, résultat ignoré si non pertinent
      ragService.hybridSearch({
        query: safeContent,
        niveau: (schoolLevel ?? user.schoolLevel) as EducationLevelType,
        matiere: subject ?? '',
        limit: 5,
      }).catch(() => null)
    ]);

    const { attachedFileInfos, enrichedContent: rawEnrichedContent } = fileContext;
    // Use first file info for message metadata (DB column is single object)
    const attachedFileInfo = attachedFileInfos[0] ?? null;

    // Cap enriched content to prevent sending huge payloads to Gemini
    const MAX_ENRICHED_CONTENT_CHARS = 50_000;
    const enrichedContent = rawEnrichedContent.length > MAX_ENRICHED_CONTENT_CHARS
      ? rawEnrichedContent.slice(0, MAX_ENRICHED_CONTENT_CHARS) + '\n\n[Contenu tronqué]'
      : rawEnrichedContent;

    // Inject speculative RAG context if results are relevant (score >= 0.5)
    const RAG_RELEVANCE_THRESHOLD = 0.5;
    let ragEnrichedContent = enrichedContent;
    if (speculativeRag && speculativeRag.averageSimilarity >= RAG_RELEVANCE_THRESHOLD && speculativeRag.context) {
      ragEnrichedContent = `📚 PROGRAMMES OFFICIELS\n${speculativeRag.context}\n\n${enrichedContent}`;
      logger.info('Speculative RAG injected', {
        userId: user.id,
        avgSimilarity: speculativeRag.averageSimilarity,
        strategy: speculativeRag.strategy,
        searchTimeMs: speculativeRag.searchTime,
        operation: 'chat-stream:speculative-rag'
      });
    }

    const startTime = Date.now();

    logger.info('Chat streaming started (generator pattern)', {
      userId: user.id,
      subject,
      sessionId: chatSessionId,
      level: schoolLevel ?? user.schoolLevel,
      filesCount: fileIds.length,
      multimodalFilesCount: multimodalFiles.length,
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
      safeContent,
      attachedFileInfo ? { attachedFile: attachedFileInfo } : {}
    );

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 3: Streaming via yield sse() - Headers envoyés au premier yield
    // ═══════════════════════════════════════════════════════════════════

    // 7. Immediate SSE acknowledgment — user sees "thinking" instantly
    yield sse({ data: {
      type: 'status',
      id: `ack_${Date.now()}`,
      model: 'gemini-3-flash-preview',
      timestamp: Date.now(),
      status: 'thinking'
    } });

    // 8. Générer et yield les chunks SSE (avec contenu enrichi + fichiers multimodaux)
    const streamGenerator = streamingService.generateStreamChunks({
      userId: user.id,
      content: ragEnrichedContent, // Contenu enrichi + RAG spéculatif si pertinent
      // Chat multi-matière: ne pas passer subject pour que le system prompt inclue toutes les matières
      schoolLevel: (schoolLevel ?? user.schoolLevel) as EducationLevelType,
      firstName: firstName ?? user.firstName ?? undefined,
      sessionId: chatSessionId,
      cognitiveProfileSummary,
      learningContext,
      conversationSummary: sessionSummary?.conversationSummary,
      conversationHistory: formattedHistory,
      // Fichiers multimodaux pour Gemini (images/PDFs via Files API ou base64)
      files: multimodalFiles.map(f => ({
        fileUri: f.fileUri,
        base64: f.base64,
        mimeType: f.mimeType,
        contentType: f.contentType
      }))
    });

    // 9. Variable pour tracking du contenu complet
    let fullContent = '';

    // 10. Yield chaque chunk au format Chat Protocol
    for await (const chunk of streamGenerator) {

      if (chunk.type === 'content') {
        // Accumuler le contenu pour sauvegarde
        fullContent = chunk.content ?? fullContent;

        // Yield chunk Chat Protocol
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

        logger.info('Streaming message saved (Chat Protocol)', {
          userId: user.id,
          sessionId: chatSessionId,
          messageId: chunk.id,
          tokensUsed,
          model: chunk.model,
          responseTimeMs: Date.now() - startTime,
          operation: 'chat-stream:save'
        });

        // Trigger async summarization (non-blocking, fire-and-forget)
        summarizationService.summarizeIfNeeded(chatSessionId).catch(err => {
          logger.error('Background summarization failed', {
            _error: err instanceof Error ? err.message : String(err),
            sessionId: chatSessionId,
            operation: 'chat-stream:summarization-bg',
            severity: 'low' as const,
          });
        });

        // Yield done chunk Chat Protocol
        yield sse({ data: chunk });

      } else if (chunk.type === 'deck_created') {
        // Deck created during tool call — forward to client
        yield sse({ data: chunk });
      } else if (chunk.type === 'status') {
        // Heartbeat during tool calls — forward to client
        yield sse({ data: chunk });
      } else if (chunk.type === 'error') {
        // Yield error chunk Chat Protocol
        yield sse({ data: chunk });
      }
    }

    // 11. Yield [DONE] marker (Chat Protocol standard)
    yield sse({ data: '[DONE]' });

    // Release concurrent SSE slot
    const connCount = activeSSEConnections.get(user.id) ?? 1;
    if (connCount <= 1) activeSSEConnections.delete(user.id);
    else activeSSEConnections.set(user.id, connCount - 1);

    // Return explicite pour satisfaire TypeScript (generator terminé)
    return;
  }, {
    // Token-optimized format: { content, data }
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
      })
    })
  });
