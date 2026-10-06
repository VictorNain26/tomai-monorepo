import { describe, it, expect } from 'bun:test';
import { CARD_TYPES, CardGenerationSchema, CardSchema } from '../modules/learning/card-content.schema';
import { cardTypeEnum } from '../modules/learning/decks.schema';
import { validateCardContent } from '../modules/learning/card-validation';

const qcm = { question: '3 × 4 ?', options: ['7', '12'], correctIndex: 1, explanation: '3 × 4 = 12' };
const timeline = { instruction: 'Ordonne', events: [{ event: 'a' }, { event: 'b' }, { event: 'c' }], correctOrder: [2, 0, 1] };
const classification = {
  instruction: 'Classe ces êtres vivants',
  items: ['chêne', 'chat', 'rose', 'loup'],
  categories: [
    { name: 'végétal', itemIndexes: [0, 2] },
    { name: 'animal', itemIndexes: [1, 3] },
  ],
};
const matchingEra = {
  instruction: 'Relie',
  items: ['a', 'b', 'c'],
  eras: ['x', 'y'],
  correctPairs: [
    [0, 1],
    [1, 0],
    [2, 1],
  ],
};

describe('card content schema', () => {
  it('has one content schema per card type, the database enum included', () => {
    const generated = CardGenerationSchema.shape.cards.element.options.map((option) => option.shape.cardType.value);

    expect(generated).toEqual([...CARD_TYPES]);
    expect(cardTypeEnum.enumValues).toEqual([...CARD_TYPES]);
  });

  it('accepts every index type pointing into its list once', () => {
    const valid = [
      { cardType: 'qcm', content: qcm },
      { cardType: 'timeline', content: timeline },
      { cardType: 'classification', content: classification },
      { cardType: 'matching_era', content: matchingEra },
    ];

    for (const card of valid) expect(CardSchema.safeParse(card).success).toBe(true);
  });

  it('rejects an index outside its list, a repeated one, or one missing', () => {
    const misplaced = [
      { cardType: 'qcm', content: { ...qcm, correctIndex: 2 } },
      { cardType: 'fill_blank', content: { sentence: 'Il ___ venu.', options: ['est', 'a'], correctIndex: 2, explanation: 'auxiliaire être' } },
      { cardType: 'cause_effect', content: { context: 'c', cause: 'c', possibleEffects: ['a', 'b'], correctIndex: 5, explanation: 'e' } },
      { cardType: 'timeline', content: { ...timeline, correctOrder: [0, 1, 5] } },
      { cardType: 'timeline', content: { ...timeline, correctOrder: [0, 0, 1] } },
      { cardType: 'process_order', content: { instruction: 'i', processName: 'p', steps: ['a', 'b', 'c'], correctOrder: [0, 1, 1] } },
      {
        cardType: 'matching_era',
        content: {
          ...matchingEra,
          correctPairs: [
            [0, 1],
            [1, 7],
            [2, 1],
          ],
        },
      },
      {
        cardType: 'matching_era',
        content: {
          ...matchingEra,
          correctPairs: [
            [0, 1],
            [0, 0],
            [2, 1],
          ],
        },
      },
      {
        cardType: 'classification',
        content: {
          ...classification,
          categories: [
            { name: 'v', itemIndexes: [0, 2, 1] },
            { name: 'a', itemIndexes: [1, 3] },
          ],
        },
      },
      {
        cardType: 'classification',
        content: {
          ...classification,
          categories: [
            { name: 'v', itemIndexes: [0] },
            { name: 'a', itemIndexes: [1, 3] },
          ],
        },
      },
    ];

    for (const card of misplaced) expect(CardSchema.safeParse(card).success).toBe(false);
  });
});

describe('validateCardContent', () => {
  it('validates the types beyond flashcard, qcm and vrai_faux', () => {
    const calculation = { problem: '2 + 2', steps: ['2 + 2 = 4'], answer: '4' };

    expect(validateCardContent('calculation', calculation)).toEqual({ valid: true, content: calculation });
  });

  it('returns the content without the keys the schema does not know', () => {
    const result = validateCardContent('flashcard', { front: 'q', back: 'a', imageUrl: 'http://example.com/x.png' });

    expect(result).toEqual({ valid: true, content: { front: 'q', back: 'a' } });
  });

  it('rejects content that does not match its type, and says which field', () => {
    const result = validateCardContent('qcm', { ...qcm, correctIndex: 3 });

    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('correctIndex');
  });

  it('rejects the content of another type', () => {
    expect(validateCardContent('flashcard', qcm).valid).toBe(false);
  });
});
