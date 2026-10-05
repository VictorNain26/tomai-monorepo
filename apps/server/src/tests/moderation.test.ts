import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

const mockLogger = createMockLogger();
mock.module('../platform/observability/logger', () => ({ logger: mockLogger }));

const all = ['sexual', 'hate_and_discrimination', 'violence_and_threats', 'dangerous', 'criminal', 'selfharm', 'health', 'financial', 'law', 'pii', 'jailbreaking'];
const result = (flagged: string[]) => ({
  categories: Object.fromEntries(all.map((category) => [category, flagged.includes(category)])),
  categoryScores: Object.fromEntries(all.map((category) => [category, flagged.includes(category) ? 0.9 : 0.001])),
});

const chatCalls: unknown[][] = [];
const textCalls: unknown[][] = [];
let results: ReturnType<typeof result>[] = [];
mock.module('../platform/ai/mistral-sdk', () => ({
  getMistralSdk: () => ({
    classifiers: {
      moderateChat: mock(async (...args: unknown[]) => { chatCalls.push(args); return { id: 'm', model: 'mistral-moderation-2603', results }; }),
      moderate: mock(async (...args: unknown[]) => { textCalls.push(args); return { id: 'm', model: 'mistral-moderation-2603', results }; }),
    },
  }),
}));

const { moderateReply, moderateStudentTurn, moderateTexts, OUTPUT_BLOCKING } = await import('../platform/ai/moderation');

beforeEach(() => {
  chatCalls.length = 0;
  textCalls.length = 0;
  mockLogger.warn.mockClear();
});

describe('moderateReply', () => {
  it("classifies the reply with the student's message for context, on the dated model with a timeout", async () => {
    results = [result([])];
    expect(await moderateReply('Je bloque', 'Que fais-tu du + 5 ?')).toEqual([]);
    expect(chatCalls[0]).toEqual([
      { model: 'mistral-moderation-2603', inputs: [{ role: 'user', content: 'Je bloque' }, { role: 'assistant', content: 'Que fais-tu du + 5 ?' }] },
      { timeoutMs: 5000 },
    ]);
  });

  it('holds back on the blocking categories only, and logs their scores', async () => {
    results = [result(['selfharm', 'health', 'pii', 'jailbreaking'])];
    expect(await moderateReply('x', 'y')).toEqual(['selfharm']);
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(OUTPUT_BLOCKING).not.toContain('health');
  });
});

describe('moderateReply — edge cases', () => {
  it('moderates the reply alone when the student sent no text, a photo alone', async () => {
    results = [result([])];
    expect(await moderateReply('  ', 'Que vois-tu sur la photo ?')).toEqual([]);
    expect(chatCalls).toHaveLength(0);
    expect(textCalls[0]?.[0]).toEqual({ model: 'mistral-moderation-2603', inputs: ['Que vois-tu sur la photo ?'] });
  });

  it('throws when moderation answers for fewer texts than asked: a text without its result was not checked', async () => {
    results = [];
    expect(moderateReply('x', 'y')).rejects.toThrow('Moderation returned 0 results for 1 inputs');
    results = [result([])];
    expect(moderateTexts(['a', 'b'])).rejects.toThrow('Moderation returned 1 results for 2 inputs');
  });
});

describe('moderateTexts', () => {
  it('gives the blocking categories of each text in order, and calls nothing for none', async () => {
    results = [result([]), result(['sexual'])];
    expect(await moderateTexts(['a', 'b'])).toEqual([[], ['sexual']]);
    expect(textCalls[0]?.[0]).toEqual({ model: 'mistral-moderation-2603', inputs: ['a', 'b'] });
    expect(await moderateTexts([])).toEqual([]);
    expect(textCalls).toHaveLength(1);
  });
});

describe('moderateStudentTurn', () => {
  it("classifies the student's message after the tutor's last one, and keeps the recorded categories with the selfharm score", async () => {
    results = [result(['selfharm', 'violence_and_threats', 'health'])];
    expect(await moderateStudentTurn('Que fais-tu du + 5 ?', "j'ai envie de disparaître")).toEqual({
      flagged: ['selfharm', 'violence_and_threats'],
      selfharmScore: 0.9,
    });
    expect(chatCalls[0]).toEqual([
      { model: 'mistral-moderation-2603', inputs: [{ role: 'assistant', content: 'Que fais-tu du + 5 ?' }, { role: 'user', content: "j'ai envie de disparaître" }] },
      { timeoutMs: 5000 },
    ]);
  });

  it('keeps a missing selfharm score missing: it is not a low one', async () => {
    results = [{ categories: { selfharm: true }, categoryScores: {} }];
    expect(await moderateStudentTurn(null, 'adieu')).toEqual({ flagged: ['selfharm'], selfharmScore: null });
  });

  it('classifies the message alone at the start of a session, and throws without a result', async () => {
    results = [result([])];
    expect(await moderateStudentTurn(null, 'Bonjour')).toEqual({ flagged: [], selfharmScore: 0.001 });
    expect(chatCalls[0]?.[0]).toEqual({ model: 'mistral-moderation-2603', inputs: [{ role: 'user', content: 'Bonjour' }] });
    results = [];
    expect(moderateStudentTurn(null, 'Bonjour')).rejects.toThrow('Moderation returned 0 results for 1 inputs');
  });
});
