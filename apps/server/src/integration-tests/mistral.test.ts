import { describe, it, expect } from 'bun:test';
import { env } from '../config/env';
import { generateText, chatStream, type ChatStreamChunk } from '../lib/ai/mistral-client';

// e2e RÉEL contre l'API Mistral (api.mistral.ai). On vérifie que le backend
// parle de bout en bout au LLM via ses deux entrypoints de prod : completion
// (`generateText`, utilisé pour titres/résumés) et streaming (`chatStream`,
// utilisé par le chat). Skip si pas de vraie clé — on n'appelle jamais l'API
// avec la 'test-key' injectée par les tests unitaires mockés.
const HAS_MISTRAL = !!env.MISTRAL_API_KEY && env.MISTRAL_API_KEY !== 'test-key';

describe.skipIf(!HAS_MISTRAL)('Mistral e2e (real API)', () => {
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
