/**
 * Tests — ChatOrchestrationService (modules/tutor/chat-orchestration.service.ts): the exercise
 * sheet of `prepareTurn`, and `finishTurn`, which persists nothing and counts no tokens when the
 * stream produced no content.
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';
import { analysis } from './_helpers/turn-analysis';
import { noExercise } from './_helpers/output-check';
import type { ExerciseSheet } from '../modules/tutor/exercise-sheet';

// ============================================
// MOCKS (must be before any import of the real module under test)
// ============================================

const mockLogger = createMockLogger();
mock.module('../platform/observability/logger', () => ({ logger: mockLogger }));

const getSessionWithSummary = mock(async () => ({ conversationSummary: null, summaryUpToMessageId: null, subject: null }));
mock.module('../modules/tutor/chat-session.service', () => ({
  chatSessionService: {
    getSession: mock(async () => null),
    getOrCreateActiveSession: mock(async () => 'session-001'),
    getSessionWithSummary,
  },
}));

const getSessionHistory = mock(async (_sessionId: string, _options?: unknown): Promise<{ id: string; role: string; content: string; createdAt: Date }[]> => []);
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
  chatMessageService: { saveMessage, getSessionHistory },
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

const summarizeIfNeeded = mock(async () => {});
mock.module('../modules/tutor/summarization.service', () => ({
  summarizationService: { summarizeIfNeeded },
  SUMMARY_BACKLOG: 20,
}));

const generateTitleIfNeeded = mock(async () => {});
mock.module('../modules/tutor/auto-title.service', () => ({
  autoTitleService: { generateTitleIfNeeded },
}));

const analyseTurn = mock(async (_studentText: string, _lastTutorText: string | null, _currentStatement: string | null) => analysis());
const turnInstruction = mock((): string | null => null);
mock.module('../modules/tutor/turn-analysis.service', () => ({
  analyseTurn,
  turnInstruction,
}));

const record = mock(async () => {});
const incrementTokenUsage = mock(async () => {});
mock.module('../modules/billing/index', () => ({
  costTrackingService: { record },
  incrementTokenUsage,
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
let currentState: { id: string; sheet: ExerciseSheet | null } | null = null;
mock.module('../modules/tutor/exercise-sheet.service', () => ({ currentExercise: mock(async () => currentState) }));
const recordTurn = mock(async (_id: string, _turn: unknown) => {});
mock.module('../modules/tutor/exercise-sheets.repository', () => ({ exerciseSheetsRepository: { recordTurn } }));

let moderation: { flagged: string[]; selfharmScore: number | null } | Error = { flagged: [], selfharmScore: 0 };
const moderateStudentTurn = mock(async (_lastTutorText: string | null, _studentText: string) => {
  if (moderation instanceof Error) throw moderation;
  return moderation;
});
mock.module('../platform/ai/moderation', () => ({ moderateStudentTurn }));
let closed = false;
mock.module('../modules/tutor/distress.service', () => ({ closedForDistress: mock(async () => closed) }));

// Import the real module under test AFTER all mocks are registered.
const { chatOrchestrationService, readStoredResponseMessages } = await import('../modules/tutor/chat-orchestration.service');
type Prepared = Awaited<ReturnType<typeof chatOrchestrationService.prepareTurn>>;

function tutorTurn(context: Prepared) {
  if (context.kind !== 'tutor') throw new Error(`expected a tutor turn, got ${context.kind}`);
  return context;
}

const studentTurn = { userId: 'user-001', fileIds: [], schoolLevel: 'quatrieme' as const };

describe('ChatOrchestrationService.prepareTurn — distress and input moderation', () => {
  beforeEach(() => {
    moderation = { flagged: [], selfharmScore: 0 };
    closed = false;
    prepareExerciseTurn.mockClear();
    mockLogger.error.mockClear();
  });
  afterEach(() => {
    closed = false;
    moderation = { flagged: [], selfharmScore: 0 };
  });

  it('answers a distress seen by Mistral or by the rules, before any exercise sheet', async () => {
    moderation = { flagged: ['selfharm'], selfharmScore: 0.35 };
    expect(await chatOrchestrationService.prepareTurn({ ...studentTurn, content: "j'ai envie de disparaître" }))
      .toEqual({ kind: 'distress', sessionId: 'session-001', source: 'both', selfharmScore: 0.35 });

    moderation = { flagged: [], selfharmScore: 0.01 };
    expect(await chatOrchestrationService.prepareTurn({ ...studentTurn, content: 'je me fais du mal quand je rate' }))
      .toEqual({ kind: 'distress', sessionId: 'session-001', source: 'rules', selfharmScore: 0.01 });
    expect(prepareExerciseTurn).not.toHaveBeenCalled();
  });

  it('lets the rules judge alone when moderation cannot answer, and logs it', async () => {
    moderation = new Error('down');
    expect(await chatOrchestrationService.prepareTurn({ ...studentTurn, content: "j'ai plus envie de vivre" }))
      .toEqual({ kind: 'distress', sessionId: 'session-001', source: 'rules', selfharmScore: null });

    const context = tutorTurn(await chatOrchestrationService.prepareTurn({ ...studentTurn, content: 'Résous 3x + 5 = 20.' }));
    expect(context.inputModeration).toBeNull();
    expect(mockLogger.error).toHaveBeenCalledTimes(2);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ operation: 'moderation:input-error' }));
  });

  it('keeps the other flagged categories with the turn without blocking it', async () => {
    moderation = { flagged: ['violence_and_threats'], selfharmScore: 0 };
    const context = tutorTurn(await chatOrchestrationService.prepareTurn({ ...studentTurn, content: 'Raconte la bataille de Verdun.' }));
    expect(context.inputModeration).toEqual(['violence_and_threats']);
  });

  it('moderates nothing without text and keeps no moderation with the turn, and keeps a missing score missing', async () => {
    moderateStudentTurn.mockClear();
    const context = tutorTurn(await chatOrchestrationService.prepareTurn({ ...studentTurn, content: '  ' }));
    expect(moderateStudentTurn).not.toHaveBeenCalled();
    expect('inputModeration' in context).toBe(false);

    moderation = { flagged: ['selfharm'], selfharmScore: null };
    expect(await chatOrchestrationService.prepareTurn({ ...studentTurn, content: 'Je pars loin, adieu' }))
      .toEqual({ kind: 'distress', sessionId: 'session-001', source: 'moderation', selfharmScore: null });
  });

  it('answers any message of a session closed for distress with the fixed reply, without moderating it', async () => {
    closed = true;
    moderateStudentTurn.mockClear();
    expect(await chatOrchestrationService.prepareTurn({ ...studentTurn, content: 'Résous 3x + 5 = 20.' }))
      .toEqual({ kind: 'distress', sessionId: 'session-001', source: 'closed', selfharmScore: null });
    expect(moderateStudentTurn).not.toHaveBeenCalled();
  });
});

describe('ChatOrchestrationService.screenDistress — a request the route refuses', () => {
  afterEach(() => {
    closed = false;
    moderation = { flagged: [], selfharmScore: 0 };
    getSessionHistory.mockImplementation(async () => []);
  });

  it("judges the message after the tutor's last one, and finds nothing in a plain one", async () => {
    getSessionHistory.mockImplementation(async () => [
      { id: 'm1', role: 'user', content: 'Résous 3x + 5 = 20.', createdAt: new Date() },
      { id: 'm2', role: 'assistant', content: 'Que fais-tu du + 5 ?', createdAt: new Date() },
    ]);
    moderateStudentTurn.mockClear();
    moderation = { flagged: ['selfharm'], selfharmScore: 0.6 };
    expect(await chatOrchestrationService.screenDistress({ userId: 'user-001', content: "j'ai envie de mourir" }))
      .toEqual({ kind: 'distress', sessionId: 'session-001', source: 'both', selfharmScore: 0.6 });
    expect(moderateStudentTurn).toHaveBeenCalledWith('Que fais-tu du + 5 ?', "j'ai envie de mourir");

    moderation = { flagged: [], selfharmScore: 0 };
    expect(await chatOrchestrationService.screenDistress({ userId: 'user-001', content: 'Résous 3x + 5 = 20.' })).toBeNull();
  });

  it('answers a closed session with the fixed reply', async () => {
    closed = true;
    expect(await chatOrchestrationService.screenDistress({ userId: 'user-001', content: 'Tu es là ?' }))
      .toEqual({ kind: 'distress', sessionId: 'session-001', source: 'closed', selfharmScore: null });
  });
});

describe('ChatOrchestrationService.prepareTurn — exercise', () => {
  beforeEach(() => {
    currentState = null;
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

    const context = tutorTurn(await chatOrchestrationService.prepareTurn({ ...request, fileIds: ['f2', 'someone-elses'] }));

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

  it('reads the exercise in progress once: its statement for the analysis, the state for the exercise turn', async () => {
    currentState = { id: 'ex-1', sheet: sheet('Résous 3x + 5 = 20.') };
    analyseTurn.mockClear();
    await chatOrchestrationService.prepareTurn(request);
    expect(analyseTurn.mock.calls[0]?.[2]).toBe('Résous 3x + 5 = 20.');
    expect(prepareExerciseTurn.mock.calls[0]?.[0]).toMatchObject({ current: currentState });
  });

  it("follows the exercise's contract instead of the turn instruction, and keeps the progress for finishTurn", async () => {
    prepareExerciseTurn.mockImplementationOnce(async () => underContract);
    turnInstruction.mockImplementationOnce(() => '<critical_instruction>X</critical_instruction>');

    const context = tutorTurn(await chatOrchestrationService.prepareTurn(request));

    expect(context.turnInstruction).toBe('<contrat>\nPalier 3\n</contrat>');
    expect(context.exerciseSheet?.statement).toBe('Résous 3x + 5 = 20.');
    expect(context.exerciseProgress).toEqual({ id: 'ex-1', hintLevel: 2, diagnosis: null, change: { levelChange: 1, top: 4, stepDone: false, solved: false } });
  });

  it('keeps the turn instruction and no progress without a contract', async () => {
    turnInstruction.mockImplementationOnce(() => '<critical_instruction>X</critical_instruction>');

    const context = tutorTurn(await chatOrchestrationService.prepareTurn(request));

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
