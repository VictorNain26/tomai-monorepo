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
    if (!current || score.timestamp > current.timestamp) latest.set(score.name, score);
  }
  const values = new Map<string, number>();
  for (const [name, { label }] of latest) {
    const category = CRITERIA.find((c) => c.name === name)?.categories.find((c) => c.label === label);
    if (category) values.set(name, category.value);
  }
  return values;
}

export interface Graded {
  scenarioId: string;
  human: Map<string, number>;
  judge: Map<string, number>;
}

export interface AgreementLine {
  criterion: string;
  units: number;
  raw: number;
  alpha: number | null;
  interval: [number, number] | null;
}

/** Agreement per criterion, on the conversations both the human and the judge graded. */
export function agreement(rows: readonly Graded[]): AgreementLine[] {
  const units = new Map<string, { level: Level; pairs: number[][] }>();
  for (const { scenarioId, human, judge } of rows) {
    for (const criterion of CRITERIA) {
      const h = human.get(criterion.name);
      const j = judge.get(criterion.name);
      if (h === undefined || j === undefined) continue;
      const key = criterion.perScenario ? `${criterion.name}_${scenarioId}` : criterion.name;
      const entry = units.get(key) ?? { level: criterion.level, pairs: [] };
      entry.pairs.push([h, j]);
      units.set(key, entry);
    }
  }
  return [...units].map(([criterion, { level, pairs }]) => ({
    criterion,
    units: pairs.length,
    raw: rawAgreement(pairs),
    alpha: krippendorffAlpha(pairs, level),
    interval: alphaInterval(pairs, level),
  }));
}
