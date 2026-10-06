import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import { CARD_TYPES, CardGenerationSchema, CardSchema } from '../modules/learning/card-content.schema';
import { cardTypeEnum } from '../modules/learning/decks.schema';
import { validateCardContent } from '../modules/learning/card-validation';

const qcm = { question: '3 × 4 ?', options: ['7', '12'], correctIndex: 1, explanation: '3 × 4 = 12' };

describe('card content schema', () => {
  it('has one content schema per card type, the database enum included', () => {
    expect(CardSchema.options.map((option) => option.shape.cardType.value)).toEqual([...CARD_TYPES]);
    expect(cardTypeEnum.enumValues).toEqual([...CARD_TYPES]);
  });

  it('builds a JSON Schema that Mistral strict mode accepts: no `format`, no `propertyNames`', () => {
    const wire = JSON.stringify(z.toJSONSchema(CardGenerationSchema));

    expect(wire).not.toContain('"format"');
    expect(wire).not.toContain('"propertyNames"');
  });

  it('accepts a classification as named categories with their item indexes', () => {
    const card = {
      cardType: 'classification',
      content: {
        instruction: 'Classe ces êtres vivants',
        items: ['chêne', 'chat', 'rose', 'loup'],
        categories: [{ name: 'végétal', itemIndexes: [0, 2] }, { name: 'animal', itemIndexes: [1, 3] }],
      },
    };

    expect(CardSchema.safeParse(card).success).toBe(true);
  });

  it('rejects an answer index outside the options, for every type that has one', () => {
    const outside = [
      { cardType: 'qcm', content: { ...qcm, correctIndex: 2 } },
      { cardType: 'fill_blank', content: { sentence: 'Il ___ venu.', options: ['est', 'a'], correctIndex: 2, explanation: 'auxiliaire être' } },
      { cardType: 'cause_effect', content: { context: 'c', cause: 'c', possibleEffects: ['a', 'b'], correctIndex: 5, explanation: 'e' } },
    ];

    for (const card of outside) expect(CardSchema.safeParse(card).success).toBe(false);
    expect(CardSchema.safeParse({ cardType: 'qcm', content: qcm }).success).toBe(true);
  });
});

describe('validateCardContent', () => {
  it('validates the types beyond flashcard, qcm and vrai_faux', () => {
    const calculation = { problem: '2 + 2', steps: ['2 + 2 = 4'], answer: '4' };

    expect(validateCardContent('calculation', calculation)).toEqual({ valid: true });
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
