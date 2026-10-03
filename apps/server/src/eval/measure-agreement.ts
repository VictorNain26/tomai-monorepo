/**
 * `bun run eval:agreement <results.json> [--labels <file>] [--passes <n>]`: judges the
 * conversations graded in the annotation queue, or in a labels file, then measures agreement
 * with the judge per criterion; with several passes, also the judge against itself. The
 * judge runs on the saved transcripts, never on a replay: both grade the same text.
 */
import { parseArgs } from 'node:util';
import { LangfuseClient } from '@langfuse/client';
import { mkdir } from 'node:fs/promises';
import { basename } from 'node:path';
import { z } from 'zod';
import { fileValues, judgeValues, labelsFile, measures, queueValues, toJudge, type AgreementLine } from './annotation.js';
import { judgeContext } from './evaluation-run.js';
import { JUDGE, judge } from './judge.js';
import { gradable, loadResults } from './results.js';

const TRACES_PER_REQUEST = 20;
const CONCURRENCY = 2;
const THRESHOLD = 0.8;

async function queueGrades(traceIds: readonly string[]): Promise<Map<string, Map<string, number>>> {
  const { api } = new LangfuseClient();
  const scores = [];
  for (let start = 0; start < traceIds.length; start += TRACES_PER_REQUEST) {
    let cursor: string | undefined;
    do {
      const { data, meta } = await api.scoresV3.getManyV3({
        traceId: traceIds.slice(start, start + TRACES_PER_REQUEST).join(','),
        source: 'ANNOTATION',
        dataType: 'CATEGORICAL',
        fields: 'subject',
        limit: 100,
        ...(cursor ? { cursor } : {}),
      });
      scores.push(...data);
      cursor = meta.cursor;
    } while (cursor);
  }
  return queueValues(scores);
}

const format = (value: number | null) => (value === null ? 'n/a' : value.toFixed(3));

function printTable(title: string, lines: readonly AgreementLine[]): void {
  console.log(`\n${title}\n\n| Criterion | Units | Raw | α | 95 % interval | ≥ ${String(THRESHOLD)} |\n|---|---|---|---|---|---|`);
  for (const { criterion, units, raw, alpha, interval } of lines) {
    const range = interval ? `${format(interval[0])} – ${format(interval[1])}` : 'n/a';
    console.log(`| ${criterion} | ${String(units)} | ${format(raw)} | ${format(alpha)} | ${range} | ${alpha !== null && alpha >= THRESHOLD ? 'yes' : 'no'} |`);
  }
}

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { labels: { type: 'string' }, passes: { type: 'string', default: '1' } },
  });
  const [path] = positionals;
  if (!path) {
    console.error('usage: bun run eval:agreement <results.json> [--labels <file>] [--passes <n>]');
    return 1;
  }
  const passes = z.coerce.number().int().min(1).max(5).safeParse(values.passes);
  if (!passes.success) {
    console.error('--passes takes a whole number from 1 to 5.');
    return 1;
  }
  const results = await loadResults(path);
  const { generateStructured } = await import('../platform/ai/mistral-client.js');
  const rows = gradable(results);
  const labels = values.labels ? labelsFile.parse(await Bun.file(values.labels).json()) : null;
  const annotator = labels ? labels.annotator : 'human (Langfuse annotation queue)';
  const human = labels ? fileValues(labels, rows) : await queueGrades(rows.map((row) => row.traceId));
  console.log(`annotator: ${annotator}, ${String(human.size)}/${String(rows.length)} conversation(s) annotated`);
  const selected = toJudge(rows, new Set(human.keys()), passes.data);
  if (selected.length === 0) {
    console.error('nothing to measure: no conversation of this run is annotated, and a single pass.');
    return 1;
  }

  const judged = [];
  const failures: string[] = [];
  for (let start = 0; start < selected.length; start += CONCURRENCY) {
    judged.push(...await Promise.all(selected.slice(start, start + CONCURRENCY).map(async (row) => {
      const verdicts = [];
      for (let pass = 1; pass <= passes.data; pass++) {
        try {
          verdicts.push((await judge({ ...judgeContext(row), transcript: row.transcript }, generateStructured)).verdict);
        } catch (error) {
          failures.push(`${row.traceId}, pass ${String(pass)}: ${error instanceof Error ? error.message : String(error)}`);
          verdicts.push(null);
        }
      }
      return { ...row, human: human.get(row.traceId) ?? null, passes: verdicts.map((v) => (v ? judgeValues(v) : null)), verdicts };
    })));
  }

  const { agreement: agreementLines, stability: stabilityLines } = measures(judged);
  if (agreementLines) printTable(`Agreement with ${annotator} (judge pass 1)`, agreementLines);
  if (stabilityLines) printTable(`Judge reproducibility over ${String(passes.data)} passes`, stabilityLines);

  // A new file in eval-results/ on every run: a committed measure is a dated snapshot.
  await mkdir('eval-results', { recursive: true });
  const out = `eval-results/${basename(path, '.json')}.agreement-${new Date().toISOString().slice(0, 16).replace(':', 'h')}.json`;
  await Bun.write(out, JSON.stringify({
    results: path,
    annotator: human.size > 0 ? annotator : null,
    judge: JUDGE,
    passes: passes.data,
    threshold: THRESHOLD,
    agreement: agreementLines,
    stability: stabilityLines,
    conversations: judged.map(({ scenarioId, exerciseId, repetition, traceId, human: h, passes: grades, verdicts }) => ({
      scenarioId, exerciseId, repetition, traceId,
      human: h ? Object.fromEntries(h) : null,
      judge: grades.map((g) => (g ? Object.fromEntries(g) : null)),
      verdicts,
    })),
    failures,
  }, null, 2));
  console.log(`\n${out}`);
  if (failures.length > 0) {
    console.error(`${String(failures.length)} judgement(s) failed:\n${failures.join('\n')}`);
    return 1;
  }
  return 0;
}

process.exit(await main());
