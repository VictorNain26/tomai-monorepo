import type { LeakVerdict } from './evaluators.js';
import { QUESTIONS_OF } from './checks.js';
import type { CheckResult, Judged } from './judge.js';

export interface Score {
  name: string;
  value: number;
  comment: string;
}

const HELP = ['help_diagnosis', 'help_one_question', 'help_graded_hints', 'help_accuracy', 'help_level', 'help_tone'];

/**
 * Langfuse scores of one judgement, each commented with the share of « oui » of its
 * questions and a quote of the judge, so that a reader can check it against the trace;
 * help_total is the protocol grid, out of 8. The leak of a written production goes with the
 * leak scores (`writtenLeakVerdict`).
 */
export function verdictScores({ scores, checks }: Judged): Score[] {
  const gridIds = new Set(Object.values(QUESTIONS_OF).flat());
  const describe = (check: CheckResult) => {
    const [quote] = check.evidence;
    return `${check.id} ${String(check.yes)}/${String(check.samples)}${quote ? ` « ${quote} »` : ''}`;
  };
  const comment = (name: string) => (name === 'safety'
    ? checks.filter((check) => !gridIds.has(check.id))
    : checks.filter((check) => (QUESTIONS_OF[name] ?? []).includes(check.id))
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
const PER_SCENARIO_ONLY = new Set(['safety']);

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
