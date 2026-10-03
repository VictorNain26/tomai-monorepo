/**
 * `bun run eval:annotate <eval-results/….json>`: puts the conversations of a run played
 * without the judge in the Langfuse annotation queue, with one score config per criterion,
 * on the judge's scales and anchors. Without the judge, no judge score is there to see.
 */
import { LangfuseClient } from '@langfuse/client';
import { matchesCriterion, queueChanges } from './annotation.js';
import { CRITERIA, describeCriterion } from './criteria.js';
import { gradable, loadResults } from './results.js';

const QUEUE = 'tom-judge-agreement';
// Hobby plan: 30 requests per minute on the public API (https://langfuse.com/pricing).
const PACE_MS = 2100;
const pause = () => new Promise((resolve) => setTimeout(resolve, PACE_MS));

async function main(path: string | undefined): Promise<number> {
  if (!path) {
    console.error('usage: bun run eval:annotate <eval-results/….json>');
    return 1;
  }
  const results = await loadResults(path);
  if (results.judge !== null) {
    console.error('annotate a run played with --skip-judge: the annotator must not see the judge.');
    return 1;
  }
  const { api } = new LangfuseClient();

  const existing = (await api.scoreConfigs.get({ limit: 100 })).data.filter((c) => !c.isArchived);
  const configIds: string[] = [];
  for (const criterion of CRITERIA) {
    const found = existing.find((c) => c.name === criterion.name);
    if (found) {
      if (!matchesCriterion(found, criterion)) {
        console.error(`score config ${criterion.name} differs from the judge's anchors: archive it in Langfuse, then run again.`);
        return 1;
      }
      configIds.push(found.id);
      continue;
    }
    await pause();
    const created = await api.scoreConfigs.create({
      name: criterion.name,
      dataType: 'CATEGORICAL',
      categories: criterion.categories,
      description: describeCriterion(criterion),
    });
    configIds.push(created.id);
    console.log(`score config ${criterion.name} created`);
  }

  const queues = (await api.annotationQueues.listQueues({ limit: 100 })).data;
  const queue = queues.find((q) => q.name === QUEUE)
    ?? await api.annotationQueues.createQueue({
      name: QUEUE,
      description: 'Conversations of the eval sample, graded blind to the judge (docs/agent.md, § 9).',
      scoreConfigIds: configIds,
    });
  if ([...queue.scoreConfigIds].sort().join() !== [...configIds].sort().join()) {
    console.error(`queue ${QUEUE} does not hold the current score configs: delete it in Langfuse, then run again.`);
    return 1;
  }

  const items = [];
  for (let page = 1; ; page++) {
    const { data, meta } = await api.annotationQueues.listQueueItems(queue.id, { page, limit: 100 });
    items.push(...data);
    if (page >= meta.totalPages) break;
  }
  const rows = gradable(results);
  const skipped = results.report.length - rows.length;
  // The queue holds one run: pending items of another run leave it, annotated ones stay.
  const { keep, remove } = queueChanges(items, new Set(rows.map((row) => row.traceId)));
  for (const item of remove) {
    await pause();
    await api.annotationQueues.deleteQueueItem(queue.id, item.id);
  }
  const queued = new Set(keep.map((item) => item.objectId));
  let added = 0;
  for (const { traceId } of rows) {
    if (queued.has(traceId)) continue;
    await pause();
    await api.annotationQueues.createQueueItem(queue.id, { objectId: traceId, objectType: 'TRACE' });
    added += 1;
  }
  console.log(`queue ${QUEUE}: ${String(added)} conversation(s) added, ${String(queued.size)} kept, ${String(remove.length)} pending of another run removed, ${String(skipped)} skipped (error or no trace)`);
  return 0;
}

process.exit(await main(process.argv[2]));
