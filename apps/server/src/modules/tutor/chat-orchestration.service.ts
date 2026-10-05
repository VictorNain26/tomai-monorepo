/**
 * Chat turn pipeline: resolves the session and its history, assembles the turn's context (files,
 * profile, learning context, turn analysis, exercise sheet, episodic and subject memory),
 * persists the student's message before streaming, then records the answer, its cost, the
 * summary and the title once the stream ends (`finishTurn`).
 */

import { chatSessionService } from './chat-session.service.js';
import { chatMessageService } from './chat-message.service.js';
import { studySessionsRepository } from './study-sessions.repository.js';
import { resolveEffectiveSubject, shouldPersistDetectedSubject } from './subject-resolution.js';
import { STUDENT_SUBJECTS } from './prompts/adaptation/subjects.js';
import { fileContextService, sessionFilesRepository } from '../documents/index.js';
import { getLearningContext, wrapAttachedFiles } from './mistral-helpers.js';
import { summarizationService } from './summarization.service.js';
import { autoTitleService } from './auto-title.service.js';
import { analyseTurn, turnInstruction as instructionFor } from './turn-analysis.service.js';
import { prepareExerciseTurn } from './exercise-turn.js';
import { hintOf } from './hint-ladder.js';
import type { ChatTurnContext, FinishTurnParams, PersistUserTurnParams, PrepareTurnRequest } from './chat-turn.types.js';
import { exerciseSheetsRepository } from './exercise-sheets.repository.js';
import { cognitiveProfileService } from './cognitive-profile.service.js';
import { costTrackingService, incrementTokenUsage } from '../billing/index.js';
import { episodicMemoryService } from './episodic-memory.service.js';
import { subjectProfileService } from './subject-profile.service.js';
import { logger } from '../../platform/observability/logger.js';
import { replayable, type HistoryTurn, type ResponseMessage } from './chat-message-assembler.js';
import { messagesRepository } from './messages.repository.js';

/**
 * An assistant message's stored response messages, replayed as they are; an unreadable or
 * unreplayable value is logged and the message replays as its text.
 */
export function readStoredResponseMessages(value: unknown, messageId: string): ResponseMessage[] | undefined {
  if (value === null || value === undefined) return undefined;
  const messages = replayable(value);
  if (!messages) {
    logger.error('Stored model messages unreadable, replayed as text', {
      operation: 'chat-orchestration:model-messages-invalid',
      messageId,
      severity: 'high' as const,
    });
  }
  return messages;
}

class ChatOrchestrationService {
  /**
   * Resolves (or creates) the session, loads its history and summary, then assembles the turn's
   * context. Throws `ChatOrchestrationError` when the given session is missing or someone else's.
   */
  async prepareTurn(request: PrepareTurnRequest): Promise<ChatTurnContext> {
    let sessionId: string;

    if (request.sessionId?.trim()) {
      const session = await chatSessionService.getSession(request.sessionId);
      if (session?.userId !== request.userId) {
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

    const window = sessionHistory.filter(msg => msg.role === 'user' || msg.role === 'assistant');
    const stored = new Map((await messagesRepository.findModelMessages(window.filter(msg => msg.role === 'assistant').map(msg => msg.id)))
      .map(row => [row.id, row.modelMessages]));
    const conversationHistory = window.map((msg): HistoryTurn => {
      const modelMessages = readStoredResponseMessages(stored.get(msg.id), msg.id);
      return {
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: msg.createdAt.toISOString(),
        ...(modelMessages && { modelMessages }),
      };
    });

    const lastTutorText = conversationHistory.findLast(turn => turn.role === 'assistant')?.content ?? null;

    // Context assembly (parallel) — the turn analysis and episodic
    // memory run alongside file/profile/learning context assembly so none
    // of them add end-to-end latency on the critical path. An analysis that
    // fails gives an empty analysis (logged at high severity in the service,
    // not a silent fallback); episodic memory returns [] on miss/error with
    // its own logging.
    const [
      fileContext,
      cognitiveProfileSummary,
      learningContext,
      turnAnalysis,
      relevantEpisodes,
    ] = await Promise.all([
      fileContextService.prepareFileContext({ fileIds: request.fileIds, userId: request.userId, sessionId }),
      cognitiveProfileService.getProfileSummary(request.userId),
      getLearningContext(request.userId),
      analyseTurn(request.content, lastTutorText),
      episodicMemoryService.retrieveRelevant(request.userId, request.content, 3),
    ]);

    const episodicContext = episodicMemoryService.formatEpisodesForPrompt(relevantEpisodes);

    // Subject: use the detected one (reliable) for the prompt, fall back to the
    // session's stored subject then the client hint. Persist on the first
    // confident detection (anti-thrash) so the conversation gets a real subject.
    const detectedSubject = turnAnalysis.subject;
    const requestedSubject =
      request.requestedSubject && (STUDENT_SUBJECTS as readonly string[]).includes(request.requestedSubject)
        ? request.requestedSubject
        : undefined;
    const effectiveSubject = resolveEffectiveSubject({
      detected: detectedSubject,
      sessionSubject: sessionSummary?.subject ?? null,
      requested: requestedSubject,
    });
    if (shouldPersistDetectedSubject({ detected: detectedSubject, sessionSubject: sessionSummary?.subject ?? null })) {
      void studySessionsRepository
        .updateSubject(sessionId, detectedSubject)
        .catch((err: unknown) => { logger.warn('Subject persist failed', {
          operation: 'chat-orchestration:subject-persist',
          sessionId,
          err: err,
        }); });
    }

    const { attachedFileInfos, files } = fileContext;
    const attachedFileInfo = attachedFileInfos[0] ?? null;
    const hasMultipleFiles = attachedFileInfos.length > 1;

    const [subjectMemoryBlock, exerciseTurn] = await Promise.all([
      effectiveSubject ? subjectProfileService.formatSubjectMemoryForPrompt(request.userId, effectiveSubject) : null,
      prepareExerciseTurn({
        userId: request.userId,
        sessionId,
        level: request.schoolLevel,
        subject: effectiveSubject,
        analysis: turnAnalysis,
        studentText: request.content,
        lastTutorText,
        attachedFilesBlock: files.length > 0 ? wrapAttachedFiles(files) : null,
      }),
    ]);
    const { exercise, diagnosis, hintLevel, contract, change } = exerciseTurn;
    const turnInstruction = contract ?? instructionFor(turnAnalysis);

    const mergedLearningContext = [learningContext, episodicContext, subjectMemoryBlock]
      .filter((x): x is string => Boolean(x))
      .join('\n\n') || null;

    logger.info('Chat context assembled', {
      userId: request.userId,
      subject: effectiveSubject,
      detectedSubject,
      sessionId,
      schoolLevel: request.schoolLevel,
      filesCount: request.fileIds.length,
      attachedTexts: files.length,
      proposesAnswer: turnAnalysis.proposesAnswer,
      bringsExercise: turnAnalysis.bringsExercise,
      asksSolution: turnAnalysis.asksSolution,
      wantsFlashcards: turnAnalysis.wantsFlashcards,
      turnInstructed: turnInstruction !== null,
      exerciseSheet: Boolean(exercise?.sheet),
      hintLevel,
      verdict: diagnosis?.verdict,
      episodesRetrieved: relevantEpisodes.length,
      operation: 'chat-orchestration:context-ready',
    });

    return {
      sessionId,
      ...(effectiveSubject !== undefined && { subject: effectiveSubject }),
      conversationSummary: sessionSummary?.conversationSummary ?? null,
      conversationHistory,
      cognitiveProfileSummary,
      mergedLearningContext,
      turnInstruction,
      turnAnalysis,
      exerciseSheet: exercise?.sheet ?? null,
      exerciseUncertain: exercise?.uncertain ?? false,
      exerciseProgress: exercise && hintLevel !== null && change ? { id: exercise.id, hintLevel, diagnosis, change } : null,
      fileIds: fileContext.fileIds,
      attachedFiles: files,
      attachedFileInfo,
      ...(hasMultipleFiles && { attachedFileInfos }),
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
   * Post-processing apres le streaming (branche sur `onEnd` du UI
   * Message Stream) : sauve le message assistant, comptabilise
   * tokens/cout, et declenche summarization + auto-titrage en
   * fire-and-forget. Miroir du `postProcess` du pipeline legacy — qui
   * n'etait invoque QUE sur un chunk `done` (jamais sur une erreur en
   * cours de stream). Si le stream n'a produit aucun texte, rien n'est
   * persiste, mais les tokens factures sont comptes.
   */
  async finishTurn(params: FinishTurnParams): Promise<void> {
    const { sessionId, userId, userContent, text: fullContent, modelMessages, aborted, model, usage, startTime, attachedFileInfo, attachedFileInfos, turnAnalysis, exerciseProgress, outputCheck } = params;
    const tokensUsed = usage?.totalTokens ?? 0;

    // A turn that reasoned without writing anything was billed all the same.
    if (tokensUsed > 0) {
      await incrementTokenUsage(userId, tokensUsed);

      await costTrackingService.record({
        userId,
        sessionId,
        aiModel: model,
        operation: 'chat',
        tokensInput: usage?.inputTokens ?? 0,
        tokensOutput: usage?.outputTokens ?? 0,
        cachedTokens: usage?.inputTokenDetails.cacheReadTokens ?? 0,
      });
    }

    if (fullContent.length === 0) {
      logger.warn('Streaming produced no content, skipping persistence', {
        userId,
        sessionId,
        tokensUsed,
        operation: 'chat-orchestration:empty-response',
      });
      return;
    }

    await chatMessageService.saveMessage(sessionId, 'assistant', fullContent, {
      aiModel: model,
      tokensUsed,
      responseTimeMs: Date.now() - startTime,
      ...(attachedFileInfo && { attachedFile: attachedFileInfo }),
      ...(attachedFileInfos && { attachedFiles: attachedFileInfos }),
      turnAnalysis,
      ...(exerciseProgress && { exerciseTurn: { diagnosis: exerciseProgress.diagnosis, hintLevel: exerciseProgress.hintLevel } }),
      ...(outputCheck && { outputCheck }),
      // Kept only when they can be replayed as they are: a cut turn, or one that ended on a tool
      // result at the step limit, replays as its text.
      modelMessages: aborted ? undefined : replayable(modelMessages),
      cut: aborted,
    }, { verifySessionExists: false });

    // The turn's change on the exercise counts once the student has seen the answer: a cut or
    // empty turn moves nothing.
    if (exerciseProgress?.id && !aborted) {
      void exerciseSheetsRepository
        .recordTurn(exerciseProgress.id, { ...exerciseProgress.change, hint: hintOf(exerciseProgress.hintLevel, fullContent) })
        .catch((err: unknown) => { logger.error('Exercise turn not stored', { sessionId, err, operation: 'chat-orchestration:exercise', severity: 'medium' as const }); });
    }

    logger.info('Streaming message saved', {
      userId,
      sessionId,
      tokensUsed,
      model,
      responseTimeMs: Date.now() - startTime,
      operation: 'chat-orchestration:save',
    });

    summarizationService.summarizeIfNeeded(sessionId).catch((err: unknown) => {
      logger.error('Background summarization failed', {
        err: err,
        sessionId,
        operation: 'chat-orchestration:summarization-bg',
        severity: 'low' as const,
      });
    });

    // A cut answer is no ground for a title.
    if (aborted) return;
    autoTitleService.generateTitleIfNeeded(sessionId, userContent, fullContent).catch((err: unknown) => {
      logger.warn('Background auto-title failed', {
        err: err,
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
