import type { z } from 'zod';
import type { MistralMessage } from '../../platform/ai/mistral-client';
import type { Generate } from '../../eval/judge-config';

interface JudgeCall {
  question: string;
  schemaName: string;
  schema: z.ZodType;
  messages: MistralMessage[];
  model: string;
  temperature: number;
  safePrompt: boolean;
  seed: number;
  promptCacheKey: string;
  repairInvalid: boolean;
}

export interface FakeAnswer {
  evidence: string;
  answer: 'oui' | 'non';
}

/** The question a judge call asks: its last « Question : » message. */
function questionOf(messages: MistralMessage[]): string {
  const asked = messages.findLast((m) => m.role === 'user' && typeof m.content === 'string' && m.content.startsWith('Question : '));
  return typeof asked?.content === 'string' ? asked.content.slice('Question : '.length) : '';
}

/**
 * A stand-in for the model: `answer(question, seed, attempt)` gives each sample's answer,
 * « non » without a quote by default, `facts()` the extraction, empty by default, and
 * `claimFalse(claim, seed)` whether a listed claim is false, never by default; it logs when
 * each call starts and ends.
 */
export function fakeJudge(
  answer: (question: string, seed: number, attempt: number) => FakeAnswer = () => ({ evidence: '', answer: 'non' }),
  facts: () => unknown = () => ({ messages: [] }),
  claimFalse: (claim: string, seed: number) => boolean = () => false,
) {
  // The claims call lists them as « 1. claim », one per line, in its last message.
  const claimVerdicts = (messages: MistralMessage[], seed: number) => {
    const last = messages.at(-1)?.content;
    const lines = typeof last === 'string' ? [...last.matchAll(/^(\d+)\. (.*)$/gm)] : [];
    return { verdicts: lines.map(([, id = '', claim = '']) => ({ id, fausse: claimFalse(claim, seed) ? 'oui' : 'non' })) };
  };
  const calls: JudgeCall[] = [];
  const events: string[] = [];
  const generate: Generate = async (opts) => {
    const question = questionOf(opts.messages);
    const attempt = opts.messages.filter((m) => m.role === 'assistant').length + 1;
    calls.push({ ...opts, question });
    const id = String(calls.length);
    events.push(`start ${id}`);
    await Promise.resolve();
    events.push(`end ${id}`);
    return {
      object: opts.schema.parse(opts.schemaName === 'tutor_facts'
        ? facts()
        : opts.schemaName === 'claims_verdicts' ? claimVerdicts(opts.messages, opts.seed) : answer(question, opts.seed, attempt)),
      usage: { inputTokens: 100, cachedInputTokens: 80, outputTokens: 10 },
    };
  };
  return { generate, calls, events };
}
