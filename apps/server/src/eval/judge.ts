import { z } from 'zod';
import type { MistralMessage } from '../platform/ai/mistral-client.js';
import { checksFor, scoresOf, type Answer, type Check } from './criteria.js';
import { JUDGE, MIN_SAMPLES, NO_USAGE, addUsage, cacheKey, type Generate, type JudgeUsage } from './judge-config.js';
import { ACCURACY, falseClaims, tutorSentences } from './claims.js';
import { extract, type Extraction } from './extract.js';
import { contextMessages, quotesSomething, sections, turnBlocks, type JudgeInput } from './judge-context.js';
import { SEEDS, drawAll, sampleObject } from './sampling.js';
import { answerInMaterial, answeredByCode, cardsMade, helpline, questionAfterDistress, twoQuestions, wrongCalculation, type CodeCheck, type CodeVerdict } from './verifiers.js';

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
  /**
   * Who answered: the model in samples, the code once (`samples` 1, `yes` 0 or 1), or the
   * model sentence by sentence for accuracy, counted like the code.
   */
  by: 'model' | 'code' | 'claims';
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
  const spend = (spent: JudgeUsage) => { usage = addUsage(usage, spent); };
  const key = cacheKey('eval-judge', context);
  const call = (messages: MistralMessage[], seed: number) => sampleObject(generate, {
    messages,
    schema: answerSchema,
    schemaName: 'judge_answer',
    functionId: 'eval-judge',
    maxTokens: JUDGE.answerMaxTokens,
    seed,
    promptCacheKey: key,
  }, spend);
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

  const answers = await drawAll(checks.flatMap((check) => SEEDS.map((seed) => ({ check, seed }))), ({ check, seed }) => sample(check, seed));

  const results: CheckResult[] = checks.map((check, index) => {
    const valids = answers.slice(index * SEEDS.length, (index + 1) * SEEDS.length).filter((a) => a !== null);
    const yes = valids.filter((a) => a.answer === 'oui');
    return { id: check.id, pass: check.pass, samples: valids.length, yes: yes.length, evidence: yes.map((a) => a.evidence), by: 'model' as const };
  });
  const short = results.filter((r) => r.samples < MIN_SAMPLES);
  if (short.length > 0) {
    throw new Error(`judge has too few valid samples (quote not found or unreadable answer) for ${short.map((r) => r.id).join(', ')}`);
  }
  return { results, usage };
}

async function codeVerdict(id: CodeCheck, input: JudgeInput, extraction: () => Promise<Extraction>): Promise<CodeVerdict> {
  switch (id) {
    case 'one-question':
      return twoQuestions(await extraction());
    case 'accuracy-calculation':
      return wrongCalculation(input.transcript);
    case 's4-answer-in-material':
      return answerInMaterial(input);
    case 's4-cards':
      return cardsMade(input.transcript);
    case 's5-3114':
      return helpline(input.transcript);
    case 's5-question-after':
      return questionAfterDistress(input.transcript);
  }
}

/** The questions the code answers; the extractor runs once at most, for the question count. */
async function answerByCode(input: JudgeInput, checks: readonly Check[], generate: Generate): Promise<{ results: CheckResult[]; usage: JudgeUsage }> {
  let usage = NO_USAGE;
  let extracted: Extraction | undefined;
  const extraction = async () => {
    if (!extracted) {
      const result = await extract(input, generate);
      usage = addUsage(usage, result.usage);
      extracted = result.extraction;
    }
    return extracted;
  };
  const results: CheckResult[] = [];
  for (const check of checks) {
    if (!answeredByCode(check.id)) throw new Error(`no verifier answers ${check.id}`);
    const { answer, evidence } = await codeVerdict(check.id, input, extraction);
    results.push({ id: check.id, pass: check.pass, samples: 1, yes: answer ? 1 : 0, evidence, by: 'code' });
  }
  return { results, usage };
}

/** Who answers a judge question: the code, the model sentence by sentence, or the model in samples. */
export function answerer(id: string): CheckResult['by'] {
  if (answeredByCode(id)) return 'code';
  return id === ACCURACY ? 'claims' : 'model';
}

/** Accuracy: false when most samples judge one of the sentences shown to the student false. */
async function answerAccuracy(input: JudgeInput, check: Check, generate: Generate): Promise<{ result: CheckResult; usage: JudgeUsage }> {
  const { found, usage } = await falseClaims(input, tutorSentences(input.transcript), generate);
  const evidence = found.map(({ claim, votes, samples }) => `${claim} (${String(votes)}/${String(samples)})`);
  return { result: { id: check.id, pass: check.pass, samples: 1, yes: found.length > 0 ? 1 : 0, evidence, by: 'claims' }, usage };
}

/**
 * The given questions: the code's first, so that a failed extraction or verifier starts no
 * other model call, then accuracy sentence by sentence, then the model's in samples.
 */
export async function answerQuestions(input: JudgeInput, checks: readonly Check[], generate: Generate): Promise<{ results: CheckResult[]; usage: JudgeUsage }> {
  const byCode = await answerByCode(input, checks.filter((check) => answerer(check.id) === 'code'), generate);
  const accuracy = checks.find((check) => answerer(check.id) === 'claims');
  const byClaims = accuracy ? await answerAccuracy(input, accuracy, generate) : null;
  const byModel = await answerChecks(input, checks.filter((check) => answerer(check.id) === 'model'), generate);
  return {
    results: [...byModel.results, ...(byClaims ? [byClaims.result] : []), ...byCode.results],
    usage: addUsage(addUsage(byModel.usage, byClaims?.usage ?? NO_USAGE), byCode.usage),
  };
}

/** Every question of the item, then the grid scores and the written leak from the verdicts. */
export async function judge(input: JudgeInput, generate: Generate): Promise<{ judged: Judged; usage: JudgeUsage }> {
  const wanted = sections(input);
  const checks = checksFor(wanted, input.scenario);
  if (checks.length === 0) throw new Error(`scenario ${input.scenario.id} asks the judge for nothing`);
  const { results, usage } = await answerQuestions(input, checks, generate);

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
    usage,
  };
}
