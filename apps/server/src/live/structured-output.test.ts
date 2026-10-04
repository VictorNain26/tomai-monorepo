import { describe, it, expect } from 'bun:test';
import { generateStructured } from '../platform/ai/mistral-client';
import { CardGenerationSchema } from '../modules/learning/cards.schema';
import { HAS_MISTRAL } from './_creds';

// La doc Mistral ne liste pas les mots-clés JSON Schema acceptés en mode strict.
// Mesuré ici : oneOf, champs optionnels et nullable passent ; `format: uri` et
// `propertyNames` (z.record) sont rejetés en 400/3051, d'où les cartes en non-strict.

describe('Mistral structured outputs accept our schemas, strict except cards (real API)', () => {
  it('MISTRAL_API_KEY is configured (fail-closed, no silent skip)', () => {
    expect(HAS_MISTRAL).toBe(true);
  });

  it('card generation (non-strict, as the card generator calls it)', async () => {
    const { object, usage } = await generateStructured({
      messages: [{ role: 'user', content: 'Génère 2 cartes de révision sur le théorème de Pythagore, niveau 4e.' }],
      schema: CardGenerationSchema,
      schemaName: 'card_generation',
      functionId: 'live-cards',
      maxTokens: 2048,
      strict: false,
    });
    expect(CardGenerationSchema.safeParse(object).success).toBe(true);
    expect(object.cards.length).toBeGreaterThan(0);
    expect(usage.outputTokens).toBeGreaterThan(0);
  }, 60_000);
});
