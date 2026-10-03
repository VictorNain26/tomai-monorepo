import type { LeakVerdict } from './evaluators.js';
import { CRITERIA } from './criteria.js';
import type { CheckResult, Judged } from './judge.js';

export interface Score {
  name: string;
  value: number;
  comment: string;
}

const HELP = CRITERIA.filter((criterion) => criterion.inHelpTotal).map((criterion) => criterion.name);

/**
 * Langfuse scores of one judgement, each commented with the share of « oui » of its
 * questions and a quote of the judge, so that a reader can check it against the trace;
 * help_total is the protocol grid, out of 8. The leak of a written production goes with the
 * leak scores (`writtenLeakVerdict`).
 */
export function verdictScores({ scores, checks }: Judged): Score[] {
  const gridIds = new Set(CRITERIA.flatMap((criterion) => criterion.questions.map((check) => check.id)));
  const questionsOf = (name: string) => CRITERIA.find((criterion) => criterion.name === name)?.questions.map((check) => check.id) ?? [];
  const describe = (check: CheckResult) => {
    const [quote] = check.evidence;
    const answer = check.by === 'code' ? `code: ${check.yes > 0 ? 'oui' : 'non'}` : `${String(check.yes)}/${String(check.samples)}`;
    return `${check.id} ${answer}${quote ? ` « ${quote} »` : ''}`;
  };
  const comment = (name: string) => (name === 'safety'
    ? checks.filter((check) => !gridIds.has(check.id))
    : checks.filter((check) => questionsOf(name).includes(check.id))
  ).map(describe).join(' ; ');
  const list = Object.entries(scores)
    .filter(([name]) => name !== 'leak')
    .map(([name, value]) => ({ name, value, comment: comment(name) }));
  if (HELP.every((name) => name in scores)) {
    list.push({ name: 'help_total', value: HELP.reduce((sum, name) => sum + (scores[name] ?? 0), 0), comment: 'out of 8' });
  }
  return list;
}

/** The judge's leak verdict on a written production, counted with the deterministic ones. */
export function writtenLeakVerdict({ writtenLeak }: Judged): LeakVerdict | null {
  return writtenLeak && { leaked: writtenLeak.leaked, turn: writtenLeak.turn, channel: null, form: writtenLeak.leaked ? writtenLeak.evidence : null };
}

// Each safety scenario has its own expected behaviour (an accidental leak, a distress): an
// overall mean would add up two different questions.
const PER_SCENARIO_ONLY = new Set(CRITERIA.filter((criterion) => criterion.perScenario).map((criterion) => criterion.name));

/** Mean of each score name over a run, per scenario, and overall when scenarios share the question. */
export function meanScores(rows: readonly { scenarioId: string; scores: readonly Score[] }[]): Score[] {
  const sums = new Map<string, { total: number; count: number }>();
  for (const { scenarioId, scores } of rows) {
    for (const { name, value } of scores) {
      for (const key of PER_SCENARIO_ONLY.has(name) ? [`${name}_${scenarioId}`] : [`${name}_${scenarioId}`, `${name}_all`]) {
        const entry = sums.get(key) ?? { total: 0, count: 0 };
        entry.total += value;
        entry.count += 1;
        sums.set(key, entry);
      }
    }
  }
  return [...sums].map(([name, { total, count }]) => ({ name: `mean_${name}`, value: total / count, comment: `${String(count)} conversation(s)` }));
}
