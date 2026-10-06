import './_helpers/mistral-env';
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';
import { noExercise } from './_helpers/output-check';

const mockLogger = createMockLogger();
mock.module('../platform/observability/logger', () => ({ logger: mockLogger }));

let generated = 'Équations du premier degré';
const generateText = mock(async (_opts: { owner: unknown }) => generated);
mock.module('../platform/ai/mistral-client', () => ({ generateText }));

let topic: string | null = null;
const update = mock(async (_id: string, _values: { topic: string }) => {});
mock.module('../modules/tutor/study-sessions.repository', () => ({
  studySessionsRepository: { findById: mock(async () => ({ id: 's1', userId: 'u1', topic })), update },
}));

let moderation: string[] | Error = [];
mock.module('../platform/ai/moderation', () => ({
  moderateTexts: mock(async (texts: string[]) => {
    if (moderation instanceof Error) throw moderation;
    return texts.map(() => moderation as string[]);
  }),
  moderateReply: mock(async () => []),
}));

const { autoTitleService } = await import('../modules/tutor/auto-title.service');

const sheet = {
  statement: 'Résous 3x + 5 = 20.', kind: 'short' as const, answer: 'x = 5', answerForms: ['x = 5'], mathEquation: null, mathAnswer: null,
  steps: [], commonErrors: [], rule: null, facts: [], expectedElements: [], entries: [], laterEntries: [],
};

beforeEach(() => {
  generated = 'Équations du premier degré';
  topic = null;
  moderation = [];
  update.mockClear();
});

describe('autoTitleService.generateTitleIfNeeded', () => {
  it('stores a title that passes the check, and never logs it: it comes from the conversation', async () => {
    await autoTitleService.generateTitleIfNeeded('s1', 'Résous 3x + 5 = 20.', 'Que fais-tu du + 5 ?', noExercise);
    expect(update).toHaveBeenCalledWith('s1', { topic: 'Équations du premier degré' });
    expect(generateText.mock.calls.at(-1)?.[0].owner).toEqual({ userId: 'u1', sessionId: 's1' });
    expect(JSON.stringify(Object.values(mockLogger).map((level) => level.mock.calls))).not.toContain('Équations');
  });

  it("keeps the default title when the title gives the exercise's answer, when moderation holds it back or cannot check it", async () => {
    generated = 'Équation : x = 5';
    await autoTitleService.generateTitleIfNeeded('s1', 'Résous 3x + 5 = 20.', 'Que fais-tu du + 5 ?', { ...noExercise, sheet });
    generated = 'Équations du premier degré';
    moderation = ['violence_and_threats'];
    await autoTitleService.generateTitleIfNeeded('s1', 'x', 'y', noExercise);
    moderation = new Error('down');
    await autoTitleService.generateTitleIfNeeded('s1', 'x', 'y', noExercise);
    expect(update).not.toHaveBeenCalled();
  });

  it('leaves a titled session alone', async () => {
    topic = 'Déjà titrée';
    await autoTitleService.generateTitleIfNeeded('s1', 'x', 'y', noExercise);
    expect(update).not.toHaveBeenCalled();
  });
});
