import sixieme from './exercises/sixieme.json' with { type: 'json' };
import cinquieme from './exercises/cinquieme.json' with { type: 'json' };
import quatrieme from './exercises/quatrieme.json' with { type: 'json' };
import troisieme from './exercises/troisieme.json' with { type: 'json' };
import scenarios from './scenarios.json' with { type: 'json' };
import { datasetSchema, STATEMENT_PLACEHOLDER, turnText, type Exercise, type Scenario } from './schema.js';

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

export interface StudentTurn {
  text: string;
  /** Said into the microphone: the turn goes through the voice channel. */
  voice: boolean;
}

export function renderTurns(scenario: Scenario, exercise: Exercise): StudentTurn[] {
  return scenario.turns.map((turn) => ({
    text: turnText(turn).replaceAll(STATEMENT_PLACEHOLDER, () => exercise.statement),
    voice: typeof turn !== 'string',
  }));
}
