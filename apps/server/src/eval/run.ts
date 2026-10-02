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
import { z } from 'zod';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { LangfuseClient, type Evaluation, type Evaluator, type RunEvaluator } from '@langfuse/client';
import { registerTelemetry } from 'ai';
import { OpenTelemetry } from '@ai-sdk/otel';
import { dataset, exercisesFor } from './index.js';
import { detectLeak, leakRates, type LeakVerdict } from './evaluators.js';
import type { Transcript } from './conversation.js';

const itemInput = z.object({ scenarioId: z.string(), exerciseId: z.string(), repetition: z.number().int().min(1) });
type ItemInput = z.infer<typeof itemInput>;

const options = z.object({
  scenario: z.array(z.string()).optional(),
  exercise: z.array(z.string()).optional(),
  repeat: z.coerce.number().int().min(1).max(10),
  concurrency: z.coerce.number().int().min(1).max(4),
});

function keyOf({ scenarioId, exerciseId, repetition }: ItemInput): string {
  return `${scenarioId}:${exerciseId}:${String(repetition)}`;
}

function buildItems(args: z.infer<typeof options>): ItemInput[] {
  const scenarios = dataset.scenarios.filter((s) => !args.scenario || args.scenario.includes(s.id));
  return scenarios.flatMap((scenario) =>
    exercisesFor(scenario)
      .filter((e) => !args.exercise || args.exercise.includes(e.id))
      .flatMap((exercise) =>
        Array.from({ length: args.repeat }, (_, i) => ({ scenarioId: scenario.id, exerciseId: exercise.id, repetition: i + 1 })),
      ),
  );
}

function lookup(input: ItemInput) {
  const scenario = dataset.scenarios.find((s) => s.id === input.scenarioId);
  const exercise = dataset.exercises.find((e) => e.id === input.exerciseId);
  if (!scenario || !exercise) throw new Error(`unknown item ${keyOf(input)}`);
  return { scenario, exercise };
}

function gitSha(): string {
  return Bun.spawnSync(['git', 'rev-parse', '--short', 'HEAD']).stdout.toString().trim() || 'unknown';
}

async function main(): Promise<number> {
  if (Bun.env.NODE_ENV === 'production') {
    console.error('eval refuses to run with NODE_ENV=production: it creates and deletes accounts.');
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
  const args = options.parse(values);
  const items = buildItems(args);
  if (items.length === 0) {
    console.error('no item matches the filters');
    return 1;
  }

  const otel = new NodeSDK({ spanProcessors: [new LangfuseSpanProcessor()] });
  otel.start();
  registerTelemetry(new OpenTelemetry());

  const { playConversation, removeEvalAccounts } = await import('./conversation.js');
  const { env } = await import('../platform/config/env.js');
  console.log(`removed ${String(await removeEvalAccounts())} account(s) of the previous run`);

  const transcripts = new Map<string, Transcript>();
  const verdicts = new Map<string, LeakVerdict | null>();

  const leakEvaluation = (input: ItemInput): Evaluation | Evaluation[] => {
    const transcript = transcripts.get(keyOf(input));
    if (!transcript) return [];
    const verdict = detectLeak(transcript, lookup(input).exercise);
    verdicts.set(keyOf(input), verdict);
    const failed = transcript.turns.find((turn) => turn.error !== undefined);
    if (failed?.error) return { name: 'run_error', value: 1, comment: failed.error };
    if (!verdict) return [];
    return {
      name: 'leak',
      value: verdict.leaked ? 1 : 0,
      comment: verdict.leaked ? `turn ${String(verdict.turn)}, ${String(verdict.channel)}: ${String(verdict.form)}` : 'no leak',
    };
  };

  const leakEvaluator: Evaluator<ItemInput> = ({ input }) => Promise.resolve(leakEvaluation(input));

  const leakRateEvaluator: RunEvaluator<ItemInput> = () => Promise.resolve(
    leakRates(items.map((input) => ({ scenarioId: input.scenarioId, verdict: verdicts.get(keyOf(input)) ?? null })))
      .map(({ scope, leaked, total, rate }) => ({ name: `leak_rate_${scope}`, value: rate, comment: `${String(leaked)}/${String(total)}` })),
  );

  const runName = `${new Date().toISOString().slice(0, 16).replace(':', 'h')}-${gitSha()}`;
  const langfuse = new LangfuseClient();
  try {
    const result = await langfuse.experiment.run<ItemInput>({
      name: 'tom-leak',
      runName,
      description: 'Scenarios of apps/server/src/eval replayed through /api/chat/stream; deterministic leak check.',
      metadata: { model: env.MISTRAL_MODEL, gitSha: gitSha(), items: items.length },
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
      maxConcurrency: args.concurrency,
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
    await otel.shutdown();
  }
}

process.exit(await main());
