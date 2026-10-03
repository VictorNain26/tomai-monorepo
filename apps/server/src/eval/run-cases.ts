/**
 * `bun run eval:cases`: answers the judge question each constructed case aims at, on its clean
 * and its faulty version, as the judge does (the code for the questions it covers, the model
 * for the others), and reports per fault the faulty versions flagged and the clean ones left
 * alone. Low detection is a finding, not a failure; a failed judgement is.
 */
import { checksFor } from './criteria.js';
import { constructedCases, detection, faultFlagged, versions, type CaseOutcome } from './constructed-cases.js';
import { answerByCode, answerChecks } from './judge.js';
import { judgeContext, sections } from './judge-context.js';
import { throttled } from './judge-rate.js';
import { errorMessage, judgeIdentity, stamp, writeResult } from './output.js';
import { answeredByCode } from './verifiers.js';

async function main(): Promise<number> {
  const { generateStructured } = await import('../platform/ai/mistral-client.js');
  const generate = throttled(generateStructured);
  const failures: string[] = [];
  const outcomes: CaseOutcome[] = [];
  for (const c of constructedCases) {
    const context = judgeContext({ scenarioId: c.scenarioId, exerciseId: c.exerciseId, repetition: 1 });
    const check = checksFor(sections(context), context.scenario).find((q) => q.id === c.check);
    if (!check) throw new Error(`case ${c.id}: question ${c.check} is not asked here`);
    const answer = answeredByCode(check.id) ? answerByCode : answerChecks;
    const { clean, faulty } = versions(c);
    const flags = async (transcript: typeof clean, label: string) => {
      try {
        const { results: [result] } = await answer({ ...context, transcript }, [check], generate);
        return result ? faultFlagged(result) : null;
      } catch (error) {
        failures.push(`${c.id} (${label}): ${errorMessage(error)}`);
        return null;
      }
    };
    const [cleanFlag, faultyFlag] = await Promise.all([flags(clean, 'clean'), flags(faulty, 'faulty')]);
    outcomes.push({ id: c.id, fault: c.fault, flagged: { clean: cleanFlag, faulty: faultyFlag } });
    console.log(`${c.id} (${c.check}, ${answeredByCode(check.id) ? 'code' : 'model'}): clean flagged ${String(cleanFlag)}, faulty flagged ${String(faultyFlag)}`);
  }

  const lines = detection(outcomes);
  console.log('\n| Fault | Faulty flagged | Clean left alone | Missed | False alarms | Failed |\n|---|---|---|---|---|---|');
  for (const l of lines) {
    console.log(`| ${l.fault} | ${String(l.detected)}/${String(l.faultyJudged)} | ${String(l.cleanKept)}/${String(l.cleanJudged)} | ${l.missed.join(', ') || '—'} | ${l.falseAlarms.join(', ') || '—'} | ${l.failed.join(', ') || '—'} |`);
  }
  console.log(`\n${await writeResult(`constructed-cases-${stamp()}`, { judge: judgeIdentity(), lines, outcomes, failures })}`);
  if (failures.length > 0) {
    console.error(`${String(failures.length)} judgement(s) failed:\n${failures.join('\n')}`);
    return 1;
  }
  return 0;
}

process.exit(await main());
