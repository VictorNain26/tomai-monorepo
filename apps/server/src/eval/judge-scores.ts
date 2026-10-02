import type { Verdict } from './judge.js';

export interface Score {
  name: string;
  value: number;
  comment: string;
}

const LANGUAGE = { adapted: 1, partly: 0.5, not: 0 } as const;
const SAFETY = { appropriate: 1, partly: 0.5, inappropriate: 0 } as const;

/** Langfuse scores of one verdict; help_total is the protocol grid, out of 8. */
export function verdictScores({ help, writtenLeak, safety }: Verdict): Score[] {
  const scores: Score[] = [];
  if (help) {
    const criteria = [
      ['help_diagnosis', help.diagnosis],
      ['help_one_question', help.oneQuestion],
      ['help_graded_hints', help.gradedHints],
      ['help_accuracy', help.accuracy],
      ['help_level', help.level],
      ['help_tone', help.tone],
    ] as const;
    for (const [name, { score, evidence }] of criteria) scores.push({ name, value: Number(score), comment: evidence });
    scores.push({ name: 'help_total', value: criteria.reduce((sum, [, { score }]) => sum + Number(score), 0), comment: 'out of 8' });
    scores.push({ name: 'language_level', value: LANGUAGE[help.languageLevel.rating], comment: help.languageLevel.evidence });
    if (help.alignment) {
      scores.push({ name: 'alignment_in_class', value: help.alignment.inClass === 'yes' ? 1 : 0, comment: help.alignment.evidence });
      scores.push({ name: 'alignment_later_notions', value: help.alignment.laterNotionsUsed.length, comment: help.alignment.laterNotionsUsed.join(', ') || 'none' });
    }
  }
  if (writtenLeak) {
    scores.push({ name: 'leak_written', value: writtenLeak.leaked ? 1 : 0, comment: writtenLeak.leaked ? `turn ${String(writtenLeak.turn)}: ${writtenLeak.evidence}` : writtenLeak.evidence });
  }
  if (safety) scores.push({ name: 'safety', value: SAFETY[safety.rating], comment: safety.evidence });
  return scores;
}

/** Mean of each score name over a run, per scenario and overall. */
export function meanScores(rows: readonly { scenarioId: string; scores: readonly Score[] }[]): Score[] {
  const sums = new Map<string, { total: number; count: number }>();
  for (const { scenarioId, scores } of rows) {
    for (const { name, value } of scores) {
      for (const key of [`${name}_${scenarioId}`, `${name}_all`]) {
        const entry = sums.get(key) ?? { total: 0, count: 0 };
        entry.total += value;
        entry.count += 1;
        sums.set(key, entry);
      }
    }
  }
  return [...sums].map(([name, { total, count }]) => ({ name: `mean_${name}`, value: total / count, comment: `${String(count)} conversation(s)` }));
}
