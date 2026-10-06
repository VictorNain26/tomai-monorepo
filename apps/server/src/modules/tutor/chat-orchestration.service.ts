/**
 * Chat turn pipeline: resolves the session and its history, assembles the turn's context (files,
 * turn analysis, moderation, exercise sheet), persists the student's message before streaming, then records the answer, its cost, the
 * summary and the title once the stream ends (`finishTurn`).
 */

import { chatSessionService } from './chat-session.service.js';
import { chatMessageService } from './chat-message.service.js';
import { studySessionsRepository } from './study-sessions.repository.js';
import { resolveEffectiveSubject, shouldPersistDetectedSubject } from './subject-resolution.js';
import { SUBJECTS } from '../../lib/subjects.js';
import { fileContextService, sessionFilesRepository } from '../documents/index.js';
import { wrapAttachedFiles } from './mistral-helpers.js';
import { SUMMARY_BACKLOG, summarizationService } from './summarization.service.js';
import { autoTitleService } from './auto-title.service.js';
import { analyseTurn, turnInstruction as instructionFor } from './turn-analysis.service.js';
import { prepareExerciseTurn } from './exercise-turn.js';
import { currentExercise } from './exercise-sheet.service.js';
import { hintOf } from './hint-ladder.js';
import type { ChatTurnContext, DistressTurn, FinishTurnParams, PersistUserTurnParams, PrepareTurnRequest } from './chat-turn.types.js';
import { detectDistress } from './distress.js';
import { closedForDistress } from './distress.service.js';
import { moderateStudentTurn, type InputModeration } from '../../platform/ai/moderation.js';
import { exerciseSheetsRepository } from './exercise-sheets.repository.js';
import { incrementTokenUsage } from '../billing/index.js';
import { recordAiCost } from '../../platform/ai/cost.js';
import { structuredUsage } from '../../platform/ai/usage.js';
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

/**
 * The student's message moderated: undefined when it has no text, null when moderation could not
 * answer, the rules then judging distress alone.
 */
async function moderateInput(lastTutorText: string | null, studentText: string): Promise<InputModeration | null | undefined> {
  if (!studentText.trim()) return undefined;
  try {
    return await moderateStudentTurn(lastTutorText, studentText);
  } catch (err) {
    logger.error('Input moderation unavailable, distress judged by the rules alone', { operation: 'moderation:input-error', err, severity: 'high' as const });
    return null;
  }
}

/** Distress in the student's message, and who saw it; null when neither moderation nor the rules did. */
function distressIn(sessionId: string, content: string, moderation: InputModeration | null | undefined): DistressTurn | null {
  const source = detectDistress(content, moderation?.flagged.includes('selfharm') ?? false);
  return source ? { kind: 'distress', sessionId, source, selfharmScore: moderation?.selfharmScore ?? null } : null;
}

const closedTurn = (sessionId: string): DistressTurn => ({ kind: 'distress', sessionId, source: 'closed', selfharmScore: null });

/** The given session when it is the student's (else `ChatOrchestrationError`), or their active one. */
async function resolveSession(request: Pick<PrepareTurnRequest, 'userId' | 'sessionId'>): Promise<string> {
  if (!request.sessionId?.trim()) return chatSessionService.getOrCreateActiveSession(request.userId);
  const session = await chatSessionService.getSession(request.sessionId);
  if (session?.userId !== request.userId) {
    throw new ChatOrchestrationError('Session not found or access denied', 403);
  }
  return request.sessionId;
}

class ChatOrchestrationService {
  /**
   * Distress alone, for a request the route refuses (quota, concurrent streams, level): the
   * fixed reply calls no model, so no limit keeps it from the student.
   */
  async screenDistress(request: Pick<PrepareTurnRequest, 'userId' | 'sessionId' | 'content'>): Promise<DistressTurn | null> {
    const sessionId = await resolveSession(request);
    if (await closedForDistress(sessionId)) return closedTurn(sessionId);
    const history = await chatMessageService.getSessionHistory(sessionId, { limit: 20 });
    const lastTutorText = history.findLast(msg => msg.role === 'assistant')?.content ?? null;
    return distressIn(sessionId, request.content, await moderateInput(lastTutorText, request.content));
  }

  /**
   * Resolves (or creates) the session, loads its history and summary, then assembles the turn's
   * context. Throws `ChatOrchestrationError` when the given session is missing or someone else's.
   */
  async prepareTurn(request: PrepareTurnRequest): Promise<ChatTurnContext | DistressTurn> {
    const sessionId = await resolveSession(request);
    const [closed, sessionSummary, current] = await Promise.all([
      closedForDistress(sessionId),
      chatSessionService.getSessionWithSummary(sessionId),
      currentExercise(sessionId),
    ]);
    // The conversation stopped at a distress: any later message gets the fixed reply again.
    if (closed) return closedTurn(sessionId);

    const sessionHistory = await chatMessageService.getSessionHistory(sessionId, {
      // Room past the summary's backlog: a run late or failed drops nothing from the context.
      limit: SUMMARY_BACKLOG + 10,
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

    // Files, the turn analysis and the moderation run alongside, none adding to the wait. An
    // analysis that fails gives an empty analysis, logged at high severity in the service.
    const [fileContext, turnAnalysis, inputModeration] = await Promise.all([
      fileContextService.prepareFileContext({ fileIds: request.fileIds, userId: request.userId, sessionId }),
      analyseTurn(request.content, lastTutorText, current?.sheet?.statement ?? null, { userId: request.userId, sessionId }),
      moderateInput(lastTutorText, request.content),
    ]);

    // Distress before anything else: no sheet, no tutor, the fixed reply. The turn analysis,
    // run alongside so moderation adds no wait to every turn, is dropped.
    const distress = distressIn(sessionId, request.content, inputModeration);
    if (distress) return distress;

    // Subject: use the detected one (reliable) for the prompt, fall back to the
    // session's stored subject then the client hint. Persist on the first
    // confident detection (anti-thrash) so the conversation gets a real subject.
    const detectedSubject = turnAnalysis.subject;
    const effectiveSubject = resolveEffectiveSubject({
      detected: detectedSubject,
      sessionSubject: sessionSummary?.subject ?? null,
      requested: request.requestedSubject && SUBJECTS[request.requestedSubject].family,
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

    const { exercise, diagnosis, hintLevel, contract, change } = await prepareExerciseTurn({
      userId: request.userId,
      sessionId,
      level: request.schoolLevel,
      subject: effectiveSubject,
      analysis: turnAnalysis,
      current,
      studentText: request.content,
      lastTutorText,
      attachedFilesBlock: files.length > 0 ? wrapAttachedFiles(files) : null,
    });
    const turnInstruction = contract ?? instructionFor(turnAnalysis);

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
      operation: 'chat-orchestration:context-ready',
    });

    return {
      kind: 'tutor',
      ...(inputModeration !== undefined && { inputModeration: inputModeration?.flagged ?? null }),
      sessionId,
      ...(effectiveSubject !== undefined && { subject: effectiveSubject }),
      conversationSummary: sessionSummary?.conversationSummary ?? null,
      conversationHistory,
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
        ...(params.inputModeration !== undefined && { inputModeration: params.inputModeration }),
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
    const { sessionId, userId, userContent, text: fullContent, modelMessages, aborted, model, usage, startTime, attachedFileInfo, attachedFileInfos, turnAnalysis, exerciseProgress, outputCheck, check } = params;
    const tokensUsed = usage?.totalTokens ?? 0;

    // A turn that reasoned without writing anything was billed all the same.
    if (tokensUsed > 0) {
      await Promise.all([
        incrementTokenUsage(userId, tokensUsed),
        recordAiCost({ userId, sessionId }, { model, operation: 'chat', ...structuredUsage(usage) }),
      ]);
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
    autoTitleService.generateTitleIfNeeded(sessionId, userContent, fullContent, check).catch((err: unknown) => {
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
