import { describe, it, expect } from 'bun:test';
import { generateText } from '../lib/ai/mistral-client';
import { HAS_MISTRAL } from './_creds';

// Live contre l'API Mistral (api.mistral.ai). LOCAL-ONLY (`bun run test:live`),
// hors CI : pas de conso d'API payante ni de dépendance externe sur les PRs.
// Valide l'entrypoint de prod non-streaming (`generateText`) ; le streaming
// chat vit désormais dans `ai-chat.service.ts` (`streamText`, Task 4).
// Fail-closed : si la clé manque, on ÉCHOUE — jamais de skip.

describe('Chat (Mistral) live (real API)', () => {
  it('MISTRAL_API_KEY is configured (fail-closed, no silent skip)', () => {
    expect(HAS_MISTRAL).toBe(true);
  });

  it('generateText returns a coherent completion', async () => {
    const out = await generateText({
      messages: [
        {
          role: 'user',
          content: 'Quelle est la capitale de la France ? Réponds en un seul mot.',
        },
      ],
      maxTokens: 20,
      temperature: 0,
    });
    expect(out.length).toBeGreaterThan(0);
    expect(out.toLowerCase()).toContain('paris');
  }, 30_000);
});
