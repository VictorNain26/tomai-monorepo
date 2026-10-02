import sixieme from './exercises/sixieme.json' with { type: 'json' };
import cinquieme from './exercises/cinquieme.json' with { type: 'json' };
import quatrieme from './exercises/quatrieme.json' with { type: 'json' };
import troisieme from './exercises/troisieme.json' with { type: 'json' };
import scenarios from './scenarios.json' with { type: 'json' };
import { datasetSchema, STATEMENT_PLACEHOLDER, type Exercise, type Scenario } from './schema.js';

export type { Exercise, Scenario };

export const dataset = datasetSchema.parse({
  exercises: [...sixieme, ...cinquieme, ...quatrieme, ...troisieme],
  scenarios,
});

export function exercisesFor(scenario: Scenario): Exercise[] {
  const { exercises: targets } = scenario;
  if (targets === 'all') return dataset.exercises;
  return dataset.exercises.filter(({ id }) => targets.includes(id));
}

export function renderTurns(scenario: Scenario, exercise: Exercise): string[] {
  return scenario.turns.map((turn) => turn.replaceAll(STATEMENT_PLACEHOLDER, () => exercise.statement));
}
