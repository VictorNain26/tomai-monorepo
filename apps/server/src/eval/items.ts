import { z } from 'zod';
import { dataset, exercisesFor, type Exercise, type Scenario } from './index.js';

export const itemInput = z.object({ scenarioId: z.string(), exerciseId: z.string(), repetition: z.number().int().min(1) });
export type ItemInput = z.infer<typeof itemInput>;

export const samplePairs = z.array(z.object({ scenarioId: z.string(), exerciseId: z.string() })).min(1);
export type SamplePairs = z.infer<typeof samplePairs>;

export const runOptions = z.object({
  scenario: z.array(z.string()).optional(),
  exercise: z.array(z.string()).optional(),
  repeat: z.coerce.number().int().min(1).max(10),
  concurrency: z.coerce.number().int().min(1).max(4),
  /** A JSON file of scenario × exercise pairs to play instead of every pair. */
  sample: z.string().optional(),
  /** Leak check only, without the paid judge. */
  'skip-judge': z.boolean().default(false),
});
export type RunOptions = z.infer<typeof runOptions>;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function keyOf({ scenarioId, exerciseId, repetition }: ItemInput): string {
  return `${scenarioId}:${exerciseId}:${String(repetition)}`;
}

/**
 * Scenario × exercise × repetition, narrowed by the `--scenario` and `--exercise` filters,
 * and to the pairs of a sample when one is given.
 */
export function buildItems(options: RunOptions, sample?: SamplePairs): ItemInput[] {
  return dataset.scenarios
    .filter((s) => !options.scenario || options.scenario.includes(s.id))
    .flatMap((scenario) =>
      exercisesFor(scenario)
        .filter((e) => !options.exercise || options.exercise.includes(e.id))
        .filter((e) => !sample || sample.some((pair) => pair.scenarioId === scenario.id && pair.exerciseId === e.id))
        .flatMap((exercise) =>
          Array.from({ length: options.repeat }, (_, i) => ({ scenarioId: scenario.id, exerciseId: exercise.id, repetition: i + 1 })),
        ),
    );
}

/** Pairs of a sample that are not a scenario × exercise of the dataset: a typo would play fewer. */
export function unknownPairs(sample: SamplePairs): SamplePairs {
  return sample.filter(({ scenarioId, exerciseId }) => {
    const scenario = dataset.scenarios.find((s) => s.id === scenarioId);
    return !scenario || !exercisesFor(scenario).some((e) => e.id === exerciseId);
  });
}

export function lookup(input: ItemInput): { scenario: Scenario; exercise: Exercise } {
  const scenario = dataset.scenarios.find((s) => s.id === input.scenarioId);
  const exercise = dataset.exercises.find((e) => e.id === input.exerciseId);
  if (!scenario || !exercise) throw new Error(`unknown item ${keyOf(input)}`);
  return { scenario, exercise };
}

/**
 * The run creates student accounts and hard-deletes those of the previous run: it only
 * targets a database on this machine (local dev, or the CI service container).
 */
export function isLocalDatabase(databaseUrl: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(databaseUrl).hostname);
  } catch {
    return false;
  }
}
