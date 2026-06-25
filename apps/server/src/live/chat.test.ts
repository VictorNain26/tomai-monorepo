import { describe, it, expect } from 'bun:test';
import { generateText, chatStream, type ChatStreamChunk } from '../lib/ai/mistral-client';
import { HAS_MISTRAL } from './_creds';

// Live contre l'API Mistral (api.mistral.ai). LOCAL-ONLY (`bun run test:live`),
// hors CI : pas de conso d'API payante ni de dépendance externe sur les PRs.
// Valide les deux entrypoints de prod : completion (`generateText`) et streaming
// (`chatStream`). Fail-closed : si la clé manque, on ÉCHOUE — jamais de skip.

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
