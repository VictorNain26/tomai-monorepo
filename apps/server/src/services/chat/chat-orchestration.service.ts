/**
 * ChatOrchestrationService - Pipeline complet du chat streaming
 *
 * Responsabilites:
 * 1. Assembler le contexte (fichiers, profil cognitif, learning)
 * 2. Gerer la session + historique
 * 3. Persister les messages (user avant stream, assistant apres)
 * 4. Orchestrer le streaming Mistral
 * 5. Post-processing (tokens, summarization)
 */

import { chatSessionService } from './chat-session.service.js';
import { chatMessageService } from './chat-message.service.js';
import { sessionFilesRepository } from '../../db/repositories/index.js';
import { fileContextService } from './file-context.service.js';
import { mistralChatService } from './mistral-chat.service.js';
import { getLearningContext } from './mistral-helpers.js';
import { summarizationService } from './summarization.service.js';
import { autoTitleService } from './auto-title.service.js';
import { intentClassifierService, type ClassifiedIntent } from './intent-classifier.service.js';
import { cognitiveProfileService } from '../cognitive-profile.service.js';
import { costTrackingService } from '../cost-tracking.service.js';
import { episodicMemoryService } from '../episodic-memory.service.js';
import { tokenQuotaService } from '../token-quota.service.js';
import { logger } from '../../lib/observability.js';
import type { EducationLevelType } from '../../types/index.js';
import type { ChatStreamChunk, PronoteContext } from './chat-streaming-types.js';

interface ChatStreamRequest {
  userId: string;
  content: string;
  sessionId?: string;
  subject?: string;
  schoolLevel: EducationLevelType;
  firstName?: string;
  fileIds: string[];
  userRole: 'student' | 'parent';
  pronoteContext?: PronoteContext;
}

interface SessionContext {
  sessionId: string;
  conversationSummary: string | null;
  formattedHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
}

const MAX_ENRICHED_CONTENT_CHARS = 50_000;

class ChatOrchestrationService {
  /**
   * Pipeline principal : assemble le contexte, persiste, stream, post-process.
   * Retourne un AsyncGenerator de ChatStreamChunk.
   */
  async *orchestrateStream(request: ChatStreamRequest): AsyncGenerator<ChatStreamChunk> {
    const startTime = Date.now();

    // Phase 1: Session
    const sessionCtx = await this.resolveSession(request);

    // Phase 2: Context assembly (parallel)
    // Intent classification runs in parallel with context assembly so it
    // adds no end-to-end latency on the critical path. Max ~8s (its own
    // timeout) bounded; classification failures fall back to intent='unknown'
    // (logged at high severity — not a silent fallback).
    //
    // Episodic memory retrieval is also parallelized. It queries pgvector
    // for past sessions (TTL-aware, cosine similarity) and returns [] on
    // miss/error with its own logging.
    const [
      fileContext,
      multimodalFiles,
      cognitiveProfileSummary,
      learningContext,
      classifiedIntent,
      relevantEpisodes,
    ] = await Promise.all([
      fileContextService.prepareFileContext({
        fileIds: request.fileIds,
        content: request.content,
        schoolLevel: request.schoolLevel,
        userId: request.userId,
        sessionId: sessionCtx.sessionId,
      }),
      fileContextService.prepareMultimodalFiles(request.fileIds),
      cognitiveProfileService.getProfileSummary(request.userId),
      getLearningContext(request.userId),
      intentClassifierService.classify(request.content, request.schoolLevel),
      episodicMemoryService.retrieveRelevant(request.userId, request.content, 3),
    ]);

    const intentReinforcement = intentClassifierService.buildReinforcement(classifiedIntent);
    const episodicContext = episodicMemoryService.formatEpisodesForPrompt(relevantEpisodes);

    const { attachedFileInfos, attachedFiles } = fileContext;
    // Primary file stays in the dedicated column for backward-compat readers;
    // the full list is persisted separately in messageMetadata via saveMessage
    // below (audit F-8: previously files 2..N were silently dropped).
    const attachedFileInfo = attachedFileInfos[0] ?? null;
    const hasMultipleFiles = attachedFileInfos.length > 1;

    // Cap the combined analysis size so a large document can't blow the context
    // budget. Truncate each analysis against a shared running budget rather than
    // the student message (the message is never truncated).
    let remainingBudget = MAX_ENRICHED_CONTENT_CHARS;
    const boundedAttachedFiles = attachedFiles.map(f => {
      if (remainingBudget <= 0) {
        return { ...f, analysis: '[Contenu tronqué]' };
      }
      if (f.analysis.length > remainingBudget) {
        const truncated = f.analysis.slice(0, remainingBudget) + '\n\n[Contenu tronqué]';
        remainingBudget = 0;
        return { ...f, analysis: truncated };
      }
      remainingBudget -= f.analysis.length;
      return f;
    });

    logger.info('Chat context assembled', {
      userId: request.userId,
      subject: request.subject,
      sessionId: sessionCtx.sessionId,
      level: request.schoolLevel,
      filesCount: request.fileIds.length,
      multimodalFilesCount: multimodalFiles.length,
      intent: classifiedIntent.intent,
      intentConfidence: classifiedIntent.confidence,
      intentReinforced: intentReinforcement !== null,
      episodesRetrieved: relevantEpisodes.length,
      operation: 'chat-orchestration:context-ready',
    });

    // Phase 3: Persist user message BEFORE streaming.
    // Skip session re-check: resolveSession above already verified ownership.
    await chatMessageService.saveMessage(
      sessionCtx.sessionId,
      'user',
      request.content,
      attachedFileInfo
        ? {
            attachedFile: attachedFileInfo,
            ...(hasMultipleFiles && { attachedFiles: attachedFileInfos }),
          }
        : {},
      { verifySessionExists: false },
    );

    if (request.fileIds.length > 0) {
      await Promise.all(
        request.fileIds.map(fId => sessionFilesRepository.attach(sessionCtx.sessionId, fId)),
      );
    }

    // Phase 4: Yield thinking status
    yield {
      type: 'status' as const,
      id: `ack_${Date.now()}`,
      model: 'mistral-medium-latest',
      timestamp: Date.now(),
      status: 'Tom réfléchit…',
    };

    // Phase 5: Stream from Mistral
    // Merge episodic context into learning context so mistralChatService
    // only has one "prior knowledge" section to reason about. Learning
    // context (FSRS due cards) + episodes (past sessions) are complementary
    // pedagogical memory signals.
    const mergedLearningContext = [learningContext, episodicContext]
      .filter((x): x is string => Boolean(x))
      .join('\n\n') || null;

    const streamGenerator = mistralChatService.generateStreamChunks({
      userId: request.userId,
      content: request.content,
      attachedFiles: boundedAttachedFiles,
      schoolLevel: request.schoolLevel,
      firstName: request.firstName,
      sessionId: sessionCtx.sessionId,
      userRole: request.userRole,
      pronoteContext: request.pronoteContext,
      cognitiveProfileSummary,
      learningContext: mergedLearningContext,
      conversationSummary: sessionCtx.conversationSummary,
      conversationHistory: sessionCtx.formattedHistory,
      intentReinforcement,
      classifiedIntent,
      files: multimodalFiles.map(f => ({
        base64: f.base64,
        mimeType: f.mimeType,
        contentType: f.contentType,
      })),
    });

    let fullContent = '';

    for await (const chunk of streamGenerator) {
      if (chunk.type === 'content') {
        fullContent = chunk.content ?? fullContent;
        yield chunk;
      } else if (chunk.type === 'done') {
        // Phase 6: Post-processing
        await this.postProcess({
          sessionId: sessionCtx.sessionId,
          userId: request.userId,
          userContent: request.content,
          fullContent,
          chunk,
          startTime,
          attachedFileInfo,
          attachedFileInfos: hasMultipleFiles ? attachedFileInfos : undefined,
          classifiedIntent,
        });
        yield chunk;
      } else {
        // status, deck_created, error — forward as-is
        yield chunk;
      }
    }
  }

  /**
   * Resolve ou cree la session, charge l'historique et le resume.
   */
  private async resolveSession(request: ChatStreamRequest): Promise<SessionContext> {
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

    const formattedHistory = sessionHistory
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: msg.createdAt.toISOString(),
      }));

    return {
      sessionId,
      conversationSummary: sessionSummary?.conversationSummary ?? null,
      formattedHistory,
    };
  }

  /**
   * Post-processing apres streaming : save message, tokens, summarization.
   */
  private async postProcess(params: {
    sessionId: string;
    userId: string;
    userContent: string;
    fullContent: string;
    chunk: ChatStreamChunk;
    startTime: number;
    attachedFileInfo: {
      fileName: string;
      fileId?: string;
      mimeType?: string;
      fileSizeBytes?: number;
    } | null;
    attachedFileInfos?: Array<{
      fileName: string;
      fileId?: string;
      mimeType?: string;
      fileSizeBytes?: number;
    }>;
    classifiedIntent?: ClassifiedIntent;
  }): Promise<void> {
    const { sessionId, userId, userContent, fullContent, chunk, startTime, attachedFileInfo, attachedFileInfos, classifiedIntent } = params;
    const tokensUsed = chunk.usage?.totalTokens ?? 0;

    await chatMessageService.saveMessage(sessionId, 'assistant', fullContent, {
      aiModel: chunk.model,
      tokensUsed,
      responseTimeMs: Date.now() - startTime,
      ...(attachedFileInfo && { attachedFile: attachedFileInfo }),
      ...(attachedFileInfos && { attachedFiles: attachedFileInfos }),
      ...(classifiedIntent && { classifiedIntent }),
    }, { verifySessionExists: false });

    if (tokensUsed > 0) {
      await tokenQuotaService.incrementTokenUsage(userId, tokensUsed);

      // Cost accounting: compute cents from model pricing and persist a
      // cost_tracking row. This populates the table that
      // progress.service.getCostTracking already reads for dashboards.
      if (chunk.usage) {
        await costTrackingService.record({
          userId,
          sessionId,
          aiModel: chunk.model,
          operation: 'chat',
          tokensInput: chunk.usage.promptTokens,
          tokensOutput: chunk.usage.completionTokens,
        });
      }
    }

    logger.info('Streaming message saved', {
      userId,
      sessionId,
      messageId: chunk.id,
      tokensUsed,
      model: chunk.model,
      responseTimeMs: Date.now() - startTime,
      operation: 'chat-orchestration:save',
    });

    // Background tasks (fire-and-forget)
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
