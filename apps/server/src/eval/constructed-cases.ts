import { z } from 'zod';
import rawCases from './constructed-cases.json' with { type: 'json' };
import { CRITERIA } from './annotation.js';
import { dataset, exercisesFor } from './index.js';
import { sections } from './judge-context.js';
import { STATEMENT_PLACEHOLDER } from './schema.js';
import type { Transcript } from './turn-parts.js';

const text = z.string().trim().min(1);

const caseSchema = z.strictObject({
  id: text,
  fault: text,
  scenarioId: text,
  exerciseId: text,
  /** The score the fault must move, and its value without and with the fault. */
  criterion: text,
  clean: z.number(),
  faulty: z.number(),
  turns: z.array(z.strictObject({ student: text, tutor: text })).min(1),
  /** 1-based turn whose tutor message carries the fault. */
  faultyTurn: z.number().int().min(1),
  faultyTutor: text,
});
export type ConstructedCase = z.infer<typeof caseSchema>;

/**
 * Cases whose right grade is known by construction: a clean conversation, and the same one
 * where a single tutor message carries one fault.
 */
export const casesSchema = z.array(caseSchema).superRefine((cases, ctx) => {
  const ids = new Set<string>();
  for (const c of cases) {
    const issue = (message: string) => {
      ctx.addIssue({ code: 'custom', message: `case ${c.id}: ${message}` });
    };
    if (ids.has(c.id)) issue('duplicate id');
    ids.add(c.id);
    const scenario = dataset.scenarios.find((s) => s.id === c.scenarioId);
    const exercise = scenario && exercisesFor(scenario).find((e) => e.id === c.exerciseId);
    if (!scenario || !exercise) {
      issue(`no exercise ${c.exerciseId} in scenario ${c.scenarioId}`);
      continue;
    }
    const criterion = CRITERIA.find((x) => x.name === c.criterion);
    if (!criterion?.applies(sections({ exercise, scenario }))) issue(`criterion ${c.criterion} is not graded here`);
    const values = criterion?.categories.map((category) => category.value) ?? [];
    if (!values.includes(c.clean) || !values.includes(c.faulty) || c.clean === c.faulty) issue('clean and faulty grades must be two values of the criterion');
    const turn = c.turns[c.faultyTurn - 1];
    if (!turn) issue('the faulty turn is past the conversation');
    else if (turn.tutor === c.faultyTutor) issue('the faulty message is the clean one');
  }
});

export const constructedCases = casesSchema.parse(rawCases);

/** The clean and the faulty conversation of a case, as the judge reads a played one. */
export function versions(c: ConstructedCase): { clean: Transcript; faulty: Transcript } {
  const statement = dataset.exercises.find((e) => e.id === c.exerciseId)?.statement ?? '';
  const transcript = (faulty: boolean): Transcript => ({
    scenarioId: c.scenarioId,
    exerciseId: c.exerciseId,
    repetition: faulty ? 2 : 1,
    turns: c.turns.map(({ student, tutor }, index) => ({
      student: student.replaceAll(STATEMENT_PLACEHOLDER, () => statement),
      text: faulty && index === c.faultyTurn - 1 ? c.faultyTutor : tutor,
      tools: [],
      toolOutputs: '',
      cards: '',
      durationMs: 0,
    })),
  });
  return { clean: transcript(false), faulty: transcript(true) };
}

export interface CaseOutcome {
  id: string;
  fault: string;
  expected: { clean: number; faulty: number };
  /** The judge's grade of the criterion, null when the judgement failed. */
  got: { clean: number | null; faulty: number | null };
}

export interface Detection {
  fault: string;
  cases: number;
  /** Faulty versions graded with the faulty value. */
  detected: number;
  /** Clean versions graded with the clean value. */
  cleanKept: number;
  missed: string[];
  falseAlarms: string[];
}

/** Per fault, how many faulty versions the judge caught and how many clean ones it left alone. */
export function detection(outcomes: readonly CaseOutcome[]): Detection[] {
  const byFault = new Map<string, Detection>();
  for (const { id, fault, expected, got } of outcomes) {
    const entry = byFault.get(fault) ?? { fault, cases: 0, detected: 0, cleanKept: 0, missed: [], falseAlarms: [] };
    entry.cases += 1;
    if (got.faulty === expected.faulty) entry.detected += 1;
    else entry.missed.push(id);
    if (got.clean === expected.clean) entry.cleanKept += 1;
    else entry.falseAlarms.push(id);
    byFault.set(fault, entry);
  }
  return [...byFault.values()];
}
