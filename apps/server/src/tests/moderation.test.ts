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

const { moderateReply, moderateTexts, OUTPUT_BLOCKING } = await import('../platform/ai/moderation');

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

describe('moderateTexts', () => {
  it('gives the blocking categories of each text in order, and calls nothing for none', async () => {
    results = [result([]), result(['sexual'])];
    expect(await moderateTexts(['a', 'b'])).toEqual([[], ['sexual']]);
    expect(textCalls[0]?.[0]).toEqual({ model: 'mistral-moderation-2603', inputs: ['a', 'b'] });
    expect(await moderateTexts([])).toEqual([]);
    expect(textCalls).toHaveLength(1);
  });
});
