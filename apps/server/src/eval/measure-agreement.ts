/**
 * `bun run eval:agreement <eval-results/….json>`: judges the conversations a human graded
 * in the annotation queue, then measures judge-human agreement per criterion. The judge
 * runs on the saved transcripts, never on a replay: both grade the same text.
 */
import { LangfuseClient } from '@langfuse/client';
import { agreement, humanValues, judgeValues, type HumanScore } from './annotation.js';
import { resolveEntries } from './evaluation-run.js';
import { lookup } from './items.js';
import { JUDGE, judge } from './judge.js';
import { gradable, loadResults } from './results.js';

const TRACES_PER_REQUEST = 20;
const CONCURRENCY = 2;
const THRESHOLD = 0.8;

async function annotations(traceIds: readonly string[]): Promise<Map<string, HumanScore[]>> {
  const { api } = new LangfuseClient();
  const byTrace = new Map<string, HumanScore[]>();
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
      for (const score of data) {
        if (score.dataType !== 'CATEGORICAL' || score.subject?.kind !== 'trace') continue;
        const scores = byTrace.get(score.subject.id) ?? [];
        scores.push({ name: score.name, label: score.value, timestamp: score.timestamp });
        byTrace.set(score.subject.id, scores);
      }
      cursor = meta.cursor;
    } while (cursor);
  }
  return byTrace;
}

const format = (value: number | null) => (value === null ? 'n/a' : value.toFixed(3));

async function main(path: string | undefined): Promise<number> {
  if (!path) {
    console.error('usage: bun run eval:agreement <eval-results/….json>');
    return 1;
  }
  const results = await loadResults(path);
  const { generateStructured } = await import('../platform/ai/mistral-client.js');
  const rows = gradable(results);
  const human = await annotations(rows.map((row) => row.traceId));
  const annotated = rows.filter((row) => human.has(row.traceId));
  console.log(`${String(annotated.length)}/${String(rows.length)} conversation(s) annotated`);

  const graded = [];
  const failures: string[] = [];
  for (let start = 0; start < annotated.length; start += CONCURRENCY) {
    graded.push(...await Promise.all(annotated.slice(start, start + CONCURRENCY).map(async (row) => {
      const { scenario, exercise } = lookup(row);
      try {
        const { verdict } = await judge({
          exercise,
          scenario,
          transcript: row.transcript,
          entries: resolveEntries(exercise.alignment?.entries ?? []),
          laterEntries: resolveEntries(exercise.alignment?.laterEntries ?? []),
        }, generateStructured);
        return [{ ...row, human: humanValues(human.get(row.traceId) ?? []), judge: judgeValues(verdict), verdict }];
      } catch (error) {
        failures.push(`${row.traceId}: ${error instanceof Error ? error.message : String(error)}`);
        return [];
      }
    })).then((batches) => batches.flat()));
  }

  const lines = agreement(graded);
  console.log(`\n| Criterion | Units | Raw | α | 95 % interval | ≥ ${String(THRESHOLD)} |\n|---|---|---|---|---|---|`);
  for (const { criterion, units, raw, alpha, interval } of lines) {
    const range = interval ? `${format(interval[0])} – ${format(interval[1])}` : 'n/a';
    console.log(`| ${criterion} | ${String(units)} | ${format(raw)} | ${format(alpha)} | ${range} | ${alpha !== null && alpha >= THRESHOLD ? 'yes' : 'no'} |`);
  }
  const out = path.replace(/\.json$/, '.agreement.json');
  await Bun.write(out, JSON.stringify({
    results: path,
    judge: JUDGE,
    threshold: THRESHOLD,
    lines,
    conversations: graded.map(({ scenarioId, exerciseId, repetition, traceId, human: h, judge: j, verdict }) => ({
      scenarioId, exerciseId, repetition, traceId, human: Object.fromEntries(h), judge: Object.fromEntries(j), verdict,
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

process.exit(await main(process.argv[2]));
