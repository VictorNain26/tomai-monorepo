/**
 * ChatOrchestrationService - Pipeline complet du chat streaming
 *
 * Responsabilites:
 * 1. Assembler le contexte (fichiers, profil cognitif, learning)
 * 2. Gerer la session + historique
 * 3. Persister les messages (user avant stream, assistant apres)
 * 4. Orchestrer le streaming Gemini
 * 5. Post-processing (tokens, summarization)
 */

import { chatService } from '../chat.service.js';
import { sessionFilesRepository } from '../../db/repositories/index.js';
import { fileContextService } from './file-context.service.js';
import { geminiChatService } from './gemini-chat.service.js';
import { getLearningContext } from './gemini-helpers.js';
import { summarizationService } from './summarization.service.js';
import { autoTitleService } from './auto-title.service.js';
import { cognitiveProfileService } from '../cognitive-profile.service.js';
import { tokenQuotaService } from '../token-quota.service.js';
import { appConfig } from '../../config/app.config.js';
import { logger } from '../../lib/observability.js';
import type { EducationLevelType } from '../../types/index.js';
import type { GeminiStreamChunk, PronoteContext } from './gemini-types.js';

export interface ChatStreamRequest {
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
    attachedFile: { geminiFileId: string; mimeType?: string } | null;
  }>;
}

const MAX_ENRICHED_CONTENT_CHARS = 50_000;

class ChatOrchestrationService {
  /**
   * Pipeline principal : assemble le contexte, persiste, stream, post-process.
   * Retourne un AsyncGenerator de GeminiStreamChunk.
   */
  async *orchestrateStream(request: ChatStreamRequest): AsyncGenerator<GeminiStreamChunk> {
    const startTime = Date.now();

    // Phase 1: Session
    const sessionCtx = await this.resolveSession(request);

    // Phase 2: Context assembly (parallel)
    const [fileContext, multimodalFiles, cognitiveProfileSummary, learningContext] = await Promise.all([
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
    ]);

    const { attachedFileInfos, enrichedContent: rawEnrichedContent } = fileContext;
    const attachedFileInfo = attachedFileInfos[0] ?? null;

    const enrichedContent = rawEnrichedContent.length > MAX_ENRICHED_CONTENT_CHARS
      ? rawEnrichedContent.slice(0, MAX_ENRICHED_CONTENT_CHARS) + '\n\n[Contenu tronqué]'
      : rawEnrichedContent;

    logger.info('Chat context assembled', {
      userId: request.userId,
      subject: request.subject,
      sessionId: sessionCtx.sessionId,
      level: request.schoolLevel,
      filesCount: request.fileIds.length,
      multimodalFilesCount: multimodalFiles.length,
      operation: 'chat-orchestration:context-ready',
    });

    // Phase 3: Persist user message BEFORE streaming
    await chatService.saveMessage(
      sessionCtx.sessionId,
      'user',
      request.content,
      attachedFileInfo ? { attachedFile: attachedFileInfo } : {},
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
      model: appConfig.ai.gemini.model,
      timestamp: Date.now(),
      status: 'Tom réfléchit…',
    };

    // Phase 5: Stream from Gemini
    const streamGenerator = geminiChatService.generateStreamChunks({
      userId: request.userId,
      content: enrichedContent,
      schoolLevel: request.schoolLevel,
      firstName: request.firstName,
      sessionId: sessionCtx.sessionId,
      userRole: request.userRole,
      pronoteContext: request.pronoteContext,
      cognitiveProfileSummary,
      learningContext,
      conversationSummary: sessionCtx.conversationSummary,
      conversationHistory: sessionCtx.formattedHistory,
      files: multimodalFiles.map(f => ({
        fileUri: f.fileUri,
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
      const session = await chatService.getSession(request.sessionId);
      if (!session || session.userId !== request.userId) {
        throw new ChatOrchestrationError('Session not found or access denied', 403);
      }
      sessionId = request.sessionId;
    } else {
      sessionId = await chatService.getOrCreateActiveSession(request.userId);
    }

    const sessionSummary = await chatService.getSessionWithSummary(sessionId);

    const sessionHistory = await chatService.getSessionHistory(sessionId, {
      limit: 20,
      afterMessageId: sessionSummary?.summaryUpToMessageId ?? undefined,
    });

    const formattedHistory = sessionHistory
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .map(msg => {
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
          attachedFile: attachedFile?.geminiFileId
            ? { geminiFileId: attachedFile.geminiFileId, mimeType: attachedFile.mimeType }
            : null,
        };
      });

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
    chunk: GeminiStreamChunk;
    startTime: number;
    attachedFileInfo: {
      fileName: string;
      fileId?: string;
      geminiFileId?: string;
      mimeType?: string;
      fileSizeBytes?: number;
    } | null;
  }): Promise<void> {
    const { sessionId, userId, userContent, fullContent, chunk, startTime, attachedFileInfo } = params;
    const tokensUsed = chunk.usage?.totalTokens ?? 0;

    await chatService.saveMessage(sessionId, 'assistant', fullContent, {
      aiModel: chunk.model,
      tokensUsed,
      responseTimeMs: Date.now() - startTime,
      ...(attachedFileInfo && { attachedFile: attachedFileInfo }),
    });

    if (tokensUsed > 0) {
      await tokenQuotaService.incrementTokenUsage(userId, tokensUsed);
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
