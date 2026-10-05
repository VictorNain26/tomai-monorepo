import './_helpers/mistral-env';
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';
import type { ExerciseSheet } from '../modules/tutor/exercise-sheet';

const mockLogger = createMockLogger();
mock.module('../platform/observability/logger', () => ({ logger: mockLogger }));

interface Call { reasoningEffort?: string; temperature?: number; maxTokens?: number; safePrompt?: boolean; messages: { role: string; content: string }[] }
const calls: Call[] = [];
let replies: (ExerciseSheet | Error)[] = [];
mock.module('../platform/ai/mistral-client', () => ({
  generateStructured: mock(async (opts: Call) => {
    const reply = replies[calls.length];
    calls.push(opts);
    if (reply === undefined || reply instanceof Error) throw reply ?? new Error('no reply');
    return { object: reply, usage: { inputTokens: 3000, cachedInputTokens: 1000, outputTokens: 1500 } };
  }),
}));

const record = mock(async (_input: unknown) => {});
const actualBilling = await import('../modules/billing/index');
mock.module('../modules/billing/index', () => ({ ...actualBilling, costTrackingService: { record } }));

const create = mock(async (_values: unknown): Promise<string | null> => 'ex-1');
interface Row { id: string; sheet: ExerciseSheet | null; uncertain: boolean; hintLevel: number; hints: { level: number; text: string }[]; solvedAt: Date | null }
let latest: Row | null = null;
mock.module('../modules/tutor/exercise-sheets.repository', () => ({
  exerciseSheetsRepository: { create, findLatest: mock(async () => latest) },
}));

const { prepareExerciseSheet, currentExercise } = await import('../modules/tutor/exercise-sheet.service');

const draft = (answer: string): ExerciseSheet => ({
  statement: 'Résous 3x + 5 = 20.', kind: 'short', answer, answerForms: [answer], mathEquation: '3*x + 5 = 20', mathAnswer: answer,
  steps: [], commonErrors: [], rule: null, facts: [], expectedElements: [], entries: ['invented-id'], laterEntries: [],
});

const params = { userId: 'user-1', sessionId: 'session-1', level: 'quatrieme' as const, subject: 'mathematiques', studentText: 'Résous 3x + 5 = 20.', attachedFilesBlock: null };

beforeEach(() => {
  calls.length = 0;
  replies = [];
  record.mockClear();
  create.mockClear();
  create.mockImplementation(async () => 'ex-1');
  latest = null;
  mockLogger.error.mockClear();
});

describe('prepareExerciseSheet', () => {
  it('draws three times in reasoning at 0.7 without output cap, counts each draw, stores the voted sheet', async () => {
    replies = [draft('x = 5'), draft('5'), draft('x = 6')];

    const exercise = await prepareExerciseSheet(params);

    expect(exercise).toMatchObject({ id: 'ex-1', uncertain: false, hintLevel: 0, hints: [] });
    expect(exercise.sheet?.answer).toBe('x = 5');
    expect(exercise.sheet?.entries).toEqual([]);
    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(call).toMatchObject({ reasoningEffort: 'high', temperature: 0.7, safePrompt: false });
      expect(call.maxTokens).toBeUndefined();
    }
    expect(calls[0]?.messages[0]?.content).toContain('<programme>');
    expect(record).toHaveBeenCalledTimes(3);
    expect(record.mock.calls[0]?.[0]).toMatchObject({ operation: 'exercise-sheet', tokensInput: 3000, tokensOutput: 1500, cachedTokens: 1000, sessionId: 'session-1' });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[0]).toMatchObject({ sessionId: 'session-1', uncertain: false, mathCheck: 'passed', sheet: { answer: 'x = 5' } });
  });

  it('votes among the draws that succeeded, and logs the failed one', async () => {
    replies = [draft('x = 5'), new Error('timeout'), draft('x = 5')];

    expect((await prepareExerciseSheet(params)).sheet?.answer).toBe('x = 5');
    expect(record).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0]?.[0]).toMatchObject({ uncertain: false });
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
  });

  it('gives no sheet when every draw failed, and stores the exercise without one so the previous is not taken back', async () => {
    replies = [new Error('timeout'), new Error('timeout'), new Error('timeout')];

    expect(await prepareExerciseSheet(params)).toMatchObject({ id: 'ex-1', sheet: null, uncertain: true });
    expect(create.mock.calls[0]?.[0]).toMatchObject({ sessionId: 'session-1', sheet: null, uncertain: true, mathCheck: 'not-applicable' });
    expect(record).not.toHaveBeenCalled();
  });

  it('gives the attached text to the draws', async () => {
    replies = [draft('x = 5'), draft('x = 5'), draft('x = 5')];
    await prepareExerciseSheet({ ...params, studentText: 'Voici mon exercice', attachedFilesBlock: '<attached_file name="photo">Résous 3x + 5 = 20.</attached_file>' });
    expect(calls[0]?.messages.at(-1)?.content).toStartWith('<attached_file name="photo">Résous 3x + 5 = 20.</attached_file>');
  });

  it('keeps the sheet for the turn when storing it fails, without an id to keep progress, and logs it', async () => {
    replies = [draft('x = 5'), draft('x = 5'), draft('x = 5')];
    create.mockImplementation(async () => { throw new Error('db down'); });

    expect(await prepareExerciseSheet(params)).toMatchObject({ id: null, sheet: { answer: 'x = 5' } });
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
  });
});

describe('currentExercise', () => {
  it("gives the session's last exercise with its progress, and none once it is solved", async () => {
    latest = { id: 'ex-1', sheet: draft('x = 5'), uncertain: false, hintLevel: 2, hints: [{ level: 1, text: 'Indice' }], solvedAt: null };
    expect(await currentExercise('session-1')).toEqual({ id: 'ex-1', sheet: draft('x = 5'), uncertain: false, hintLevel: 2, hints: [{ level: 1, text: 'Indice' }] });

    latest = { ...latest, solvedAt: new Date() };
    expect(await currentExercise('session-1')).toBeNull();
  });
});
