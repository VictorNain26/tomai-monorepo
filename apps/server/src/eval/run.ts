/**
 * `bun run eval`: replays the scenarios of the dataset against the agent, through the real
 * chat route, and records an experiment in Langfuse. Transcripts, verdicts and the run
 * evaluations (leak rates, means) are written to `eval-results/`: Langfuse only stores run
 * evaluations for an experiment on a dataset it hosts, and this one runs on local data.
 *
 * Tracing must be in place before the app is imported, as in `src/index.ts`: the app goes
 * through a dynamic import.
 */
import { parseArgs } from 'node:util';
import { mkdir } from 'node:fs/promises';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { LangfuseClient, type Evaluator, type RunEvaluator } from '@langfuse/client';
import { setupOtel, shutdownOtel } from '../platform/observability/otel.js';
import { resolveDatabaseUrl } from '../platform/config/database-url.js';
import { evaluationRun } from './evaluation-run.js';
import { JUDGE } from './judge.js';
import { buildItems, isLocalDatabase, itemInput, lookup, runOptions, type ItemInput } from './items.js';

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
      'skip-judge': { type: 'boolean', default: false },
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
    const { generateStructured } = await import('../platform/ai/mistral-client.js');
    console.log(`removed ${String(await removeEvalAccounts())} account(s) of the previous run`);

    const run = evaluationRun(items, generateStructured);
    const leakEvaluator: Evaluator<ItemInput> = ({ input }) => Promise.resolve(run.leakEvaluation(input));
    const judgeEvaluator: Evaluator<ItemInput> = ({ input }) => run.judgeEvaluation(input);
    const runEvaluator: RunEvaluator<ItemInput> = () => Promise.resolve(run.runEvaluations());

    const sha = Bun.spawnSync(['git', 'rev-parse', '--short', 'HEAD']).stdout.toString().trim() || 'unknown';
    const runName = `${new Date().toISOString().slice(0, 16).replace(':', 'h')}-${sha}`;
    const result = await new LangfuseClient().experiment.run<ItemInput>({
      name: 'tom-eval',
      runName,
      description: 'Scenarios of apps/server/src/eval replayed through /api/chat/stream; deterministic leak check and dated judge.',
      metadata: { model: env.MISTRAL_MODEL, judge: options['skip-judge'] ? 'skipped' : JUDGE, gitSha: sha, items: items.length },
      data: items.map((input) => ({ input, metadata: { level: lookup(input).exercise.level } })),
      task: async ({ input }) => {
        const item = itemInput.parse(input);
        const { scenario, exercise } = lookup(item);
        const transcript = await playConversation(scenario, exercise, item.repetition);
        run.record(item, transcript);
        return transcript;
      },
      evaluators: options['skip-judge'] ? [leakEvaluator] : [leakEvaluator, judgeEvaluator],
      runEvaluators: [runEvaluator],
      maxConcurrency: options.concurrency,
    });
    console.log(await result.format());

    await mkdir('eval-results', { recursive: true });
    const judgeUsage = run.judgeUsage();
    await Bun.write(`eval-results/${runName}.json`, JSON.stringify({
      runName,
      model: env.MISTRAL_MODEL,
      judge: options['skip-judge'] ? null : JUDGE,
      judgeUsage,
      runEvaluations: result.runEvaluations,
      report: run.report(),
    }, null, 2));
    console.log(`eval-results/${runName}.json`);
    console.log(`judge tokens: ${String(judgeUsage.inputTokens)} in (${String(judgeUsage.cachedInputTokens)} cached), ${String(judgeUsage.outputTokens)} out`);

    const failures = run.failures();
    if (failures.length > 0) {
      console.error(`${String(failures.length)} conversation(s) failed: ${failures.join(', ')}`);
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
