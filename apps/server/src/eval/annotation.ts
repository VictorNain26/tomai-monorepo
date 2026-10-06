import { z } from 'zod';
import { alphaInterval, krippendorffAlpha, rawAgreement, type Level } from './agreement.js';
import { CRITERIA, describeCriterion, type Criterion } from './criteria.js';
import type { Judged } from './judge.js';

/** Whether a stored score config still matches a criterion; the API may reorder category keys. */
export function matchesCriterion(
  config: { description?: string | null; categories?: readonly { value: number; label: string }[] },
  criterion: Criterion,
): boolean {
  const pairs = (categories: readonly { value: number; label: string }[]) =>
    categories.map(({ value, label }) => `${String(value)}=${label}`).join('|');
  return config.description === describeCriterion(criterion) && pairs(config.categories ?? []) === pairs(criterion.categories);
}

/** Queue items to keep and to remove so that the queue holds `traceIds`, never losing an annotated item. */
export function queueChanges<T extends { objectId: string; status: string }>(items: readonly T[], traceIds: ReadonlySet<string>) {
  const remove = items.filter((item) => item.status === 'PENDING' && !traceIds.has(item.objectId));
  return { keep: items.filter((item) => !remove.includes(item)), remove };
}

/** The judge's verdict on the human scales. */
export function judgeValues({ scores }: Judged): Map<string, number> {
  return new Map(Object.entries(scores));
}

export interface HumanScore {
  name: string;
  /** The category label, as the scores API returns a categorical score. */
  label: string;
  timestamp: string;
}

/** The latest human grade of each criterion, back on its numeric value. */
export function humanValues(scores: readonly HumanScore[]): Map<string, number> {
  const latest = new Map<string, HumanScore>();
  for (const score of scores) {
    const current = latest.get(score.name);
    if (!current || Date.parse(score.timestamp) > Date.parse(current.timestamp)) latest.set(score.name, score);
  }
  const values = new Map<string, number>();
  for (const [name, { label }] of latest) {
    const value = labelValue(name, label);
    if (value !== undefined) values.set(name, value);
  }
  return values;
}

function labelValue(name: string, label: string): number | undefined {
  return CRITERIA.find((c) => c.name === name)?.categories.find((c) => c.label === label)?.value;
}

/** Grades kept in a file rather than in Langfuse: each one with the quote it rests on. */
export const labelsFile = z.object({
  annotator: z.string().min(1),
  date: z.string(),
  results: z.string(),
  /** Per criterion, the rule it was graded under (`describeCriterion` at the time). */
  rules: z.record(z.string(), z.string()),
  conversations: z.array(
    z.object({
      key: z.string(),
      traceId: z.string(),
      labels: z.record(z.string(), z.object({ label: z.string(), evidence: z.string() })),
    }),
  ),
});

/** Scores of the annotation queue, as the v3 scores API returns them. */
interface QueueScore {
  name: string;
  dataType: string;
  value: unknown;
  timestamp: string;
  subject?: { kind: string; id: string };
}

/** Human grades per trace from queue scores: categorical scores on a trace only. */
export function queueValues(scores: readonly QueueScore[]): Map<string, Map<string, number>> {
  const byTrace = new Map<string, HumanScore[]>();
  for (const { name, dataType, value, timestamp, subject } of scores) {
    if (dataType !== 'CATEGORICAL' || subject?.kind !== 'trace' || typeof value !== 'string') continue;
    byTrace.set(subject.id, [...(byTrace.get(subject.id) ?? []), { name, label: value, timestamp }]);
  }
  return new Map(
    [...byTrace].flatMap(([traceId, grades]) => {
      const values = humanValues(grades);
      return values.size > 0 ? [[traceId, values] as const] : [];
    }),
  );
}

/**
 * Grades of a labels file per trace, checked against the run it annotates: every
 * conversation must be one of the run's, under the same key.
 */
export function fileValues(
  file: z.infer<typeof labelsFile>,
  rows: readonly { traceId: string; scenarioId: string; exerciseId: string; repetition: number }[],
): Map<string, Map<string, number>> {
  const keys = new Map(rows.map((row) => [row.traceId, `${row.scenarioId}:${row.exerciseId}:${String(row.repetition)}`]));
  const stale = new Set(staleCriteria(file));
  return new Map(
    file.conversations.map(({ key, traceId, labels }) => {
      if (keys.get(traceId) !== key) throw new Error(`labels ${key} (${traceId}) are not a conversation of this run`);
      return [traceId, labelValues(Object.fromEntries(Object.entries(labels).filter(([name]) => !stale.has(name))))];
    }),
  );
}

/**
 * Criteria of a labels file graded under another rule than the judge's, or gone from the grid:
 * their grades are not compared.
 */
export function staleCriteria(file: Pick<z.infer<typeof labelsFile>, 'rules' | 'conversations'>): string[] {
  const graded = new Set(file.conversations.flatMap(({ labels }) => Object.keys(labels)));
  return [...graded].filter((name) => {
    const criterion = CRITERIA.find((c) => c.name === name);
    return !criterion || file.rules[name] !== describeCriterion(criterion);
  });
}

/** The ids of the stored score configs that still match a criterion: grades under any other are stale. */
export function currentConfigIds(
  configs: readonly {
    id: string;
    name: string;
    isArchived: boolean;
    description?: string | null;
    categories?: readonly { value: number; label: string }[];
  }[],
): string[] {
  return configs
    .filter((config) => {
      const criterion = CRITERIA.find((c) => c.name === config.name);
      return !config.isArchived && criterion !== undefined && matchesCriterion(config, criterion);
    })
    .map((config) => config.id);
}

/** The grades of one conversation of a labels file, failing on a criterion or label the grid lacks. */
export function labelValues(labels: Record<string, { label: string }>): Map<string, number> {
  return new Map(
    Object.entries(labels).map(([name, { label }]) => {
      const value = labelValue(name, label);
      if (value === undefined) throw new Error(`unknown grade ${name} = ${label}`);
      return [name, value];
    }),
  );
}

export interface Graded {
  scenarioId: string;
  /** The grades of each coder: a human and the judge, or several passes of the judge. */
  coders: readonly Map<string, number>[];
}

export interface AgreementLine {
  criterion: string;
  units: number;
  raw: number;
  alpha: number | null;
  interval: [number, number] | null;
}

/**
 * Agreement per criterion. A coder may lack a grade (a failed judgement): the unit counts
 * once two coders graded it, as Krippendorff's alpha allows missing values.
 */
export function agreement(rows: readonly Graded[]): AgreementLine[] {
  const units = new Map<string, { level: Level; values: number[][] }>();
  for (const { scenarioId, coders } of rows) {
    for (const criterion of CRITERIA) {
      const values = coders.flatMap((grades) => {
        const value = grades.get(criterion.name);
        return value === undefined ? [] : [value];
      });
      if (values.length < 2) continue;
      const key = criterion.perScenario ? `${criterion.name}_${scenarioId}` : criterion.name;
      const entry = units.get(key) ?? { level: criterion.level, values: [] };
      entry.values.push(values);
      units.set(key, entry);
    }
  }
  return [...units].map(([criterion, { level, values }]) => ({
    criterion,
    units: values.length,
    raw: rawAgreement(values),
    alpha: krippendorffAlpha(values, level),
    interval: alphaInterval(values, level),
  }));
}

export interface MeasuredRow {
  scenarioId: string;
  /** Human grades, null when the conversation is not annotated. */
  human: Map<string, number> | null;
  /** The judge's grades per pass, null for a failed pass. */
  passes: readonly (Map<string, number> | null)[];
}

/**
 * Agreement with the annotation, on the judge's first pass, and the judge's reproducibility
 * over its passes, on every conversation judged: a failed pass is a missing value, never a
 * dropped conversation, which would hide the judge's unsteady cases.
 */
export function measures(rows: readonly MeasuredRow[]): { agreement: AgreementLine[] | null; stability: AgreementLine[] | null } {
  const annotated = rows.flatMap(({ scenarioId, human, passes: [first] }) => (human && first ? [{ scenarioId, coders: [human, first] }] : []));
  const repeated = rows.some(({ passes }) => passes.length > 1);
  return {
    agreement: annotated.length > 0 ? agreement(annotated) : null,
    stability: repeated
      ? agreement(rows.map(({ scenarioId, passes }) => ({ scenarioId, coders: passes.flatMap((grades) => (grades ? [grades] : [])) })))
      : null,
  };
}

/** With several passes every conversation is judged, to measure the judge on the whole run. */
export function toJudge<T extends { traceId: string }>(rows: readonly T[], annotated: ReadonlySet<string>, passes: number): T[] {
  return passes > 1 ? [...rows] : rows.filter((row) => annotated.has(row.traceId));
}
