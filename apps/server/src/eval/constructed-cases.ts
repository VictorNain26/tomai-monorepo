import { z } from 'zod';
import rawCases from './constructed-cases.json' with { type: 'json' };
import { checksFor } from './criteria.js';
import { saysYes, type CheckResult } from './judge.js';
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
  /** The judge question that must flag the fault (`eval/criteria.ts`, or a scenario safety question). */
  check: text,
  turns: z.array(z.strictObject({ student: text, tutor: text })).min(1),
  /** 1-based turn whose tutor message carries the fault. */
  faultyTurn: z.number().int().min(1),
  faultyTutor: text,
});
export type ConstructedCase = z.infer<typeof caseSchema>;

/**
 * Cases whose right answer is known by construction: a clean conversation, and the same one
 * where a single tutor message carries one fault, aimed at one judge question.
 */
export const casesSchema = z.array(caseSchema).superRefine((cases, ctx) => {
  const ids = new Set<string>();
  for (const c of cases) {
    const issue = (message: string) => {
      ctx.addIssue({ code: 'custom', message: `case ${c.id}: ${message}` });
    };
    if (ids.has(c.id)) issue('duplicate id');
    ids.add(c.id);
    if (!c.turns[0]?.student.includes(STATEMENT_PLACEHOLDER)) issue(`the first student turn must contain ${STATEMENT_PLACEHOLDER}`);
    const scenario = dataset.scenarios.find((s) => s.id === c.scenarioId);
    const exercise = scenario && exercisesFor(scenario).find((e) => e.id === c.exerciseId);
    if (!scenario || !exercise) {
      issue(`no exercise ${c.exerciseId} in scenario ${c.scenarioId}`);
      continue;
    }
    if (!checksFor(sections({ exercise, scenario }), scenario).some((check) => check.id === c.check)) issue(`question ${c.check} is not asked here`);
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

/** The fault is flagged when the majority answer is the one that fails the tutor. */
export function faultFlagged(result: Pick<CheckResult, 'yes' | 'samples' | 'pass'>): boolean {
  return saysYes(result) !== (result.pass === 'oui');
}

export interface CaseOutcome {
  id: string;
  fault: string;
  /** Whether the judge flagged the fault in each version; null when the judgement failed. */
  flagged: { clean: boolean | null; faulty: boolean | null };
}

export interface Detection {
  fault: string;
  cases: number;
  /** Faulty versions flagged, over those judged. */
  detected: number;
  faultyJudged: number;
  /** Clean versions not flagged, over those judged. */
  cleanKept: number;
  cleanJudged: number;
  missed: string[];
  falseAlarms: string[];
  /** Versions whose judgement failed, apart from both rates. */
  failed: string[];
}

/** Per fault, the faulty versions the judge flagged and the clean ones it left alone. */
export function detection(outcomes: readonly CaseOutcome[]): Detection[] {
  const byFault = new Map<string, Detection>();
  for (const { id, fault, flagged } of outcomes) {
    const entry = byFault.get(fault) ?? {
      fault, cases: 0, detected: 0, faultyJudged: 0, cleanKept: 0, cleanJudged: 0, missed: [], falseAlarms: [], failed: [],
    };
    entry.cases += 1;
    if (flagged.faulty === null) entry.failed.push(`${id} (faulty)`);
    else {
      entry.faultyJudged += 1;
      if (flagged.faulty) entry.detected += 1;
      else entry.missed.push(id);
    }
    if (flagged.clean === null) entry.failed.push(`${id} (clean)`);
    else {
      entry.cleanJudged += 1;
      if (flagged.clean) entry.falseAlarms.push(id);
      else entry.cleanKept += 1;
    }
    byFault.set(fault, entry);
  }
  return [...byFault.values()];
}
