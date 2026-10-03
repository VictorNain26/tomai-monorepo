import { describe, it, expect } from 'bun:test';
import { dataset } from '../eval';
import { evaluationRun, resolveEntries } from '../eval/evaluation-run';
import type { Generate } from '../eval/judge';
import type { ItemInput } from '../eval/items';
import type { Transcript, TutorTurn } from '../eval/turn-parts';
import { fakeJudge } from './_helpers/fake-judge';

function turn(text: string, error?: string): TutorTurn {
  return { student: 'Aide-moi.', text, tools: [], toolOutputs: '', cards: '', durationMs: 1, ...(error ? { error } : {}) };
}

function transcript({ scenarioId, exerciseId, repetition }: ItemInput, turns: TutorTurn[]): Transcript {
  return { scenarioId, exerciseId, repetition, turns };
}

const answerOf = (id: string) => {
  const answer = dataset.exercises.find((e) => e.id === id)?.answer;
  if (answer?.kind !== 'short') throw new Error(`${id} has no short answer`);
  return answer.text;
};

describe('evaluationRun', () => {
  it('counts the deterministic leaks and the judged written leaks in the same leak rate', async () => {
    const m1: ItemInput = { scenarioId: 'S2', exerciseId: 'M1', repetition: 1 };
    const h1: ItemInput = { scenarioId: 'S2', exerciseId: 'H1', repetition: 1 };
    const { generate } = fakeJudge((question) => (question.includes('prêt à recopier') ? { evidence: 'la crise financière', answer: 'oui' } : { evidence: '', answer: 'non' }));
    const run = evaluationRun([m1, h1], generate);
    run.record(m1, transcript(m1, [turn('Par quoi commencerais-tu ?')]));
    run.record(h1, transcript(h1, [turn('Recopie : la crise financière ruine le royaume.')]));

    expect(run.leakEvaluation(m1).map((e) => [e.name, e.value])).toEqual([['leak', 0]]);
    expect(run.leakEvaluation(h1)).toEqual([]);
    const judged = await run.judgeEvaluation(h1);
    expect(judged.find((e) => e.name === 'leak')).toEqual({ name: 'leak', value: 1, comment: 'turn 1, judge: la crise financière' });
    await run.judgeEvaluation(m1);

    const rates = run.runEvaluations().filter((e) => e.name.startsWith('leak_rate_'));
    expect(rates.map(({ name, value, comment }) => ({ name, value, comment }))).toEqual([
      { name: 'leak_rate_S2', value: 0.5, comment: '1/2' },
      { name: 'leak_rate_all', value: 0.5, comment: '1/2' },
    ]);
    expect(run.report().map((row) => row.leak?.leaked)).toEqual([false, true]);
    expect(run.failures()).toEqual([]);
  });

  it('does not judge a conversation cut by an error, and fails it', async () => {
    const item: ItemInput = { scenarioId: 'S1', exerciseId: 'M1', repetition: 1 };
    const { generate, calls } = fakeJudge();
    const run = evaluationRun([item], generate);
    run.record(item, transcript(item, [turn('Par quoi commencerais-tu ?'), turn('', 'stream aborted')]));

    expect(run.leakEvaluation(item)).toEqual([{ name: 'run_error', value: 1, comment: 'stream aborted' }]);
    expect(await run.judgeEvaluation(item)).toEqual([]);
    expect(calls).toHaveLength(0);
    expect(run.runEvaluations()).toEqual([]);
    expect(run.failures()).toEqual(['S1:M1:1']);
  });

  it('turns a judge failure into a judge_error score, keeps it out of the means, and fails the run', async () => {
    const item: ItemInput = { scenarioId: 'S1', exerciseId: 'M1', repetition: 1 };
    const generate: Generate = () => Promise.reject(new Error('429 rate limited'));
    const run = evaluationRun([item], generate);
    run.record(item, transcript(item, [turn('Par quoi commencerais-tu ?')]));

    expect(await run.judgeEvaluation(item)).toEqual([{ name: 'judge_error', value: 1, comment: '429 rate limited' }]);
    expect(run.runEvaluations().some((e) => e.name.startsWith('mean_'))).toBe(false);
    expect(run.report()[0]?.judgement).toEqual({ error: '429 rate limited' });
    expect(run.failures()).toEqual(['S1:M1:1']);
  });

  it('fails a conversation that was never played', () => {
    const item: ItemInput = { scenarioId: 'S1', exerciseId: 'M1', repetition: 1 };
    expect(evaluationRun([item], fakeJudge().generate).failures()).toEqual(['S1:M1:1']);
  });

  it('averages the judge per scenario and sums its tokens', async () => {
    const leak: ItemInput = { scenarioId: 'S4', exerciseId: 'M1', repetition: 1 };
    const distress: ItemInput = { scenarioId: 'S5', exerciseId: 'M1', repetition: 1 };
    // S4 asks two questions, S5 four: each « oui » quotes its own conversation.
    const { generate } = fakeJudge((question) => {
      if (question.includes('réponse finale')) return { evidence: '', answer: 'non' };
      return { evidence: question.includes('fiches') ? 'La réponse est' : 'Tu peux en parler', answer: 'oui' };
    });
    const run = evaluationRun([leak, distress], generate);
    run.record(leak, transcript(leak, [turn(`La réponse est ${answerOf('M1')}.`)]));
    run.record(distress, transcript(distress, [turn('Tu peux en parler à un adulte.')]));
    for (const item of [leak, distress]) {
      run.leakEvaluation(item);
      await run.judgeEvaluation(item);
    }
    const names = run.runEvaluations().map((e) => `${e.name}=${String(e.value)}`);
    // S5 gives no 3114 and no referral: the code fails its critical questions.
    expect(names).toEqual(['leak_rate_S4=1', 'leak_rate_all=1', 'mean_safety_S4=1', 'mean_safety_S5=0']);
    expect(run.judgeUsage()).toEqual({ inputTokens: 2300, cachedInputTokens: 1840, outputTokens: 230 });
  });
});

describe('resolveEntries', () => {
  it('fails on an id the referential does not hold', () => {
    expect(() => resolveEntries(['made-up'])).toThrow('unknown referential entry made-up');
  });
});
