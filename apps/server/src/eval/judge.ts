import { NoObjectGeneratedError } from 'ai';
import { z } from 'zod';
import type { MistralMessage } from '../platform/ai/mistral-client.js';
import { checksFor, scoresOf, type Answer, type Check } from './checks.js';
import { contextMessages, quotes, sections, turnBlocks, type JudgeInput } from './judge-context.js';

/**
 * Pinned by its dated id, never by an alias: a new model, prompt or sampling is a new judge
 * to measure again. Small 4 like the tutor, by decision of 2026-10-03; several samples at a
 * temperature above 0 align better with human grades than one deterministic call
 * (`etudes/2026-10-03/refonte-harnais.md`).
 */
export const JUDGE = {
  model: 'mistral-small-2603',
  promptVersion: '2026-10-03.5',
  samples: 5,
  temperature: 0.7,
  firstSeed: 20261003,
} as const;

// A question needs this many valid samples: fewer would let one sample decide.
const MIN_SAMPLES = 3;
const CONCURRENCY = 4;

// One schema for every question: the prompt prefix stays the same, so the cache serves it.
const answerSchema = z.object({
  evidence: z.string().describe('Citation exacte de la transcription si la réponse est oui, chaîne vide sinon.'),
  answer: z.enum(['oui', 'non']),
});

/** The structured call the judge needs; `generateStructured` of the server satisfies it. */
export type Generate = <T>(opts: {
  messages: MistralMessage[];
  schema: z.ZodType<T>;
  schemaName: string;
  functionId: string;
  model: string;
  temperature: number;
  maxTokens: number;
  safePrompt: boolean;
  seed: number;
  promptCacheKey: string;
}) => Promise<{ object: T; usage: JudgeUsage }>;

export interface JudgeUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

export interface CheckResult {
  id: string;
  pass: Answer;
  /** Valid samples, and how many answered « oui ». */
  samples: number;
  yes: number;
  /** Quotes of the samples that answered « oui ». */
  evidence: string[];
}

export interface Judged {
  checks: CheckResult[];
  scores: Record<string, number>;
  /** Leak of a written production, with the first turn its quotes point to. */
  writtenLeak: { leaked: boolean; turn: number | null; evidence: string } | null;
}

/** Majority verdict of a question: true when most valid samples answered « oui ». */
export function saysYes({ yes, samples }: Pick<CheckResult, 'yes' | 'samples'>): boolean {
  return yes * 2 > samples;
}

/** An answer the model wrote but that is no valid object is a lost sample; an API error is not. */
function lostOnUnreadable(error: unknown): null {
  if (NoObjectGeneratedError.isInstance(error)) return null;
  throw error;
}

async function pool<T>(tasks: readonly (() => Promise<T>)[], size: number): Promise<T[]> {
  const results: T[] = new Array<T>(tasks.length);
  let next = 0;
  const worker = async () => {
    for (let index = next++; index < tasks.length; index = next++) {
      const task = tasks[index];
      if (task) results[index] = await task();
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, tasks.length) }, worker));
  return results;
}

/**
 * Answers each question of the item in several samples, on a shared cached prefix. A « oui »
 * must quote the transcript; a quote not found gets one more try, then the sample is lost, as
 * is an answer that is no valid object.
 * A question with fewer than three valid samples fails the judgement.
 */
export async function judge(input: JudgeInput, generate: Generate): Promise<{ judged: Judged; usage: JudgeUsage }> {
  const wanted = sections(input);
  const checks = checksFor(wanted, input.scenario);
  if (checks.length === 0) throw new Error(`scenario ${input.scenario.id} asks the judge for nothing`);
  const context = contextMessages(input);
  const blocks = turnBlocks(input.transcript);
  const whole = blocks.join('\n\n');
  const usage: JudgeUsage = { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 };
  const key = `eval-judge-${JUDGE.promptVersion}-${input.scenario.id}-${input.exercise.id}-${String(input.transcript.repetition)}`;

  const call = async (messages: MistralMessage[], seed: number) => {
    const result = await generate({
      messages,
      schema: answerSchema,
      schemaName: 'judge_answer',
      functionId: 'eval-judge',
      model: JUDGE.model,
      temperature: JUDGE.temperature,
      maxTokens: 512,
      safePrompt: false,
      seed,
      promptCacheKey: key,
    });
    usage.inputTokens += result.usage.inputTokens;
    usage.cachedInputTokens += result.usage.cachedInputTokens;
    usage.outputTokens += result.usage.outputTokens;
    return answerSchema.parse(result.object);
  };
  const valid = ({ evidence, answer }: z.infer<typeof answerSchema>) => (
    answer === 'oui' ? evidence !== '' && quotes(whole, evidence) : quotes(whole, evidence)
  );
  const sample = async (check: Check, seed: number) => {
    const asked: MistralMessage[] = [...context, { role: 'user', content: `Question : ${check.question}` }];
    const first = await call(asked, seed).catch(lostOnUnreadable);
    if (!first) return null;
    if (valid(first)) return first;
    const second = await call([
      ...asked,
      { role: 'assistant', content: JSON.stringify(first) },
      { role: 'user', content: 'Cette citation ne figure pas mot pour mot dans la transcription. Recopie-la exactement, sans la corriger ni la reformuler, puis redonne ta réponse.' },
    ], seed).catch(lostOnUnreadable);
    return second && valid(second) ? second : null;
  };

  const seeds = Array.from({ length: JUDGE.samples }, (_, index) => JUDGE.firstSeed + index);
  const tasks = checks.flatMap((check) => seeds.map((seed) => () => sample(check, seed)));
  // The first call writes the shared prefix to the cache; the others then read it.
  const [first, ...rest] = tasks;
  const answers = first ? [await first(), ...await pool(rest, CONCURRENCY)] : [];

  const results: CheckResult[] = checks.map((check, index) => {
    const valids = answers.slice(index * seeds.length, (index + 1) * seeds.length).filter((a) => a !== null);
    const yes = valids.filter((a) => a.answer === 'oui');
    return { id: check.id, pass: check.pass, samples: valids.length, yes: yes.length, evidence: yes.map((a) => a.evidence) };
  });
  const short = results.filter((r) => r.samples < MIN_SAMPLES);
  if (short.length > 0) throw new Error(`judge quotes not found for ${short.map((r) => r.id).join(', ')}`);

  const verdicts = new Map(results.map((r) => [r.id, saysYes(r)]));
  const leak = results.find((r) => r.id === 'written-leak');
  const leakTurn = (quote: string) => blocks.findIndex((block) => quotes(block, quote)) + 1;
  const turns = leak && saysYes(leak) ? leak.evidence.map(leakTurn).filter((turn) => turn > 0) : [];
  return {
    judged: {
      checks: results,
      scores: scoresOf(verdicts, wanted, input.scenario),
      writtenLeak: leak
        ? { leaked: saysYes(leak), turn: turns.length > 0 ? Math.min(...turns) : null, evidence: leak.evidence[0] ?? '' }
        : null,
    },
    usage,
  };
}
