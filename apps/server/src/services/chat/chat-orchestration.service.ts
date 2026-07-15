/**
 * ChatOrchestrationService - Pipeline chat streaming (AI SDK)
 *
 * Responsabilites:
 * 1. Resoudre/creer la session + charger historique + resume
 * 2. Assembler le contexte enrichi (fichiers multimodaux, profil cognitif,
 *    contexte d'apprentissage, classification d'intention, memoire
 *    episodique, memoire de matiere) exactement comme le pipeline SSE legacy
 * 3. Persister le message user AVANT le streaming (+ associer les fichiers)
 * 4. Post-processing apres le streaming (`onFinish`) : sauver le message
 *    assistant, comptabiliser tokens/cout, declencher summarization et
 *    auto-titrage en fire-and-forget — SAUTE entierement si le stream n'a
 *    produit aucun contenu (miroir du pipeline legacy, qui ne postProcess
 *    que sur un chunk `done`, jamais sur une erreur en cours de stream).
 */

import { chatSessionService } from './chat-session.service.js';
import { chatMessageService } from './chat-message.service.js';
import { sessionFilesRepository, studySessionsRepository } from '../../db/repositories/index.js';
import { resolveEffectiveSubject, shouldPersistDetectedSubject } from './subject-resolution.js';
import { STUDENT_SUBJECTS } from '../../config/prompts/adaptation/subjects.js';
import { fileContextService } from './file-context.service.js';
import { getLearningContext } from './mistral-helpers.js';
import { summarizationService } from './summarization.service.js';
import { autoTitleService } from './auto-title.service.js';
import { intentClassifierService, type ClassifiedIntent } from './intent-classifier.service.js';
import { cognitiveProfileService } from '../cognitive-profile.service.js';
import { costTrackingService } from '../cost-tracking.service.js';
import { episodicMemoryService } from '../episodic-memory.service.js';
import { subjectProfileService } from './subject-profile.service.js';
import { tokenQuotaService } from '../token-quota.service.js';
import { logger } from '../../lib/observability.js';
import { extractTextFromParts, type TomChatMessage } from './chat-ui-message.js';
import type { LanguageModelUsage } from 'ai';
import type { EducationLevelType } from '../../types/index.js';
import type { AttachedFile } from './ai-chat.service.js';
import type { AttachedFileInfo, AttachedFileForPrompt } from './file-context-types.js';

const MAX_ENRICHED_CONTENT_CHARS = 50_000;

interface PrepareTurnRequest {
  userId: string;
  sessionId?: string;
  requestedSubject?: string;
  content: string;
  fileIds: string[];
  schoolLevel: EducationLevelType;
}

/** @public — reachable only via Eden Treaty's inferred route return types (apps/server build:types), not a direct import; knip false positive. */
export interface ChatTurnContext {
  sessionId: string;
  subject?: string;
  conversationSummary: string | null;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  cognitiveProfileSummary: string | null;
  /** Learning context (FSRS due cards) + episodic memory + subject memory, merged into one block. */
  mergedLearningContext: string | null;
  intentReinforcement: string | null;
  classifiedIntent: ClassifiedIntent;
  /** Multimodal files (images) for Mistral vision, ready for `streamChat`'s `files` param. */
  files: AttachedFile[];
  /** Bounded document analyses (OCR), ready for `streamChat`'s `attachedFiles` param. */
  attachedFiles: AttachedFileForPrompt[];
  attachedFileInfo: AttachedFileInfo | null;
  attachedFileInfos?: AttachedFileInfo[];
}

interface PersistUserTurnParams {
  sessionId: string;
  content: string;
  inputMode?: 'text' | 'voice';
  fileIds: string[];
  attachedFileInfo: AttachedFileInfo | null;
  attachedFileInfos?: AttachedFileInfo[];
}

interface FinishTurnParams {
  sessionId: string;
  userId: string;
  userContent: string;
  responseMessage: TomChatMessage;
  model: string;
  usage: LanguageModelUsage | undefined;
  startTime: number;
  attachedFileInfo: AttachedFileInfo | null;
  attachedFileInfos?: AttachedFileInfo[];
  classifiedIntent: ClassifiedIntent;
}

class ChatOrchestrationService {
  /**
   * Resout (ou cree) la session, charge historique + resume, puis assemble
   * le contexte enrichi (fichiers, profil cognitif, learning, intention,
   * memoire episodique/matiere) exactement comme le pipeline SSE legacy
   * (`orchestrateStream` Phases 1-2). Jette `ChatOrchestrationError` si le
   * `sessionId` fourni n'existe pas ou n'appartient pas a l'utilisateur.
   */
  async prepareTurn(request: PrepareTurnRequest): Promise<ChatTurnContext> {
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

    // Context assembly (parallel) — intent classification and episodic
    // memory run alongside file/profile/learning context assembly so none
    // of them add end-to-end latency on the critical path. Classification
    // failures fall back to intent='unknown' (logged at high severity in
    // the service, not a silent fallback); episodic memory returns [] on
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
        sessionId,
      }),
      fileContextService.prepareMultimodalFiles(request.fileIds),
      cognitiveProfileService.getProfileSummary(request.userId),
      getLearningContext(request.userId),
      intentClassifierService.classify(request.content, request.schoolLevel),
      episodicMemoryService.retrieveRelevant(request.userId, request.content, 3),
    ]);

    const intentReinforcement = intentClassifierService.buildReinforcement(classifiedIntent);
    const episodicContext = episodicMemoryService.formatEpisodesForPrompt(relevantEpisodes);

    // Subject: use the detected one (reliable) for the prompt, fall back to the
    // session's stored subject then the client hint. Persist on the first
    // confident detection (anti-thrash) so the conversation gets a real subject.
    const detectedSubject = classifiedIntent.subject;
    const requestedSubject =
      request.requestedSubject && (STUDENT_SUBJECTS as readonly string[]).includes(request.requestedSubject)
        ? request.requestedSubject
        : undefined;
    const effectiveSubject = resolveEffectiveSubject({
      detected: detectedSubject,
      sessionSubject: sessionSummary?.subject ?? null,
      requested: requestedSubject,
    });
    if (detectedSubject && shouldPersistDetectedSubject({ detected: detectedSubject, sessionSubject: sessionSummary?.subject ?? null })) {
      void studySessionsRepository
        .updateSubject(sessionId, detectedSubject)
        .catch(err => logger.warn('Subject persist failed', {
          operation: 'chat-orchestration:subject-persist',
          sessionId,
          _error: err instanceof Error ? err.message : String(err),
        }));
    }

    const subjectMemoryBlock = effectiveSubject
      ? await subjectProfileService.formatSubjectMemoryForPrompt(request.userId, effectiveSubject)
      : null;

    const { attachedFileInfos, attachedFiles } = fileContext;
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

    const mergedLearningContext = [learningContext, episodicContext, subjectMemoryBlock]
      .filter((x): x is string => Boolean(x))
      .join('\n\n') || null;

    logger.info('Chat context assembled', {
      userId: request.userId,
      subject: effectiveSubject,
      detectedSubject,
      sessionId,
      level: request.schoolLevel,
      filesCount: request.fileIds.length,
      multimodalFilesCount: multimodalFiles.length,
      intent: classifiedIntent.intent,
      intentConfidence: classifiedIntent.confidence,
      intentReinforced: intentReinforcement !== null,
      episodesRetrieved: relevantEpisodes.length,
      operation: 'chat-orchestration:context-ready',
    });

    return {
      sessionId,
      subject: effectiveSubject,
      conversationSummary: sessionSummary?.conversationSummary ?? null,
      conversationHistory,
      cognitiveProfileSummary,
      mergedLearningContext,
      intentReinforcement,
      classifiedIntent,
      files: multimodalFiles.map(f => ({
        base64: f.base64,
        mimeType: f.mimeType,
        contentType: f.contentType,
      })),
      attachedFiles: boundedAttachedFiles,
      attachedFileInfo,
      attachedFileInfos: hasMultipleFiles ? attachedFileInfos : undefined,
    };
  }

  /**
   * Persiste le message utilisateur AVANT le streaming et associe les
   * fichiers a la session (comportement inchange vis-a-vis du pipeline
   * legacy).
   */
  async persistUserTurn(params: PersistUserTurnParams): Promise<void> {
    await chatMessageService.saveMessage(
      params.sessionId,
      'user',
      params.content,
      {
        ...(params.attachedFileInfo && {
          attachedFile: params.attachedFileInfo,
          ...(params.attachedFileInfos && { attachedFiles: params.attachedFileInfos }),
        }),
        ...(params.inputMode && { inputMode: params.inputMode }),
      },
      { verifySessionExists: false },
    );

    if (params.fileIds.length > 0) {
      await Promise.all(
        params.fileIds.map(fId => sessionFilesRepository.attach(params.sessionId, fId)),
      );
    }
  }

  /**
   * Post-processing apres le streaming (branche sur `onFinish` du UI
   * Message Stream) : sauve le message assistant, comptabilise
   * tokens/cout, et declenche summarization + auto-titrage en
   * fire-and-forget. Miroir du `postProcess` du pipeline legacy — qui
   * n'etait invoque QUE sur un chunk `done` (jamais sur une erreur en
   * cours de stream). Ici, meme garde : si le stream n'a produit aucun
   * contenu, on ne persiste rien et on ne compte ni tokens ni cout.
   */
  async finishTurn(params: FinishTurnParams): Promise<void> {
    const { sessionId, userId, userContent, responseMessage, model, usage, startTime, attachedFileInfo, attachedFileInfos, classifiedIntent } = params;
    const fullContent = extractTextFromParts(responseMessage.parts);

    if (fullContent.length === 0) {
      logger.warn('Streaming produced no content, skipping persistence', {
        userId,
        sessionId,
        operation: 'chat-orchestration:empty-response',
      });
      return;
    }

    const tokensUsed = usage?.totalTokens ?? 0;

    await chatMessageService.saveMessage(sessionId, 'assistant', fullContent, {
      aiModel: model,
      tokensUsed,
      responseTimeMs: Date.now() - startTime,
      ...(attachedFileInfo && { attachedFile: attachedFileInfo }),
      ...(attachedFileInfos && { attachedFiles: attachedFileInfos }),
      ...(classifiedIntent && { classifiedIntent }),
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
