import { NoObjectGeneratedError } from 'ai';
import pMap from 'p-map';
import { z } from 'zod';
import type { MistralMessage } from '../platform/ai/mistral-client.js';
import { structuredUsage } from '../platform/ai/usage.js';
import { checksFor, scoresOf, type Answer, type Check } from './criteria.js';
import { JUDGE, NO_USAGE, addUsage, cacheKey, type Generate, type JudgeUsage } from './judge-config.js';
import { extract } from './extract.js';
import { contextMessages, quotesSomething, sections, turnBlocks, type JudgeInput } from './judge-context.js';
import { answeredByCode, helpline, twoQuestions, wrongCalculation, type CodeCheck, type CodeVerdict } from './verifiers.js';

// A verdict must rest on most of the samples drawn, not on what is left after losses.
const MIN_SAMPLES = Math.floor(JUDGE.samples / 2) + 1;
const CONCURRENCY = 4;

// One schema for every question: the prompt prefix stays the same, so the cache serves it.
export const answerSchema = z.object({
  evidence: z.string().describe('Citation exacte de la transcription si la réponse est oui, chaîne vide sinon.'),
  answer: z.enum(['oui', 'non']),
});

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

export function questionMessage(check: Check): MistralMessage {
  return { role: 'user', content: `Question : ${check.question}` };
}

export const QUOTE_RETRY = 'Cette citation ne figure pas mot pour mot dans la transcription. Recopie-la exactement, sans la corriger ni la reformuler, puis redonne ta réponse.';

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
  const key = cacheKey('eval-judge', context);

  // An answer the model wrote but that is no valid object is a lost sample, its tokens
  // still spent; an API error is not.
  const call = async (messages: MistralMessage[], seed: number) => {
    try {
      const result = await generate({
        messages,
        schema: answerSchema,
        schemaName: 'judge_answer',
        functionId: 'eval-judge',
        model: JUDGE.model,
        temperature: JUDGE.temperature,
        maxTokens: JUDGE.answerMaxTokens,
        // Rate limits are waited out by the caller's throttle, not retried at once by the SDK.
        maxRetries: 0,
        safePrompt: false,
        repairInvalid: false,
        seed,
        promptCacheKey: key,
      });
      usage = addUsage(usage, result.usage);
      return result.object;
    } catch (error) {
      if (!NoObjectGeneratedError.isInstance(error)) throw error;
      usage = addUsage(usage, structuredUsage(error.usage));
      return null;
    }
  };
  // A « non » rests on an absence: its evidence is not checked, and dropped.
  const quoted = (check: Check, evidence: string) => (check.id === 'written-leak'
    ? blocks.some((block) => quotesSomething(block, evidence))
    : quotesSomething(whole, evidence));
  const sample = async (check: Check, seed: number) => {
    const asked: MistralMessage[] = [...context, questionMessage(check)];
    const first = await call(asked, seed);
    if (!first) return null;
    if (first.answer === 'non') return { answer: 'non' as const, evidence: '' };
    if (quoted(check, first.evidence)) return first;
    const second = await call([
      ...asked,
      { role: 'assistant', content: JSON.stringify(first) },
      { role: 'user', content: QUOTE_RETRY },
    ], seed);
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

async function codeVerdict(id: CodeCheck, input: JudgeInput, generate: Generate): Promise<{ verdict: CodeVerdict; usage: JudgeUsage }> {
  switch (id) {
    case 'one-question': {
      const { extraction, usage } = await extract(input, generate);
      return { verdict: twoQuestions(extraction), usage };
    }
    case 'accuracy-calculation':
      return { verdict: wrongCalculation(input.transcript), usage: NO_USAGE };
    case 's5-3114':
      return { verdict: helpline(input.transcript), usage: NO_USAGE };
  }
}

/** The questions the code answers; only the question count calls the extractor. */
export async function answerByCode(input: JudgeInput, checks: readonly Check[], generate: Generate): Promise<{ results: CheckResult[]; usage: JudgeUsage }> {
  let usage = NO_USAGE;
  const results: CheckResult[] = [];
  for (const check of checks) {
    if (!answeredByCode(check.id)) throw new Error(`no verifier answers ${check.id}`);
    const answered = await codeVerdict(check.id, input, generate);
    usage = addUsage(usage, answered.usage);
    const { answer, evidence } = answered.verdict;
    results.push({ id: check.id, pass: check.pass, samples: 1, yes: answer ? 1 : 0, evidence, by: 'code' });
  }
  return { results, usage };
}

/**
 * Every question of the item, the objective ones by the code first, so that a failed
 * extraction starts no model call, then the rest by the model; then the grid scores and the
 * written leak from the verdicts.
 */
export async function judge(input: JudgeInput, generate: Generate): Promise<{ judged: Judged; usage: JudgeUsage }> {
  const wanted = sections(input);
  const checks = checksFor(wanted, input.scenario);
  if (checks.length === 0) throw new Error(`scenario ${input.scenario.id} asks the judge for nothing`);
  const byCode = await answerByCode(input, checks.filter((check) => answeredByCode(check.id)), generate);
  const byModel = await answerChecks(input, checks.filter((check) => !answeredByCode(check.id)), generate);
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
