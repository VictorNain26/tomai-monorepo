/**
 * `bun run eval`: replays the scenarios of the dataset against the agent, through the real
 * chat route, and records an experiment in Langfuse. Transcripts, verdicts and the run
 * evaluations (leak and artifact rates, means) are written to `eval-results/`: Langfuse only stores run
 * evaluations for an experiment on a dataset it hosts, and this one runs on local data.
 *
 * Tracing must be in place before the app is imported, as in `src/index.ts`: the app goes
 * through a dynamic import.
 */
import { parseArgs } from 'node:util';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { LangfuseClient, type Evaluator, type RunEvaluator } from '@langfuse/client';
import { setupOtel, shutdownOtel } from '../platform/observability/otel.js';
import { resolveDatabaseUrl } from '../platform/config/database-url.js';
import { criteriaFor } from './criteria.js';
import { evaluationRun } from './evaluation-run.js';
import { throttled } from './judge-rate.js';
import { briefing, judgeContext, sections, transcriptText } from './judge-context.js';
import { buildItems, isLocalDatabase, itemInput, keyOf, lookup, runOptions, samplePairs, unknownPairs, type ItemInput } from './items.js';
import { judgeIdentity } from './judge-version.js';
import { commit, stamp, tokenLine, writeResult } from './output.js';

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
      // Two conversations at once draw HTTP 429 from Mistral on this account (2026-10-03).
      concurrency: { type: 'string', default: '1' },
      sample: { type: 'string' },
      'skip-judge': { type: 'boolean', default: false },
    },
  });
  const options = runOptions.parse(values);
  const sample = options.sample ? samplePairs.parse(await Bun.file(options.sample).json()) : undefined;
  const unknown = sample ? unknownPairs(sample) : [];
  if (unknown.length > 0) {
    console.error(`sample pairs not in the dataset: ${unknown.map((p) => `${p.scenarioId}:${p.exerciseId}`).join(', ')}`);
    return 1;
  }
  const items = buildItems(options, sample);
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

    const run = evaluationRun(items, throttled(generateStructured));
    const codeEvaluator: Evaluator<ItemInput> = ({ input }) => Promise.resolve(run.codeEvaluation(input));
    const judgeEvaluator: Evaluator<ItemInput> = ({ input }) => run.judgeEvaluation(input);
    const runEvaluator: RunEvaluator<ItemInput> = () => Promise.resolve(run.runEvaluations());

    const sha = commit();
    const runName = `${stamp()}-${sha}`;
    const judge = options['skip-judge'] ? null : judgeIdentity(sha);
    const result = await new LangfuseClient().experiment.run<ItemInput>({
      name: 'tom-eval',
      runName,
      description: 'Scenarios of apps/server/src/eval replayed through /api/chat/stream; deterministic leak check and dated judge.',
      metadata: { model: env.MISTRAL_MODEL, judge: judge ?? 'skipped', commit: sha, items: items.length },
      // The briefing and the criteria make the trace readable for a human annotator.
      data: items.map((input) => {
        const context = judgeContext(input);
        return {
          input: { ...input, briefing: briefing(context), criteria: criteriaFor(sections(context)).map((criterion) => criterion.name) },
          metadata: { level: context.exercise.level },
        };
      }),
      task: async ({ input }) => {
        const item = itemInput.parse(input);
        const { scenario, exercise } = lookup(item);
        const transcript = await playConversation(scenario, exercise, item.repetition);
        run.record(item, transcript);
        return transcriptText(transcript);
      },
      evaluators: options['skip-judge'] ? [codeEvaluator] : [codeEvaluator, judgeEvaluator],
      runEvaluators: [runEvaluator],
      maxConcurrency: options.concurrency,
    });
    console.log(await result.format());

    const traceIds = new Map(result.itemResults.flatMap(({ item, traceId }) => {
      const parsed = itemInput.safeParse(item.input);
      return parsed.success && traceId ? [[keyOf(parsed.data), traceId] as const] : [];
    }));
    const judgeUsage = run.judgeUsage();
    console.log(await writeResult(runName, {
      runName,
      model: env.MISTRAL_MODEL,
      judge,
      judgeUsage,
      runEvaluations: result.runEvaluations,
      report: run.report().map((row) => ({ ...row, traceId: traceIds.get(keyOf(row)) ?? null })),
    }));
    console.log(tokenLine(judgeUsage));

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
