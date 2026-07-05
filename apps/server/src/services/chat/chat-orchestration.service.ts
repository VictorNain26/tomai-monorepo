/**
 * ChatOrchestrationService - Pipeline chat streaming (AI SDK)
 *
 * Responsabilites:
 * 1. Resoudre/creer la session + charger historique + resume
 * 2. Persister le message user AVANT le streaming
 * 3. Post-processing apres le streaming (`onFinish`) : sauver le message
 *    assistant, comptabiliser tokens/cout, declencher summarization et
 *    auto-titrage en fire-and-forget
 *
 * L'enrichissement de contexte avance (fichiers multimodaux, profil
 * cognitif, memoire episodique, classification d'intention) appartenait au
 * pipeline SSE legacy (`mistralChatService.generateStreamChunks`) — il n'est
 * PAS repris ici : hors perimetre de la migration AI SDK (lot 4), a
 * reintroduire dans un chantier dedie si besoin.
 */

import { chatSessionService } from './chat-session.service.js';
import { chatMessageService } from './chat-message.service.js';
import { resolveEffectiveSubject } from './subject-resolution.js';
import { STUDENT_SUBJECTS } from '../../config/prompts/adaptation/subjects.js';
import { summarizationService } from './summarization.service.js';
import { autoTitleService } from './auto-title.service.js';
import { costTrackingService } from '../cost-tracking.service.js';
import { tokenQuotaService } from '../token-quota.service.js';
import { logger } from '../../lib/observability.js';
import { extractTextFromParts, type TomChatMessage } from './chat-ui-message.js';
import type { LanguageModelUsage } from 'ai';

interface ResolveSessionRequest {
  userId: string;
  sessionId?: string;
}

export interface ChatTurnContext {
  sessionId: string;
  subject?: string;
  conversationSummary: string | null;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
}

interface FinishTurnParams {
  sessionId: string;
  userId: string;
  userContent: string;
  responseMessage: TomChatMessage;
  model: string;
  usage: LanguageModelUsage | undefined;
  startTime: number;
}

class ChatOrchestrationService {
  /**
   * Resout (ou cree) la session et charge historique + resume + matiere
   * effective pour ce tour. Jette `ChatOrchestrationError` si le
   * `sessionId` fourni n'existe pas ou n'appartient pas a l'utilisateur.
   */
  async resolveSessionContext(request: ResolveSessionRequest & { requestedSubject?: string }): Promise<ChatTurnContext> {
    let sessionId: string;

    if (request.sessionId?.trim()) {
      const session = await chatSessionService.getSession(request.sessionId);
      if (!session || session.userId !== request.userId) {
        throw new ChatOrchestrationError('Session not found or access denied', 403);
      }
      sessionId = request.sessionId;
    } else {
      sessionId = await chatSessionService.getOrCreateActiveSession(request.userId);
    }

    const sessionSummary = await chatSessionService.getSessionWithSummary(sessionId);

    const sessionHistory = await chatMessageService.getSessionHistory(sessionId, {
      limit: 20,
      afterMessageId: sessionSummary?.summaryUpToMessageId ?? undefined,
    });

    const conversationHistory = sessionHistory
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: msg.createdAt.toISOString(),
      }));

    const requestedSubject =
      request.requestedSubject && (STUDENT_SUBJECTS as readonly string[]).includes(request.requestedSubject)
        ? request.requestedSubject
        : undefined;

    return {
      sessionId,
      subject: resolveEffectiveSubject({
        sessionSubject: sessionSummary?.subject ?? null,
        requested: requestedSubject,
      }),
      conversationSummary: sessionSummary?.conversationSummary ?? null,
      conversationHistory,
    };
  }

  /**
   * Persiste le message utilisateur AVANT le streaming (comportement
   * inchange vis-a-vis du pipeline legacy) et associe les fichiers a la
   * session. Ne fait AUCUNE analyse de fichier (OCR/vision) — hors
   * perimetre de ce lot.
   */
  async persistUserTurn(params: {
    sessionId: string;
    content: string;
    inputMode?: 'text' | 'voice';
  }): Promise<void> {
    await chatMessageService.saveMessage(
      params.sessionId,
      'user',
      params.content,
      {
        ...(params.inputMode && { inputMode: params.inputMode }),
      },
      { verifySessionExists: false },
    );
  }

  /**
   * Post-processing apres le streaming (branche sur `onFinish` du UI
   * Message Stream) : sauve le message assistant, comptabilise
   * tokens/cout, et declenche summarization + auto-titrage en
   * fire-and-forget. Miroir du `postProcess` du pipeline legacy.
   */
  async finishTurn(params: FinishTurnParams): Promise<void> {
    const { sessionId, userId, userContent, responseMessage, model, usage, startTime } = params;
    const fullContent = extractTextFromParts(responseMessage.parts);
    const tokensUsed = usage?.totalTokens ?? 0;

    await chatMessageService.saveMessage(sessionId, 'assistant', fullContent, {
      aiModel: model,
      tokensUsed,
      responseTimeMs: Date.now() - startTime,
    }, { verifySessionExists: false });

    if (tokensUsed > 0) {
      await tokenQuotaService.incrementTokenUsage(userId, tokensUsed);

      await costTrackingService.record({
        userId,
        sessionId,
        aiModel: model,
        operation: 'chat',
        tokensInput: usage?.inputTokens ?? 0,
        tokensOutput: usage?.outputTokens ?? 0,
        cachedTokens: usage?.inputTokenDetails?.cacheReadTokens ?? 0,
      });
    }

    logger.info('Streaming message saved', {
      userId,
      sessionId,
      tokensUsed,
      model,
      responseTimeMs: Date.now() - startTime,
      operation: 'chat-orchestration:save',
    });

    summarizationService.summarizeIfNeeded(sessionId).catch(err => {
      logger.error('Background summarization failed', {
        _error: err instanceof Error ? err.message : String(err),
        sessionId,
        operation: 'chat-orchestration:summarization-bg',
        severity: 'low' as const,
      });
    });

    autoTitleService.generateTitleIfNeeded(sessionId, userContent, fullContent).catch(err => {
      logger.warn('Background auto-title failed', {
        _error: err instanceof Error ? err.message : String(err),
        sessionId,
        operation: 'chat-orchestration:auto-title-bg',
      });
    });
  }
}

export class ChatOrchestrationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'ChatOrchestrationError';
  }
}

export const chatOrchestrationService = new ChatOrchestrationService();
