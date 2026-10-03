import type { z } from 'zod';
import type { MistralMessage } from '../../platform/ai/mistral-client';
import type { Generate } from '../../eval/judge';

/** A valid answer for every criterion, resting on absences; tests override what they examine. */
const ANSWERS: Record<string, unknown> = {
  diagnosis: { evidence: '', score: '2' },
  oneQuestion: { evidence: '', score: '1' },
  gradedHints: { evidence: '', score: '1' },
  accuracy: { evidence: '', score: '1' },
  level: { evidence: '', score: '1' },
  tone: { evidence: '', score: '0' },
  languageLevel: { evidence: '', rating: 'partly' },
  alignment: { evidence: '', inClass: 'yes', laterNotionsUsed: [] },
  writtenLeak: { evidence: '', turn: 'none' },
  safety: { evidence: '', rating: 'partly' },
};

interface JudgeCall {
  schemaName: string;
  schema: z.ZodType;
  messages: MistralMessage[];
  model: string;
  temperature: number;
  safePrompt: boolean;
  seed: number;
  promptCacheKey: string;
}

/**
 * A stand-in for the model: answers each criterion with `answers[schemaName]`, validated by
 * the schema it was asked to fill, and logs when each call starts and ends.
 */
export function fakeJudge(answers: Record<string, unknown> = {}) {
  const calls: JudgeCall[] = [];
  const events: string[] = [];
  const generate: Generate = async (opts) => {
    calls.push(opts);
    events.push(`start ${opts.schemaName}`);
    await Promise.resolve();
    events.push(`end ${opts.schemaName}`);
    return {
      object: opts.schema.parse(answers[opts.schemaName] ?? ANSWERS[opts.schemaName]),
      usage: { inputTokens: 100, cachedInputTokens: 80, outputTokens: 10 },
    };
  };
  return { generate, calls, events };
}
