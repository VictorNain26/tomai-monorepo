import type { Evaluation } from '@langfuse/client';
import { detectLeak, leakRates, type LeakVerdict } from './evaluators.js';
import { judge, type Judged } from './judge.js';
import { NO_USAGE, addUsage, type Generate, type JudgeUsage } from './judge-config.js';
import { judgeContext } from './judge-context.js';
import { meanScores, verdictScores, writtenLeakVerdict } from './judge-scores.js';
import { keyOf, lookup, type ItemInput } from './items.js';
import { errorMessage } from './output.js';
import type { Transcript } from './turn-parts.js';

type Judgement = { judged: Judged; usage: JudgeUsage } | { error: string };

function leakScore({ leaked, turn, channel, form }: LeakVerdict): Evaluation {
  return { name: 'leak', value: leaked ? 1 : 0, comment: leaked ? `turn ${String(turn)}, ${channel ?? 'judge'}: ${String(form)}` : 'no leak' };
}

function hasError(transcript: Transcript): boolean {
  return transcript.turns.some((turn) => turn.error !== undefined);
}

/**
 * The state of one eval run: transcripts as the task records them, the verdicts of the
 * item evaluators, then the run evaluations and the report, which read them all.
 */
export function evaluationRun(items: readonly ItemInput[], generate: Generate) {
  const transcripts = new Map<string, Transcript>();
  const leaks = new Map<string, LeakVerdict | null>();
  const judgements = new Map<string, Judgement>();

  const leakOf = (input: ItemInput): LeakVerdict | null => {
    const judgement = judgements.get(keyOf(input));
    return leaks.get(keyOf(input)) ?? (judgement && 'judged' in judgement ? writtenLeakVerdict(judgement.judged) : null);
  };

  return {
    record(input: ItemInput, transcript: Transcript): void {
      transcripts.set(keyOf(input), transcript);
    },

    leakEvaluation(input: ItemInput): Evaluation[] {
      const transcript = transcripts.get(keyOf(input));
      if (!transcript) return [];
      const { scenario, exercise } = lookup(input);
      const verdict = detectLeak(transcript, exercise, scenario);
      leaks.set(keyOf(input), verdict);
      const failed = transcript.turns.find((turn) => turn.error !== undefined);
      return [
        ...(verdict ? [leakScore(verdict)] : []),
        ...(failed?.error ? [{ name: 'run_error', value: 1, comment: failed.error }] : []),
      ];
    },

    /** A conversation cut short by an error is not judged: its grades would not be comparable. */
    async judgeEvaluation(input: ItemInput): Promise<Evaluation[]> {
      const transcript = transcripts.get(keyOf(input));
      if (!transcript || hasError(transcript)) return [];
      try {
        const judged = await judge({ ...judgeContext(input), transcript }, generate);
        judgements.set(keyOf(input), judged);
        const written = writtenLeakVerdict(judged.judged);
        return [...verdictScores(judged.judged), ...(written ? [leakScore(written)] : [])];
      } catch (error) {
        const message = errorMessage(error);
        judgements.set(keyOf(input), { error: message });
        return [{ name: 'judge_error', value: 1, comment: message }];
      }
    },

    /** Leak rates, deterministic and judged together, then the means of the judge's grades. */
    runEvaluations(): Evaluation[] {
      const rates = leakRates(items.map((input) => ({ scenarioId: input.scenarioId, verdict: leakOf(input) })))
        .map(({ scope, leaked, total, rate }) => ({ name: `leak_rate_${scope}`, value: rate, comment: `${String(leaked)}/${String(total)}` }));
      const means = meanScores(items.flatMap((input) => {
        const judgement = judgements.get(keyOf(input));
        return judgement && 'judged' in judgement ? [{ scenarioId: input.scenarioId, scores: verdictScores(judgement.judged) }] : [];
      }));
      return [...rates, ...means];
    },

    report() {
      return items.map((input) => ({
        ...input,
        transcript: transcripts.get(keyOf(input)) ?? null,
        leak: leakOf(input),
        judgement: judgements.get(keyOf(input)) ?? null,
      }));
    },

    judgeUsage(): JudgeUsage {
      return [...judgements.values()].reduce((total, j) => ('usage' in j ? addUsage(total, j.usage) : total), NO_USAGE);
    },

    /** Keys of the conversations that failed: never played, cut by an error, or not judged. */
    failures(): string[] {
      return items.filter((input) => {
        const transcript = transcripts.get(keyOf(input));
        const judgement = judgements.get(keyOf(input));
        return !transcript || hasError(transcript) || (judgement !== undefined && 'error' in judgement);
      }).map(keyOf);
    },
  };
}
