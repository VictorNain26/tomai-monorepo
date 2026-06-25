import { describe, it, expect } from 'bun:test';
import { env } from '../config/env';
import { generateText, chatStream, type ChatStreamChunk } from '../lib/ai/mistral-client';

// e2e RÉEL contre l'API Mistral (api.mistral.ai). LOCAL-ONLY : hors CI et hors
// test:integration (pas de conso d'API payante ni de dépendance externe sur les
// PRs). Lancé via `bun run test:e2e` pour valider de visu les deux entrypoints
// de prod : completion (`generateText`) et streaming (`chatStream`).
// Fail-closed : si la clé manque, on ÉCHOUE — jamais de skip silencieux.
const HAS_MISTRAL = !!env.MISTRAL_API_KEY && env.MISTRAL_API_KEY !== 'test-key';

describe('Mistral e2e (real API, local-only)', () => {
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

  it('chatStream streams non-empty text and terminates on a done chunk', async () => {
    const chunks: ChatStreamChunk[] = [];
    for await (const c of chatStream({
      messages: [{ role: 'user', content: 'Dis bonjour en une courte phrase.' }],
      maxTokens: 40,
      temperature: 0,
    })) {
      chunks.push(c);
    }
    const text = chunks
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('');
    expect(text.length).toBeGreaterThan(0);
    expect(chunks.some((c) => c.type === 'done')).toBe(true);
  }, 30_000);
});
