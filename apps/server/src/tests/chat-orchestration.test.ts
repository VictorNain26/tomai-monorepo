/**
 * Tests — ChatOrchestrationService (modules/tutor/chat-orchestration.service.ts): the exercise
 * sheet of `prepareTurn`, and `finishTurn`, which persists nothing and counts no tokens when the
 * stream produced no content.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';
import type { TomChatMessage } from '../modules/tutor/chat-ui-message';
import { analysis } from './_helpers/turn-analysis';
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

mock.module('../modules/documents/index', () => ({
  sessionFilesRepository: { attach: mock(async () => {}) },
  fileContextService: {
    prepareFileContext: mock(async () => ({ attachedFileInfos: [], attachedFiles: [] })),
    prepareMultimodalFiles: mock(async () => []),
  },
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
mock.module('../modules/tutor/turn-analysis.service', () => ({
  analyseTurn,
  turnInstruction: mock(() => null),
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
const prepareExerciseSheet = mock(async (_params: unknown): Promise<ExerciseSheet | null> => sheet('Résous 3x + 5 = 20.'));
const currentExerciseSheet = mock(async (_sessionId: string): Promise<ExerciseSheet | null> => sheet('Exercice précédent'));
mock.module('../modules/tutor/exercise-sheet.service', () => ({ prepareExerciseSheet, currentExerciseSheet }));

// Import the real module under test AFTER all mocks are registered.
const { chatOrchestrationService, readStoredResponseMessages } = await import('../modules/tutor/chat-orchestration.service');

describe('ChatOrchestrationService.prepareTurn — exercise sheet', () => {
  beforeEach(() => {
    prepareExerciseSheet.mockClear();
    currentExerciseSheet.mockClear();
  });

  const request = { userId: 'user-001', content: 'Résous 3x + 5 = 20.', fileIds: [], schoolLevel: 'quatrieme' as const };

  it('prepares the sheet of an exercise the student brings, with the class, the detected subject and the message', async () => {
    analyseTurn.mockImplementationOnce(async () => analysis({ bringsExercise: true, subject: 'mathematiques' }));

    const context = await chatOrchestrationService.prepareTurn(request);

    expect(context.exerciseSheet?.statement).toBe('Résous 3x + 5 = 20.');
    expect(prepareExerciseSheet).toHaveBeenCalledWith({
      userId: 'user-001', sessionId: 'session-001', level: 'quatrieme', subject: 'mathematiques', studentText: 'Résous 3x + 5 = 20.', attachedFilesBlock: null,
    });
    expect(currentExerciseSheet).not.toHaveBeenCalled();
  });

  it('goes on with the exercise in progress when the message brings none', async () => {
    const context = await chatOrchestrationService.prepareTurn({ ...request, content: "Je n'y arrive pas" });

    expect(context.exerciseSheet?.statement).toBe('Exercice précédent');
    expect(currentExerciseSheet).toHaveBeenCalledWith('session-001');
    expect(prepareExerciseSheet).not.toHaveBeenCalled();
  });

  it('never falls back on the previous exercise when the new sheet failed', async () => {
    analyseTurn.mockImplementationOnce(async () => analysis({ bringsExercise: true }));
    prepareExerciseSheet.mockImplementationOnce(async () => null);

    expect((await chatOrchestrationService.prepareTurn(request)).exerciseSheet).toBeNull();
    expect(currentExerciseSheet).not.toHaveBeenCalled();
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
    const emptyResponse: TomChatMessage = { id: 'm2', role: 'assistant', parts: [] };
    await chatOrchestrationService.finishTurn({
      sessionId: 'session-001',
      userId: 'user-001',
      userContent: 'Bonjour',
      responseMessage: emptyResponse,
      model: 'mistral-small-2603',
      usage: undefined,
      startTime: Date.now(),
      attachedFileInfo: null,
      turnAnalysis: noopAnalysis,
    });

    expect(saveMessage).not.toHaveBeenCalled();
    expect(incrementTokenUsage).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
    expect(summarizeIfNeeded).not.toHaveBeenCalled();
    expect(generateTitleIfNeeded).not.toHaveBeenCalled();
  });

  it('counts the tokens of a turn that reasoned without writing, and persists nothing', async () => {
    const emptyResponse: TomChatMessage = { id: 'm2', role: 'assistant', parts: [] };
    await chatOrchestrationService.finishTurn({
      sessionId: 'session-001',
      userId: 'user-001',
      userContent: 'Bonjour',
      responseMessage: emptyResponse,
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
        responseMessage: { id: 'm2', role: 'assistant', parts: [{ type: 'text', text: 'Bonjour à toi', state: 'done' }] },
        modelMessages: [...modelMessages],
        aborted,
        model: 'mistral-small-2603',
        usage: undefined,
        startTime: Date.now(),
        attachedFileInfo: null,
        turnAnalysis: noopAnalysis,
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
      responseMessage: { id: 'm2', role: 'assistant', parts: [{ type: 'text', text: 'Bonjour à toi', state: 'done' }] },
      modelMessages,
      model: 'mistral-small-2603',
      usage: undefined,
      startTime: Date.now(),
      attachedFileInfo: null,
      turnAnalysis: noopAnalysis,
    });

    expect(saveMessage.mock.calls[0]?.[2]).toBe('Bonjour à toi');
    expect((saveMessage.mock.calls[0]?.[3] as Record<string, unknown> | undefined)?.['modelMessages']).toEqual(modelMessages);
  });

  it('persists the assistant message and accounts tokens when content was produced', async () => {
    const filledResponse: TomChatMessage = {
      id: 'm2',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Bonjour à toi', state: 'done' }],
    };
    await chatOrchestrationService.finishTurn({
      sessionId: 'session-001',
      userId: 'user-001',
      userContent: 'Bonjour',
      responseMessage: filledResponse,
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
    });

    expect(saveMessage).toHaveBeenCalledTimes(1);
    expect(saveMessage.mock.calls[0]?.[1]).toBe('assistant');
    expect(saveMessage.mock.calls[0]?.[2]).toBe('Bonjour à toi');
    expect((saveMessage.mock.calls[0]?.[3] as Record<string, unknown> | undefined)?.['modelMessages']).toBeUndefined();
    expect(incrementTokenUsage).toHaveBeenCalledWith('user-001', 15);
    expect(record).toHaveBeenCalledTimes(1);
    expect(summarizeIfNeeded).toHaveBeenCalledWith('session-001');
    expect(generateTitleIfNeeded).toHaveBeenCalledWith('session-001', 'Bonjour', 'Bonjour à toi');
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
