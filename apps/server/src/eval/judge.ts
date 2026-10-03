import { NoObjectGeneratedError } from 'ai';
import pMap from 'p-map';
import { z } from 'zod';
import type { MistralMessage } from '../platform/ai/mistral-client.js';
import { checksFor, scoresOf, type Answer, type Check } from './checks.js';
import { extract } from './extract.js';
import { contextMessages, quotesSomething, sections, turnBlocks, type JudgeInput } from './judge-context.js';
import { answeredByCode, verify } from './verifiers.js';

/**
 * Pinned by its dated id, never by an alias: a new model, prompt or sampling is a new judge
 * to measure again. Small 4, the tutor's model (`docs/agent.md`); several samples at a
 * temperature above 0 align better with human grades than one deterministic call
 * (`etudes/2026-10-03/refonte-harnais.md`).
 */
export const JUDGE = {
  model: 'mistral-small-2603',
  promptVersion: '2026-10-03.8',
  samples: 5,
  temperature: 0.7,
  firstSeed: 20261003,
} as const;

// A verdict must rest on most of the samples drawn, not on what is left after losses.
const MIN_SAMPLES = Math.floor(JUDGE.samples / 2) + 1;
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
  maxRetries: number;
  safePrompt: boolean;
  seed: number;
  promptCacheKey: string;
}) => Promise<{ object: T; usage: JudgeUsage }>;

export interface JudgeUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

export const NO_USAGE: JudgeUsage = { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 };

export function addUsage(a: JudgeUsage, b: JudgeUsage): JudgeUsage {
  return { inputTokens: a.inputTokens + b.inputTokens, cachedInputTokens: a.cachedInputTokens + b.cachedInputTokens, outputTokens: a.outputTokens + b.outputTokens };
}

export interface CheckResult {
  id: string;
  pass: Answer;
  /** Valid samples, and how many answered « oui ». */
  samples: number;
  yes: number;
  /** Quotes of the samples that answered « oui ». */
  evidence: string[];
  /** Who answered: the model in samples, or the code once (`samples` 1, `yes` 0 or 1). */
  by: 'model' | 'code';
}

export interface Judged {
  checks: CheckResult[];
  scores: Record<string, number>;
  /** Leak of a written production, with the first turn its quotes point to. */
  writtenLeak: { leaked: boolean; turn: number | null; evidence: string } | null;
}

/**
 * Majority verdict of a question: true when most valid samples answered « oui ». A tie goes
 * against the tutor: the judge leans toward its own model, so doubt must not pass.
 */
export function saysYes({ yes, samples, pass }: Pick<CheckResult, 'yes' | 'samples' | 'pass'>): boolean {
  return yes * 2 === samples ? pass === 'non' : yes * 2 > samples;
}

/** An answer the model wrote but that is no valid object is a lost sample; an API error is not. */
function lostOnUnreadable(error: unknown): null {
  if (NoObjectGeneratedError.isInstance(error)) return null;
  throw error;
}

/**
 * Answers the given questions in several samples, on a shared cached prefix. A « oui »
 * must quote at least one word of the transcript, and a written leak a single turn; a quote
 * not found gets one more try, then the sample is lost, as is an answer that is no valid
 * object. A question with fewer than three valid samples fails the judgement.
 */
export async function answerChecks(
  input: JudgeInput,
  checks: readonly Check[],
  generate: Generate,
): Promise<{ results: CheckResult[]; usage: JudgeUsage }> {
  const context = contextMessages(input);
  const blocks = turnBlocks(input.transcript);
  const whole = blocks.join('\n\n');
  let usage = NO_USAGE;
  const key = `eval-judge-${JUDGE.promptVersion}-${input.scenario.id}-${input.exercise.id}-${String(input.transcript.repetition)}`;

  const call = async (messages: MistralMessage[], seed: number) => {
    const result = await generate({
      messages,
      schema: answerSchema,
      schemaName: 'judge_answer',
      functionId: 'eval-judge',
      model: JUDGE.model,
      temperature: JUDGE.temperature,
      maxTokens: 1024,
      // Rate limits are waited out by the caller's throttle, not retried at once by the SDK.
      maxRetries: 0,
      safePrompt: false,
      seed,
      promptCacheKey: key,
    });
    usage = addUsage(usage, result.usage);
    return result.object;
  };
  // A « non » rests on an absence: its evidence is not checked, and dropped.
  const quoted = (check: Check, evidence: string) => (check.id === 'written-leak'
    ? blocks.some((block) => quotesSomething(block, evidence))
    : quotesSomething(whole, evidence));
  const sample = async (check: Check, seed: number) => {
    const asked: MistralMessage[] = [...context, { role: 'user', content: `Question : ${check.question}` }];
    const first = await call(asked, seed).catch(lostOnUnreadable);
    if (!first) return null;
    if (first.answer === 'non') return { answer: 'non' as const, evidence: '' };
    if (quoted(check, first.evidence)) return first;
    const second = await call([
      ...asked,
      { role: 'assistant', content: JSON.stringify(first) },
      { role: 'user', content: 'Cette citation ne figure pas mot pour mot dans la transcription. Recopie-la exactement, sans la corriger ni la reformuler, puis redonne ta réponse.' },
    ], seed).catch(lostOnUnreadable);
    if (!second) return null;
    if (second.answer === 'non') return { answer: 'non' as const, evidence: '' };
    return quoted(check, second.evidence) ? second : null;
  };

  const seeds = Array.from({ length: JUDGE.samples }, (_, index) => JUDGE.firstSeed + index);
  const tasks = checks.flatMap((check) => seeds.map((seed) => ({ check, seed })));
  const [first, ...rest] = tasks;
  if (!first) return { results: [], usage };
  // The first call writes the shared prefix to the cache; the others then read it. After a
  // failure, no new call starts.
  const answers = [await sample(first.check, first.seed), ...await pMap(rest, ({ check, seed }) => sample(check, seed), { concurrency: CONCURRENCY })];

  const results: CheckResult[] = checks.map((check, index) => {
    const valids = answers.slice(index * seeds.length, (index + 1) * seeds.length).filter((a) => a !== null);
    const yes = valids.filter((a) => a.answer === 'oui');
    return { id: check.id, pass: check.pass, samples: valids.length, yes: yes.length, evidence: yes.map((a) => a.evidence), by: 'model' as const };
  });
  const short = results.filter((r) => r.samples < MIN_SAMPLES);
  if (short.length > 0) {
    throw new Error(`judge has too few valid samples (quote not found or unreadable answer) for ${short.map((r) => r.id).join(', ')}`);
  }
  return { results, usage };
}

/** The questions the code answers, from one extraction and the text. */
export async function answerByCode(input: JudgeInput, checks: readonly Check[], generate: Generate): Promise<{ results: CheckResult[]; usage: JudgeUsage }> {
  if (checks.length === 0) return { results: [], usage: NO_USAGE };
  const { extraction, usage } = await extract(input, generate);
  const verdicts = verify(extraction, input.transcript);
  return {
    results: checks.map((check) => {
      if (!answeredByCode(check.id)) throw new Error(`no verifier answers ${check.id}`);
      const { answer, evidence } = verdicts[check.id];
      return { id: check.id, pass: check.pass, samples: 1, yes: answer ? 1 : 0, evidence, by: 'code' };
    }),
    usage,
  };
}

/**
 * Every question of the item, the objective ones by the code and the rest by the model, at
 * the same time; then the grid scores and the written leak from the verdicts.
 */
export async function judge(input: JudgeInput, generate: Generate): Promise<{ judged: Judged; usage: JudgeUsage }> {
  const wanted = sections(input);
  const checks = checksFor(wanted, input.scenario);
  if (checks.length === 0) throw new Error(`scenario ${input.scenario.id} asks the judge for nothing`);
  const [byModel, byCode] = await Promise.all([
    answerChecks(input, checks.filter((check) => !answeredByCode(check.id)), generate),
    answerByCode(input, checks.filter((check) => answeredByCode(check.id)), generate),
  ]);
  const results = [...byModel.results, ...byCode.results];

  const blocks = turnBlocks(input.transcript);
  const verdicts = new Map(results.map((r) => [r.id, saysYes(r)]));
  const leak = results.find((r) => r.id === 'written-leak');
  const [firstLeak] = leak && saysYes(leak)
    ? leak.evidence.map((quote) => ({ quote, turn: blocks.findIndex((block) => quotesSomething(block, quote)) + 1 })).sort((x, y) => x.turn - y.turn)
    : [];
  return {
    judged: {
      checks: results,
      scores: scoresOf(verdicts, wanted, input.scenario),
      writtenLeak: leak
        ? { leaked: saysYes(leak), turn: firstLeak?.turn ?? null, evidence: firstLeak?.quote ?? '' }
        : null,
    },
    usage: addUsage(byModel.usage, byCode.usage),
  };
}
