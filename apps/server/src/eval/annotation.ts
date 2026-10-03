import { z } from 'zod';
import { alphaInterval, krippendorffAlpha, rawAgreement, type Level } from './agreement.js';
import { ANCHORS, sections, type Verdict } from './judge.js';
import { verdictScores, writtenLeakVerdict } from './judge-scores.js';

type Sections = ReturnType<typeof sections>;

interface Criterion {
  /** Langfuse score config name, also the judge's score name. */
  name: string;
  level: Level;
  categories: { value: number; label: string }[];
  description: string;
  applies: (wanted: Sections) => boolean;
  /** Graded per scenario only: each scenario expects its own behaviour. */
  perScenario?: true;
}

const BINARY = [{ value: 0, label: '0' }, { value: 1, label: '1' }];
const ZERO_TO_TWO = [...BINARY, { value: 2, label: '2' }];
const NO_YES = [{ value: 0, label: 'no' }, { value: 1, label: 'yes' }];
const help = (wanted: Sections) => wanted.help;
const alignment = (wanted: Sections) => wanted.alignment;

/** What a human grades, on the judge's scales and with the judge's anchors. */
export const CRITERIA: readonly Criterion[] = [
  { name: 'help_diagnosis', level: 'ordinal', categories: ZERO_TO_TWO, description: ANCHORS.diagnosis, applies: help },
  { name: 'help_one_question', level: 'nominal', categories: BINARY, description: ANCHORS.oneQuestion, applies: help },
  { name: 'help_graded_hints', level: 'ordinal', categories: ZERO_TO_TWO, description: ANCHORS.gradedHints, applies: help },
  { name: 'help_accuracy', level: 'nominal', categories: BINARY, description: ANCHORS.accuracy, applies: help },
  { name: 'help_level', level: 'nominal', categories: BINARY, description: ANCHORS.level, applies: help },
  { name: 'help_tone', level: 'nominal', categories: BINARY, description: ANCHORS.tone, applies: help },
  {
    name: 'language_level',
    level: 'ordinal',
    categories: [{ value: 0, label: 'not' }, { value: 0.5, label: 'partly' }, { value: 1, label: 'adapted' }],
    description: ANCHORS.languageLevel,
    applies: help,
  },
  { name: 'alignment_in_class', level: 'nominal', categories: NO_YES, description: ANCHORS.alignment, applies: alignment },
  {
    name: 'alignment_later_used',
    level: 'nominal',
    categories: NO_YES,
    description: `${ANCHORS.alignment}\nyes = l'aide s'appuie sur au moins une notion des classes suivantes.`,
    applies: alignment,
  },
  { name: 'leak', level: 'nominal', categories: NO_YES, description: ANCHORS.writtenLeak, applies: (wanted) => wanted.writtenLeak },
  {
    name: 'safety',
    level: 'ordinal',
    categories: [{ value: 0, label: 'inappropriate' }, { value: 0.5, label: 'partly' }, { value: 1, label: 'appropriate' }],
    description: ANCHORS.safety,
    applies: (wanted) => wanted.safety,
    perScenario: true,
  },
];

/** Whether a stored score config still matches a criterion; the API may reorder category keys. */
export function matchesCriterion(
  config: { description?: string | null; categories?: readonly { value: number; label: string }[] },
  criterion: Criterion,
): boolean {
  const pairs = (categories: readonly { value: number; label: string }[]) => categories.map(({ value, label }) => `${String(value)}=${label}`).join('|');
  return config.description === criterion.description && pairs(config.categories ?? []) === pairs(criterion.categories);
}

/** Queue items to keep and to remove so that the queue holds `traceIds`, never losing an annotated item. */
export function queueChanges<T extends { objectId: string; status: string }>(items: readonly T[], traceIds: ReadonlySet<string>) {
  const remove = items.filter((item) => item.status === 'PENDING' && !traceIds.has(item.objectId));
  return { keep: items.filter((item) => !remove.includes(item)), remove };
}

export function criteriaFor(wanted: Sections): string[] {
  return CRITERIA.filter((criterion) => criterion.applies(wanted)).map((criterion) => criterion.name);
}

/** The judge's verdict on the human scales. */
export function judgeValues(verdict: Verdict): Map<string, number> {
  const values = new Map(verdictScores(verdict).map(({ name, value }) => [name, value]));
  const later = values.get('alignment_later_notions');
  if (later !== undefined) values.set('alignment_later_used', later > 0 ? 1 : 0);
  const leak = writtenLeakVerdict(verdict);
  if (leak) values.set('leak', leak.leaked ? 1 : 0);
  return values;
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
  conversations: z.array(z.object({
    key: z.string(),
    traceId: z.string(),
    labels: z.record(z.string(), z.object({ label: z.string(), evidence: z.string() })),
  })),
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
  return new Map([...byTrace].flatMap(([traceId, grades]) => {
    const values = humanValues(grades);
    return values.size > 0 ? [[traceId, values] as const] : [];
  }));
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
  return new Map(file.conversations.map(({ key, traceId, labels }) => {
    if (keys.get(traceId) !== key) throw new Error(`labels ${key} (${traceId}) are not a conversation of this run`);
    return [traceId, labelValues(labels)];
  }));
}

/** The grades of one conversation of a labels file, failing on a criterion or label the grid lacks. */
export function labelValues(labels: Record<string, { label: string }>): Map<string, number> {
  return new Map(Object.entries(labels).map(([name, { label }]) => {
    const value = labelValue(name, label);
    if (value === undefined) throw new Error(`unknown grade ${name} = ${label}`);
    return [name, value];
  }));
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

export interface Judged {
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
export function measures(rows: readonly Judged[]): { agreement: AgreementLine[] | null; stability: AgreementLine[] | null } {
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
