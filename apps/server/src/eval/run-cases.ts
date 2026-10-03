/**
 * `bun run eval:cases`: asks the judge question each constructed case aims at, on its clean
 * and its faulty version, and reports per fault the faulty versions flagged and the clean
 * ones left alone. Where the code answers the question (`eval/verifiers.ts`), the case is
 * measured both ways, to compare the model with the code. Low detection is a finding, not a
 * failure; a failed judgement is.
 */
import { mkdir } from 'node:fs/promises';
import { checksFor } from './checks.js';
import { constructedCases, detection, faultFlagged, versions, type CaseOutcome, type Detection } from './constructed-cases.js';
import { judgeContext } from './evaluation-run.js';
import { extract } from './extract.js';
import { JUDGE, answerChecks, type Generate } from './judge.js';
import { sections, type JudgeInput } from './judge-context.js';
import { throttled } from './judge-rate.js';
import { isCodeCheck, verify } from './verifiers.js';

/** Whether the code flags the case's fault, or undefined when the code does not cover it. */
async function codeFlags(input: JudgeInput, check: { id: string; pass: 'oui' | 'non' }, generate: Generate): Promise<boolean | undefined> {
  if (!isCodeCheck(check.id) && check.id !== 'accuracy') return undefined;
  const { extraction } = await extract(input, generate);
  const { verdicts, wrongCalculations } = verify(extraction, input.transcript);
  if (check.id === 'accuracy') return wrongCalculations.length > 0;
  const verdict = isCodeCheck(check.id) ? verdicts.get(check.id) : undefined;
  return verdict ? verdict.yes !== (check.pass === 'oui') : undefined;
}

function printTable(title: string, lines: readonly Detection[]): void {
  console.log(`\n${title}\n\n| Fault | Faulty flagged | Clean left alone | Missed | False alarms | Failed |\n|---|---|---|---|---|---|`);
  for (const l of lines) {
    console.log(`| ${l.fault} | ${String(l.detected)}/${String(l.faultyJudged)} | ${String(l.cleanKept)}/${String(l.cleanJudged)} | ${l.missed.join(', ') || '—'} | ${l.falseAlarms.join(', ') || '—'} | ${l.failed.join(', ') || '—'} |`);
  }
}

async function main(): Promise<number> {
  const { generateStructured } = await import('../platform/ai/mistral-client.js');
  const generate = throttled(generateStructured);
  const failures: string[] = [];
  const byModel: CaseOutcome[] = [];
  const byCode: CaseOutcome[] = [];
  for (const c of constructedCases) {
    const context = judgeContext({ scenarioId: c.scenarioId, exerciseId: c.exerciseId, repetition: 1 });
    const check = checksFor(sections(context), context.scenario).find((q) => q.id === c.check);
    if (!check) throw new Error(`case ${c.id}: question ${c.check} is not asked here`);
    const { clean, faulty } = versions(c);
    const attempt = async <T>(label: string, run: () => Promise<T>): Promise<T | null> => {
      try {
        return await run();
      } catch (error) {
        failures.push(`${c.id} (${label}): ${error instanceof Error ? error.message : String(error)}`);
        return null;
      }
    };
    const model = (transcript: typeof clean, label: string) => attempt(`model, ${label}`, async () => {
      const { results: [result] } = await answerChecks({ ...context, transcript }, [check], generate);
      return result ? faultFlagged(result) : null;
    });
    const code = (transcript: typeof clean, label: string) => attempt(`code, ${label}`, () => codeFlags({ ...context, transcript }, check, generate));
    const [modelClean, modelFaulty, codeClean, codeFaulty] = await Promise.all([
      model(clean, 'clean'), model(faulty, 'faulty'), code(clean, 'clean'), code(faulty, 'faulty'),
    ]);
    byModel.push({ id: c.id, fault: c.fault, flagged: { clean: modelClean, faulty: modelFaulty } });
    if (codeClean !== undefined && codeFaulty !== undefined) {
      byCode.push({ id: c.id, fault: c.fault, flagged: { clean: codeClean, faulty: codeFaulty } });
    }
    console.log(`${c.id} (${c.check}): model ${String(modelClean)}/${String(modelFaulty)}, code ${String(codeClean)}/${String(codeFaulty)} (clean/faulty flagged)`);
  }

  const modelLines = detection(byModel);
  const codeLines = detection(byCode);
  printTable('Judge question, answered by the model', modelLines);
  printTable('Same question, answered by the code from the extraction', codeLines);
  await mkdir('eval-results', { recursive: true });
  const out = `eval-results/constructed-cases-${new Date().toISOString().slice(0, 16).replace(':', 'h')}.json`;
  await Bun.write(out, JSON.stringify({ judge: JUDGE, model: { lines: modelLines, outcomes: byModel }, code: { lines: codeLines, outcomes: byCode }, failures }, null, 2));
  console.log(`\n${out}`);
  if (failures.length > 0) {
    console.error(`${String(failures.length)} judgement(s) failed:\n${failures.join('\n')}`);
    return 1;
  }
  return 0;
}

process.exit(await main());
