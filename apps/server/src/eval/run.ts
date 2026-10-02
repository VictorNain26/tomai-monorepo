/**
 * `bun run eval`: replays the scenarios of the dataset against the agent, through the real
 * chat route, and records an experiment in Langfuse. Transcripts and verdicts are also
 * written to `eval-results/` for the report.
 *
 * Tracing must be in place before the app is imported, as in `src/index.ts`: the app goes
 * through a dynamic import.
 */
import { parseArgs } from 'node:util';
import { mkdir } from 'node:fs/promises';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { LangfuseClient, type Evaluation, type Evaluator, type RunEvaluator } from '@langfuse/client';
import { setupOtel, shutdownOtel } from '../platform/observability/otel.js';
import { resolveDatabaseUrl } from '../platform/config/database-url.js';
import { detectLeak, leakRates, type LeakVerdict } from './evaluators.js';
import { buildItems, isLocalDatabase, itemInput, keyOf, lookup, runOptions, type ItemInput } from './items.js';
import type { Transcript } from './turn-parts.js';

async function main(): Promise<number> {
  if (!isLocalDatabase(resolveDatabaseUrl())) {
    console.error('eval only runs against a database on this machine: it creates and deletes accounts.');
    return 1;
  }
  const { values } = parseArgs({
    options: {
      scenario: { type: 'string', multiple: true },
      exercise: { type: 'string', multiple: true },
      repeat: { type: 'string', default: '1' },
      concurrency: { type: 'string', default: '2' },
    },
  });
  const options = runOptions.parse(values);
  const items = buildItems(options);
  if (items.length === 0) {
    console.error('no item matches the filters');
    return 1;
  }

  setupOtel([new LangfuseSpanProcessor()]);
  try {
    const { playConversation, removeEvalAccounts } = await import('./conversation.js');
    const { env } = await import('../platform/config/env.js');
    console.log(`removed ${String(await removeEvalAccounts())} account(s) of the previous run`);

    const transcripts = new Map<string, Transcript>();
    const verdicts = new Map<string, LeakVerdict | null>();

    const leakEvaluation = (input: ItemInput): Evaluation[] => {
      const transcript = transcripts.get(keyOf(input));
      if (!transcript) return [];
      const { scenario, exercise } = lookup(input);
      const verdict = detectLeak(transcript, exercise, scenario);
      verdicts.set(keyOf(input), verdict);
      const evaluations: Evaluation[] = [];
      if (verdict) {
        evaluations.push({
          name: 'leak',
          value: verdict.leaked ? 1 : 0,
          comment: verdict.leaked ? `turn ${String(verdict.turn)}, ${String(verdict.channel)}: ${String(verdict.form)}` : 'no leak',
        });
      }
      const failed = transcript.turns.find((turn) => turn.error !== undefined);
      if (failed?.error) evaluations.push({ name: 'run_error', value: 1, comment: failed.error });
      return evaluations;
    };

    const leakEvaluator: Evaluator<ItemInput> = ({ input }) => Promise.resolve(leakEvaluation(input));

    const leakRateEvaluator: RunEvaluator<ItemInput> = () => Promise.resolve(
      leakRates(items.map((input) => ({ scenarioId: input.scenarioId, verdict: verdicts.get(keyOf(input)) ?? null })))
        .map(({ scope, leaked, total, rate }) => ({ name: `leak_rate_${scope}`, value: rate, comment: `${String(leaked)}/${String(total)}` })),
    );

    const sha = Bun.spawnSync(['git', 'rev-parse', '--short', 'HEAD']).stdout.toString().trim() || 'unknown';
    const runName = `${new Date().toISOString().slice(0, 16).replace(':', 'h')}-${sha}`;
    const result = await new LangfuseClient().experiment.run<ItemInput>({
      name: 'tom-leak',
      runName,
      description: 'Scenarios of apps/server/src/eval replayed through /api/chat/stream; deterministic leak check.',
      metadata: { model: env.MISTRAL_MODEL, gitSha: sha, items: items.length },
      data: items.map((input) => ({ input, metadata: { level: lookup(input).exercise.level } })),
      task: async ({ input }) => {
        const item = itemInput.parse(input);
        const { scenario, exercise } = lookup(item);
        const transcript = await playConversation(scenario, exercise, item.repetition);
        transcripts.set(keyOf(item), transcript);
        return transcript;
      },
      evaluators: [leakEvaluator],
      runEvaluators: [leakRateEvaluator],
      maxConcurrency: options.concurrency,
    });
    console.log(await result.format());

    await mkdir('eval-results', { recursive: true });
    const report = items.map((input) => ({
      ...input,
      transcript: transcripts.get(keyOf(input)) ?? null,
      verdict: verdicts.get(keyOf(input)) ?? null,
    }));
    await Bun.write(`eval-results/${runName}.json`, JSON.stringify({ runName, model: env.MISTRAL_MODEL, report }, null, 2));
    console.log(`eval-results/${runName}.json`);

    const broken = report.filter((row) => !row.transcript || row.transcript.turns.some((turn) => turn.error !== undefined));
    if (broken.length > 0) {
      console.error(`${String(broken.length)} conversation(s) failed: ${broken.map((row) => keyOf(row)).join(', ')}`);
      return 1;
    }
    return 0;
  } finally {
    // The DB pool is left to the process exit: the route still writes session titles and
    // summaries in the background. They are not measured; closing the pool here would only
    // turn them into logged failures.
    await shutdownOtel();
  }
}

process.exit(await main());
