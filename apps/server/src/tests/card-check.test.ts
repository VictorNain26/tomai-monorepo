import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

const mockLogger = createMockLogger();
mock.module('../platform/observability/logger', () => ({ logger: mockLogger }));

const seen: string[][] = [];
let moderation: string[][] | Error = [];
mock.module('../platform/ai/moderation', () => ({
  moderateTexts: mock(async (texts: string[]) => {
    seen.push(texts);
    if (moderation instanceof Error) throw moderation;
    return texts.map((_, index) => (moderation as string[][])[index] ?? []);
  }),
  moderateReply: mock(async () => []),
}));

const { checkCards } = await import('../modules/learning/card-check');

const cards = [
  { cardType: 'qcm', content: { question: 'Combien font 3 × 4 ?', options: ['12', '11'], correctIndex: 0 } },
  { cardType: 'flashcard', content: { front: 'Accord', back: 'Avec le sujet' } },
  { cardType: 'flashcard', content: { front: 'Q', back: 'R' } },
];

beforeEach(() => {
  seen.length = 0;
  moderation = [];
  mockLogger.error.mockClear();
});

describe('checkCards', () => {
  it('reads each card as the student does, without its indexes, and keeps those that pass', async () => {
    expect(await checkCards(cards, () => true)).toEqual({ kept: cards, setAside: 0 });
    expect(seen[0]?.[0]).toBe('Combien font 3 × 4 ?\n12\n11');
  });

  it("sets aside a card moderation holds back, and one the caller's check refuses", async () => {
    moderation = [[], ['sexual'], []];
    const { kept, setAside } = await checkCards(cards, (text) => !text.includes('Combien'));
    expect(kept).toEqual(cards.slice(2));
    expect(setAside).toBe(2);
  });

  it('keeps none when moderation cannot answer, and logs it', async () => {
    moderation = new Error('down');
    expect(await checkCards(cards, () => true)).toEqual({ kept: [], setAside: 3 });
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
  });
});
