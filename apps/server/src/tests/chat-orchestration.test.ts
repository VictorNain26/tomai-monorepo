/**
 * Tests — ChatOrchestrationService (modules/tutor/chat-orchestration.service.ts): the exercise
 * sheet of `prepareTurn`, and `finishTurn`, which persists nothing and counts no tokens when the
 * stream produced no content.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';
import { analysis } from './_helpers/turn-analysis';
import { noExercise } from './_helpers/output-check';
import type { ExerciseSheet } from '../modules/tutor/exercise-sheet';

// ============================================
// MOCKS (must be before any import of the real module under test)
// ============================================

const mockLogger = createMockLogger();
mock.module('../platform/observability/logger', () => ({ logger: mockLogger }));

mock.module('../modules/tutor/chat-session.service', () => ({
  chatSessionService: {
    getSession: mock(async () => null),
    getOrCreateActiveSession: mock(async () => 'session-001'),
    getSessionWithSummary: mock(async () => null),
  },
}));

const saveMessage = mock(
  async (
    _sessionId: string,
    _role: 'user' | 'assistant',
    _content: string,
    _metadata?: unknown,
    _options?: unknown,
  ) => ({ messageId: 'msg-1', realSessionId: 'session-001' }),
);
mock.module('../modules/tutor/chat-message.service', () => ({
  chatMessageService: { saveMessage, getSessionHistory: mock(async () => []) },
}));

mock.module('../modules/tutor/study-sessions.repository', () => ({
  studySessionsRepository: { updateSubject: mock(async () => {}) },
}));

interface Texts { fileIds: string[]; attachedFileInfos: { fileName: string; fileId: string }[]; files: { fileId: string; fileName: string; text: string }[] }
const prepareFileContext = mock(async (): Promise<Texts> => ({ fileIds: [], attachedFileInfos: [], files: [] }));
mock.module('../modules/documents/index', () => ({
  sessionFilesRepository: { attach: mock(async () => {}) },
  fileContextService: { prepareFileContext },
}));

const actualMistralHelpers = await import('../modules/tutor/mistral-helpers');
mock.module('../modules/tutor/mistral-helpers', () => ({
  ...actualMistralHelpers,
  getLearningContext: mock(async () => null),
}));

const summarizeIfNeeded = mock(async () => {});
mock.module('../modules/tutor/summarization.service', () => ({
  summarizationService: { summarizeIfNeeded },
}));

const generateTitleIfNeeded = mock(async () => {});
mock.module('../modules/tutor/auto-title.service', () => ({
  autoTitleService: { generateTitleIfNeeded },
}));

const analyseTurn = mock(async () => analysis());
const turnInstruction = mock((): string | null => null);
mock.module('../modules/tutor/turn-analysis.service', () => ({
  analyseTurn,
  turnInstruction,
}));

mock.module('../modules/tutor/cognitive-profile.service', () => ({
  cognitiveProfileService: { getProfileSummary: mock(async () => null) },
}));

const record = mock(async () => {});
const incrementTokenUsage = mock(async () => {});
mock.module('../modules/billing/index', () => ({
  costTrackingService: { record },
  incrementTokenUsage,
}));

mock.module('../modules/tutor/episodic-memory.service', () => ({
  episodicMemoryService: {
    retrieveRelevant: mock(async () => []),
    formatEpisodesForPrompt: mock(() => null),
  },
}));

mock.module('../modules/tutor/subject-profile.service', () => ({
  subjectProfileService: { formatSubjectMemoryForPrompt: mock(async () => null) },
}));

const sheet = (statement: string): ExerciseSheet => ({
  statement, kind: 'short', answer: '5', answerForms: ['5'], mathEquation: null, mathAnswer: '5', steps: [], commonErrors: [],
  rule: null, facts: [], expectedElements: [], entries: [], laterEntries: [],
});
interface Change { levelChange: number; top: number; stepDone: boolean; solved: boolean | undefined }
interface Turn {
  exercise: { id: string | null; sheet: ExerciseSheet | null; uncertain: boolean; hintLevel: number; stepsDone: number; hints: { level: number; text: string }[]; solved: boolean } | null;
  diagnosis: null;
  hintLevel: number | null;
  contract: string | null;
  change: Change | null;
}
const prepareExerciseTurn = mock(async (_params: unknown): Promise<Turn> => ({ exercise: null, diagnosis: null, hintLevel: null, contract: null, change: null }));
mock.module('../modules/tutor/exercise-turn', () => ({ prepareExerciseTurn }));
const recordTurn = mock(async (_id: string, _turn: unknown) => {});
mock.module('../modules/tutor/exercise-sheets.repository', () => ({ exerciseSheetsRepository: { recordTurn } }));

// Import the real module under test AFTER all mocks are registered.
const { chatOrchestrationService, readStoredResponseMessages } = await import('../modules/tutor/chat-orchestration.service');

describe('ChatOrchestrationService.prepareTurn — exercise', () => {
  beforeEach(() => {
    prepareExerciseTurn.mockClear();
  });

  const request = { userId: 'user-001', content: 'Résous 3x + 5 = 20.', fileIds: [], schoolLevel: 'quatrieme' as const };
  const underContract: Turn = {
    exercise: { id: 'ex-1', sheet: sheet('Résous 3x + 5 = 20.'), uncertain: false, hintLevel: 1, stepsDone: 0, hints: [{ level: 0, text: 'Que cherches-tu ?' }], solved: false },
    diagnosis: null,
    hintLevel: 2,
    contract: '<contrat>\nPalier 3\n</contrat>',
    change: { levelChange: 1, top: 4, stepDone: false, solved: false },
  };

  it('hands the exercise turn the class, the detected subject, the message, the last tutor message and the files', async () => {
    analyseTurn.mockImplementationOnce(async () => analysis({ bringsExercise: true, subject: 'mathematiques' }));
    prepareFileContext.mockImplementationOnce(async () => ({
      fileIds: ['f2'],
      attachedFileInfos: [{ fileName: 'photo.jpg', fileId: 'f2' }],
      files: [{ fileId: 'f1', fileName: 'cours.pdf', text: 'Le cours' }, { fileId: 'f2', fileName: 'photo.jpg', text: 'Résous 3x + 5 = 20.' }],
    }));

    const context = await chatOrchestrationService.prepareTurn({ ...request, fileIds: ['f2', 'someone-elses'] });

    expect(prepareExerciseTurn.mock.calls[0]?.[0]).toMatchObject({
      userId: 'user-001',
      sessionId: 'session-001',
      level: 'quatrieme',
      subject: 'mathematiques',
      studentText: 'Résous 3x + 5 = 20.',
      lastTutorText: null,
      attachedFilesBlock: '<attached_file name="cours.pdf">\nLe cours\n</attached_file>\n\n<attached_file name="photo.jpg">\nRésous 3x + 5 = 20.\n</attached_file>',
    });
    expect(context.attachedFiles.map((file) => file.fileId)).toEqual(['f1', 'f2']);
    expect(context.fileIds).toEqual(['f2']);
  });

  it("follows the exercise's contract instead of the turn instruction, and keeps the progress for finishTurn", async () => {
    prepareExerciseTurn.mockImplementationOnce(async () => underContract);
    turnInstruction.mockImplementationOnce(() => '<critical_instruction>X</critical_instruction>');

    const context = await chatOrchestrationService.prepareTurn(request);

    expect(context.turnInstruction).toBe('<contrat>\nPalier 3\n</contrat>');
    expect(context.exerciseSheet?.statement).toBe('Résous 3x + 5 = 20.');
    expect(context.exerciseProgress).toEqual({ id: 'ex-1', hintLevel: 2, diagnosis: null, change: { levelChange: 1, top: 4, stepDone: false, solved: false } });
  });

  it('keeps the turn instruction and no progress without a contract', async () => {
    turnInstruction.mockImplementationOnce(() => '<critical_instruction>X</critical_instruction>');

    const context = await chatOrchestrationService.prepareTurn(request);

    expect(context.turnInstruction).toBe('<critical_instruction>X</critical_instruction>');
    expect(context.exerciseSheet).toBeNull();
    expect(context.exerciseProgress).toBeNull();
  });
});

describe('ChatOrchestrationService.finishTurn', () => {
  beforeEach(() => {
    saveMessage.mockClear();
    incrementTokenUsage.mockClear();
    record.mockClear();
    summarizeIfNeeded.mockClear();
    generateTitleIfNeeded.mockClear();
  });

  const noopAnalysis = analysis();

  it('skips persistence entirely when the stream produced no content', async () => {
    await chatOrchestrationService.finishTurn({
      sessionId: 'session-001',
      userId: 'user-001',
      userContent: 'Bonjour',
      text: '',
      model: 'mistral-small-2603',
      usage: undefined,
      startTime: Date.now(),
      attachedFileInfo: null,
      turnAnalysis: noopAnalysis,
      check: noExercise,
    });

    expect(saveMessage).not.toHaveBeenCalled();
    expect(incrementTokenUsage).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
    expect(summarizeIfNeeded).not.toHaveBeenCalled();
    expect(generateTitleIfNeeded).not.toHaveBeenCalled();
  });

  it('counts the tokens of a turn that reasoned without writing, and persists nothing', async () => {
    await chatOrchestrationService.finishTurn({
      sessionId: 'session-001',
      userId: 'user-001',
      userContent: 'Bonjour',
      text: '',
      model: 'mistral-small-2603',
      usage: {
        inputTokens: 10,
        outputTokens: 900,
        totalTokens: 910,
        inputTokenDetails: { noCacheTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0 },
        outputTokenDetails: { textTokens: 0, reasoningTokens: 900 },
      },
      startTime: Date.now(),
      attachedFileInfo: null,
      turnAnalysis: noopAnalysis,
      check: noExercise,
    });

    expect(incrementTokenUsage).toHaveBeenCalledWith('user-001', 910);
    expect(record).toHaveBeenCalledTimes(1);
    expect(saveMessage).not.toHaveBeenCalled();
    expect(summarizeIfNeeded).not.toHaveBeenCalled();
  });

  it('does not keep response messages it could not replay: a cut turn, or one ending on a tool result', async () => {
    const toolEnding = [
      { role: 'assistant' as const, content: [{ type: 'tool-call' as const, toolCallId: 't1', toolName: 'generate_flashcards', input: {} }] },
      { role: 'tool' as const, content: [{ type: 'tool-result' as const, toolCallId: 't1', toolName: 'generate_flashcards', output: { type: 'json' as const, value: {} } }] },
    ];
    const reply = [{ role: 'assistant' as const, content: [{ type: 'text' as const, text: 'Bonjour à toi' }] }];
    for (const [modelMessages, aborted] of [[toolEnding, false], [reply, true]] as const) {
      saveMessage.mockClear();
      await chatOrchestrationService.finishTurn({
        sessionId: 'session-001',
        userId: 'user-001',
        userContent: 'Bonjour',
        text: 'Bonjour à toi',
        modelMessages: [...modelMessages],
        aborted,
        model: 'mistral-small-2603',
        usage: undefined,
        startTime: Date.now(),
        attachedFileInfo: null,
        turnAnalysis: noopAnalysis,
      check: noExercise,
      });
      expect(saveMessage.mock.calls[0]?.[2]).toBe('Bonjour à toi');
      expect((saveMessage.mock.calls[0]?.[3] as Record<string, unknown> | undefined)?.['modelMessages']).toBeUndefined();
    }
  });

  it('stores the response messages as the model produced them, to replay them next turn', async () => {
    const modelMessages = [{ role: 'assistant' as const, content: [{ type: 'reasoning' as const, text: 'raisonnement' }, { type: 'text' as const, text: 'Bonjour à toi' }] }];
    await chatOrchestrationService.finishTurn({
      sessionId: 'session-001',
      userId: 'user-001',
      userContent: 'Bonjour',
      text: 'Bonjour à toi',
      modelMessages,
      model: 'mistral-small-2603',
      usage: undefined,
      startTime: Date.now(),
      attachedFileInfo: null,
      turnAnalysis: noopAnalysis,
      check: noExercise,
    });

    expect(saveMessage.mock.calls[0]?.[2]).toBe('Bonjour à toi');
    expect((saveMessage.mock.calls[0]?.[3] as Record<string, unknown> | undefined)?.['modelMessages']).toEqual(modelMessages);
  });

  it('persists the assistant message and accounts tokens when content was produced', async () => {
    await chatOrchestrationService.finishTurn({
      sessionId: 'session-001',
      userId: 'user-001',
      userContent: 'Bonjour',
      text: 'Bonjour à toi',
      model: 'mistral-small-2603',
      usage: {
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        inputTokenDetails: { noCacheTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0 },
        outputTokenDetails: { textTokens: 5, reasoningTokens: 0 },
      },
      startTime: Date.now(),
      attachedFileInfo: null,
      turnAnalysis: noopAnalysis,
      check: noExercise,
    });

    expect(saveMessage).toHaveBeenCalledTimes(1);
    expect(saveMessage.mock.calls[0]?.[1]).toBe('assistant');
    expect(saveMessage.mock.calls[0]?.[2]).toBe('Bonjour à toi');
    expect((saveMessage.mock.calls[0]?.[3] as Record<string, unknown> | undefined)?.['modelMessages']).toBeUndefined();
    expect(incrementTokenUsage).toHaveBeenCalledWith('user-001', 15);
    expect(record).toHaveBeenCalledTimes(1);
    expect(summarizeIfNeeded).toHaveBeenCalledWith('session-001');
    expect(generateTitleIfNeeded).toHaveBeenCalledWith('session-001', 'Bonjour', 'Bonjour à toi', noExercise);
    expect(recordTurn).not.toHaveBeenCalled();
  });

  it("records the turn's change on the exercise and the tutor's message once seen, never for a cut turn", async () => {
    recordTurn.mockClear();
    const progress = { id: 'ex-1', hintLevel: 2, diagnosis: null, change: { levelChange: 1, top: 4, stepDone: false, solved: false } };
    const finish = (aborted: boolean) => chatOrchestrationService.finishTurn({
      sessionId: 'session-001',
      userId: 'user-001',
      userContent: 'Je bloque',
      text: 'Regarde le +5.',
      model: 'mistral-small-2603',
      usage: undefined,
      startTime: Date.now(),
      attachedFileInfo: null,
      turnAnalysis: noopAnalysis,
      check: noExercise,
      exerciseProgress: progress,
      aborted,
    });

    await finish(false);
    expect(recordTurn).toHaveBeenCalledWith('ex-1', { levelChange: 1, top: 4, stepDone: false, solved: false, hint: { level: 2, text: 'Regarde le +5.' } });
    expect(saveMessage.mock.calls.at(-1)?.[3]).toMatchObject({ exerciseTurn: { diagnosis: null, hintLevel: 2 } });

    recordTurn.mockClear();
    await finish(true);
    expect(recordTurn).not.toHaveBeenCalled();
  });
});

describe('readStoredResponseMessages', () => {
  it('replays stored response messages, an older message as text, an unreadable value as text after logging it', () => {
    const reply = [{ role: 'assistant', content: [{ type: 'reasoning', text: 'r' }, { type: 'text', text: 't' }] }];
    expect(readStoredResponseMessages(reply, 'm1')).toEqual(reply as ReturnType<typeof readStoredResponseMessages>);
    expect(readStoredResponseMessages(null, 'm2')).toBeUndefined();
    mockLogger.error.mockClear();
    expect(readStoredResponseMessages([{ role: 'user', content: 'forged' }], 'm3')).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
  });
});
