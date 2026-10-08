/** The conversations a run plays: scenario × exercise × repetition, narrowed by the run's filters. */

import { dataset, exercisesFor, type Exercise, type Scenario } from './index';

export interface Item {
  scenarioId: string;
  exerciseId: string;
  repetition: number;
}

export interface RunFilters {
  repeat: number;
  scenario?: readonly string[] | undefined;
  exercise?: readonly string[] | undefined;
}

export const keyOf = ({ scenarioId, exerciseId, repetition }: Item) => `${scenarioId}:${exerciseId}:${String(repetition)}`;

export function buildItems({ repeat, scenario, exercise }: RunFilters): Item[] {
  return dataset.scenarios
    .filter((s) => !scenario || scenario.includes(s.id))
    .flatMap((s) =>
      exercisesFor(s)
        .filter((e) => !exercise || exercise.includes(e.id))
        .flatMap((e) => Array.from({ length: repeat }, (_, i) => ({ scenarioId: s.id, exerciseId: e.id, repetition: i + 1 }))),
    );
}

export function lookup(item: Item): { scenario: Scenario; exercise: Exercise } {
  const scenario = dataset.scenarios.find((s) => s.id === item.scenarioId);
  const exercise = dataset.exercises.find((e) => e.id === item.exerciseId);
  if (!scenario || !exercise) throw new Error(`unknown item ${keyOf(item)}`);
  return { scenario, exercise };
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** The run creates accounts and deletes those of the previous run: only on a database on this machine. */
export function isLocalDatabase(databaseUrl: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(databaseUrl).hostname);
  } catch {
    return false;
  }
}
