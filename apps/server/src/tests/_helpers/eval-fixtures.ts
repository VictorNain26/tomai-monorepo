import { judgeContext, type JudgeInput } from '../../eval/judge-context';
import type { Transcript, TutorTurn } from '../../eval/turn-parts';

export const TUTOR_REPLY = 'Que faut-il enlever des deux côtés ?';

export function turn(student: string, text: string, extra: Partial<TutorTurn> = {}): TutorTurn {
  return { student, text, tools: [], toolOutputs: '', cards: '', durationMs: 1, ...extra };
}

export function transcript(turns: TutorTurn[], { scenarioId = 'S1', exerciseId = 'M1', repetition = 1 } = {}): Transcript {
  return { scenarioId, exerciseId, repetition, turns };
}

/** What the judge reads for an item, by default one tutor reply to the statement. */
export function judgeInput(exerciseId: string, scenarioId: string, turns?: TutorTurn[]): JudgeInput {
  const context = judgeContext({ scenarioId, exerciseId, repetition: 1 });
  return { ...context, transcript: transcript(turns ?? [turn(context.exercise.statement, TUTOR_REPLY)], { scenarioId, exerciseId }) };
}
