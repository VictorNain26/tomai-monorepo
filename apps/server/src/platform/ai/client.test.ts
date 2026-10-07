/**
 * The AI client on a real database, against the fake Mistral: what reaches Mistral, what the
 * student is billed, and how a call ends when Mistral misbehaves.
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import pino from 'pino';
import { z } from 'zod';
import { testDatabase } from '../../testing/database';
import { fakeMistral } from '../../testing/mistral';
import { user } from '../auth/schema';
import { createAi, type TextCall } from './client';
import { aiCost } from './schema';

const { db } = await testDatabase();
const mistral = fakeMistral();
// The error a call ends on, or null when it answers.
const failure = (call: Promise<unknown>) =>
  call.then(
    () => null,
    (error: unknown) => error,
  );
const lines: Record<string, unknown>[] = [];
const logger = pino({ level: 'warn' }, { write: (line: string) => lines.push(JSON.parse(line) as Record<string, unknown>) });

const STUDENT = 'student-1';
await db.insert(user).values({ id: STUDENT, name: 'Léa', email: 'lea@tom.example' });

beforeEach(async () => {
  mistral.chat.length = 0;
  mistral.received.length = 0;
  lines.length = 0;
  await db.delete(aiCost);
});

const call = (overrides: Partial<TextCall> = {}): TextCall => ({
  operation: 'title',
  owner: { studentId: STUDENT },
  system: 'Tu es Tom.',
  messages: [{ role: 'user', content: 'Bonjour' }],
  ...overrides,
});

const sentBody = (index = 0) => mistral.received.filter((r) => r.path === '/v1/chat/completions')[index]?.body ?? {};
const costs = () => db.select().from(aiCost).where(eq(aiCost.studentId, STUDENT));

describe('generateText', () => {
  const ai = createAi({ mistral: mistral.config(), db, logger });

  it('answers, and bills the student for the tokens Mistral reports', async () => {
    mistral.chat.push({ text: 'Une fraction', usage: { prompt_tokens: 1000, completion_tokens: 100 } });
    expect(await ai.generateText(call())).toBe('Une fraction');
    // Outside the EU endpoint, no upcharge: 0,00021 $ × 0,85.
    expect(await costs()).toMatchObject([
      { operation: 'title', model: 'mistral-small-2603', inputTokens: 1000, outputTokens: 100, costMicroEur: 179 },
    ]);
  });

  it('sends the system prompt first, no reasoning by default, the cache key and the output cap', async () => {
    mistral.chat.push({ text: 'ok' });
    await ai.generateText(call({ promptCacheKey: 'session-1', maxOutputTokens: 50, temperature: 0.2 }));
    expect(sentBody()).toMatchObject({
      model: 'mistral-small-2603',
      messages: [
        { role: 'system', content: 'Tu es Tom.' },
        { role: 'user', content: [{ type: 'text', text: 'Bonjour' }] },
      ],
      reasoning_effort: 'none',
      prompt_cache_key: 'session-1',
      max_tokens: 50,
      temperature: 0.2,
    });
  });

  it('reasons without an output cap when asked to', async () => {
    mistral.chat.push({ text: 'ok' });
    await ai.generateText(call({ reasoningEffort: 'high', maxOutputTokens: 50 }));
    expect(sentBody()).toMatchObject({ reasoning_effort: 'high' });
    expect(sentBody()).not.toHaveProperty('max_tokens');
  });

  it('bills nobody outside a student', async () => {
    mistral.chat.push({ text: 'ok' });
    await ai.generateText(call({ owner: null }));
    expect(await db.select().from(aiCost)).toEqual([]);
  });

  it('keeps the answer when the cost cannot be written, and logs it', async () => {
    mistral.chat.push({ text: 'ok' });
    expect(await ai.generateText(call({ owner: { studentId: 'nobody' } }))).toBe('ok');
    expect(lines).toContainEqual(expect.objectContaining({ msg: 'AI cost not written', operation: 'title' }));
  });

  it('refuses to start on a model without a price, whose calls no quota could bound', () => {
    expect(() => createAi({ mistral: mistral.config({ model: 'mistral-small-2609' }), db, logger })).toThrow('No price');
  });

  it('fails at its deadline when Mistral hangs', async () => {
    const hasty = createAi({ mistral: mistral.config({ timeoutMs: 300 }), db, logger });
    mistral.chat.push('hang');
    const start = Date.now();
    expect(await failure(hasty.generateText(call()))).toBeInstanceOf(Error);
    expect(Date.now() - start).toBeLessThan(1_000);
  });

  it('fails at the deadline of the call when it sets one shorter than the configured', async () => {
    mistral.chat.push('hang');
    const start = Date.now();
    expect(await failure(ai.generateText(call({ timeoutMs: 200 })))).toBeInstanceOf(Error);
    expect(Date.now() - start).toBeLessThan(1_000);
  });

  it('never waits past the configured deadline, whatever the call asks', async () => {
    const hasty = createAi({ mistral: mistral.config({ timeoutMs: 200 }), db, logger });
    mistral.chat.push('hang');
    const start = Date.now();
    expect(await failure(hasty.generateText(call({ timeoutMs: 5_000 })))).toBeInstanceOf(Error);
    expect(Date.now() - start).toBeLessThan(1_000);
  });

  it('retries an unavailable Mistral as many times as configured', async () => {
    const patient = createAi({ mistral: mistral.config({ retryAttempts: 1, timeoutMs: 10_000 }), db, logger });
    mistral.chat.push({ status: 503 }, { text: 'ok' });
    expect(await patient.generateText(call())).toBe('ok');
    expect(mistral.received).toHaveLength(2);
  }, 10_000);

  it('fails on a refusal, without billing', async () => {
    mistral.chat.push({ status: 400 });
    expect(await failure(ai.generateText(call()))).toBeInstanceOf(Error);
    expect(await costs()).toEqual([]);
  });
});

describe('generateStructured', () => {
  const ai = createAi({ mistral: mistral.config(), db, logger });
  const schema = z.object({ answer: z.number() });
  const structured = (overrides: { repairInvalid?: boolean; seed?: number } = {}) => ({
    ...call({ operation: 'exercise-sheet' }),
    schema,
    schemaName: 'sheet',
    ...overrides,
  });

  it('returns the validated object, Mistral held to the schema', async () => {
    mistral.chat.push({ json: { answer: 42 }, usage: { prompt_tokens: 500, completion_tokens: 20 } });
    expect(await ai.generateStructured(structured({ seed: 7 }))).toEqual({
      object: { answer: 42 },
      usage: { inputTokens: 500, cachedInputTokens: 0, outputTokens: 20 },
    });
    expect(sentBody()).toMatchObject({ random_seed: 7, response_format: { type: 'json_schema', json_schema: { name: 'sheet', strict: true } } });
  });

  it('asks once more with the validation error, and bills both calls', async () => {
    mistral.chat.push({ json: { answer: 'quarante-deux' } }, { json: { answer: 42 } });
    const result = await ai.generateStructured(structured());
    expect(result.object).toEqual({ answer: 42 });
    expect(result.usage).toEqual({ inputTokens: 2000, cachedInputTokens: 0, outputTokens: 200 });
    expect(JSON.stringify(sentBody(1)['messages'])).toContain('ne respecte pas le schéma attendu');
    expect(await costs()).toHaveLength(2);
  });

  it('fails without asking again when told not to, the answer billed all the same', async () => {
    mistral.chat.push({ json: { answer: 'quarante-deux' } });
    expect(await failure(ai.generateStructured(structured({ repairInvalid: false })))).toBeInstanceOf(Error);
    expect(mistral.received).toHaveLength(1);
    expect(await costs()).toHaveLength(1);
  });

  it('fails when the repair misses the schema too', async () => {
    mistral.chat.push({ json: { answer: 'un' } }, { json: { answer: 'deux' } });
    expect(await failure(ai.generateStructured(structured()))).toBeInstanceOf(Error);
    expect(mistral.received).toHaveLength(2);
  });
});
