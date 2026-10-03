/**
 * `bun run eval:cases`: asks the judge question each constructed case aims at, on its clean
 * and its faulty version, and reports per fault the faulty versions flagged and the clean
 * ones left alone. Low detection is a finding, not a failure; a failed judgement is.
 */
import { mkdir } from 'node:fs/promises';
import { checksFor } from './checks.js';
import { constructedCases, detection, faultFlagged, versions, type CaseOutcome } from './constructed-cases.js';
import { judgeContext } from './evaluation-run.js';
import { JUDGE, answerChecks } from './judge.js';
import { sections } from './judge-context.js';
import { throttled } from './judge-rate.js';

async function main(): Promise<number> {
  const { generateStructured } = await import('../platform/ai/mistral-client.js');
  const generate = throttled(generateStructured);
  const failures: string[] = [];
  const outcomes: CaseOutcome[] = [];
  for (const c of constructedCases) {
    const context = judgeContext({ scenarioId: c.scenarioId, exerciseId: c.exerciseId, repetition: 1 });
    const check = checksFor(sections(context), context.scenario).find((q) => q.id === c.check);
    if (!check) throw new Error(`case ${c.id}: question ${c.check} is not asked here`);
    const { clean, faulty } = versions(c);
    const flags = async (transcript: typeof clean, label: string) => {
      try {
        const { results: [result] } = await answerChecks({ ...context, transcript }, [check], generate);
        return result ? faultFlagged(result) : null;
      } catch (error) {
        failures.push(`${c.id} (${label}): ${error instanceof Error ? error.message : String(error)}`);
        return null;
      }
    };
    const [cleanFlag, faultyFlag] = await Promise.all([flags(clean, 'clean'), flags(faulty, 'faulty')]);
    outcomes.push({ id: c.id, fault: c.fault, flagged: { clean: cleanFlag, faulty: faultyFlag } });
    console.log(`${c.id} (${c.check}): clean flagged ${String(cleanFlag)}, faulty flagged ${String(faultyFlag)}`);
  }

  const lines = detection(outcomes);
  console.log('\n| Fault | Faulty flagged | Clean left alone | Missed | False alarms | Failed |\n|---|---|---|---|---|---|');
  for (const l of lines) {
    console.log(`| ${l.fault} | ${String(l.detected)}/${String(l.faultyJudged)} | ${String(l.cleanKept)}/${String(l.cleanJudged)} | ${l.missed.join(', ') || '—'} | ${l.falseAlarms.join(', ') || '—'} | ${l.failed.join(', ') || '—'} |`);
  }
  await mkdir('eval-results', { recursive: true });
  const out = `eval-results/constructed-cases-${new Date().toISOString().slice(0, 16).replace(':', 'h')}.json`;
  await Bun.write(out, JSON.stringify({ judge: JUDGE, lines, outcomes, failures }, null, 2));
  console.log(`\n${out}`);
  if (failures.length > 0) {
    console.error(`${String(failures.length)} judgement(s) failed:\n${failures.join('\n')}`);
    return 1;
  }
  return 0;
}

process.exit(await main());
