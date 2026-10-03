/**
 * `bun run eval:cases`: judges the clean and the faulty version of every constructed case
 * and reports, per fault, how many faulty versions the judge caught and how many clean ones
 * it left alone. Low detection is a finding, not a failure; a failed judgement is.
 */
import { mkdir } from 'node:fs/promises';
import { constructedCases, detection, versions, type CaseOutcome } from './constructed-cases.js';
import { judgeContext } from './evaluation-run.js';
import { JUDGE, judge } from './judge.js';
import { throttled } from './judge-rate.js';

async function main(): Promise<number> {
  const { generateStructured } = await import('../platform/ai/mistral-client.js');
  const generate = throttled(generateStructured);
  const failures: string[] = [];
  const outcomes: CaseOutcome[] = [];
  for (const c of constructedCases) {
    const context = judgeContext({ scenarioId: c.scenarioId, exerciseId: c.exerciseId, repetition: 1 });
    const { clean, faulty } = versions(c);
    const grade = async (transcript: typeof clean, label: string) => {
      try {
        const { judged } = await judge({ ...context, transcript }, generate);
        return judged.scores[c.criterion] ?? null;
      } catch (error) {
        failures.push(`${c.id} (${label}): ${error instanceof Error ? error.message : String(error)}`);
        return null;
      }
    };
    const [cleanGrade, faultyGrade] = await Promise.all([grade(clean, 'clean'), grade(faulty, 'faulty')]);
    outcomes.push({ id: c.id, fault: c.fault, expected: { clean: c.clean, faulty: c.faulty }, got: { clean: cleanGrade, faulty: faultyGrade } });
    console.log(`${c.id}: clean ${String(cleanGrade)} (expected ${String(c.clean)}), faulty ${String(faultyGrade)} (expected ${String(c.faulty)})`);
  }

  const lines = detection(outcomes);
  console.log('\n| Fault | Cases | Faulty caught | Clean left alone | Missed | False alarms |\n|---|---|---|---|---|---|');
  for (const { fault, cases, detected, cleanKept, missed, falseAlarms } of lines) {
    console.log(`| ${fault} | ${String(cases)} | ${String(detected)} | ${String(cleanKept)} | ${missed.join(', ') || '—'} | ${falseAlarms.join(', ') || '—'} |`);
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
