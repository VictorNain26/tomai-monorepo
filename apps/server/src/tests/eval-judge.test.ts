import { describe, it, expect } from 'bun:test';
import type { z } from 'zod';
import type { MistralMessage } from '../platform/ai/mistral-client';
import { dataset } from '../eval';
import { JUDGE, judge, judgeMessages, sections, type Generate, type JudgeInput, type Verdict } from '../eval/judge';
import { meanScores, verdictScores } from '../eval/judge-scores';
import { programmes } from '../referential';
import type { Transcript } from '../eval/turn-parts';

const byId = new Map(programmes.flatMap(({ entries }) => entries.map((e) => [e.id, e] as const)));

function input(exerciseId: string, scenarioId: string, transcript?: Transcript): JudgeInput {
  const exercise = dataset.exercises.find((e) => e.id === exerciseId);
  const scenario = dataset.scenarios.find((s) => s.id === scenarioId);
  if (!exercise || !scenario) throw new Error('unknown item');
  const resolve = (ids: readonly string[]) => ids.flatMap((id) => byId.get(id) ?? []);
  return {
    exercise,
    scenario,
    transcript: transcript ?? {
      scenarioId, exerciseId, repetition: 1,
      turns: [{ student: exercise.statement, text: 'Que faut-il enlever des deux côtés ?', tools: [], toolOutputs: '', cards: '', durationMs: 1 }],
    },
    entries: resolve(exercise.alignment?.entries ?? []),
    laterEntries: resolve(exercise.alignment?.laterEntries ?? []),
  };
}

const evidence = 'Tuteur : …';
const help = {
  diagnosis: { evidence, score: '2' }, oneQuestion: { evidence, score: '1' }, gradedHints: { evidence, score: '1' },
  accuracy: { evidence, score: '1' }, level: { evidence, score: '1' }, tone: { evidence, score: '0' },
  languageLevel: { evidence, rating: 'partly' },
} as const;

function contentOf(message: MistralMessage | undefined): string {
  return typeof message?.content === 'string' ? message.content : '';
}

/** A stand-in for the model: returns `object` validated by the schema it was asked to fill. */
function fakeModel(object: unknown) {
  const calls: { schema: z.ZodType; model: string; temperature: number }[] = [];
  const generate: Generate = (opts) => {
    calls.push({ schema: opts.schema, model: opts.model, temperature: opts.temperature });
    return Promise.resolve({ object: opts.schema.parse(object) });
  };
  return { generate, calls };
}

describe('judgeMessages', () => {
  it('gives the judge the class, the expected answer, the programme entries, the scenario and the transcript', () => {
    const item = input('M3', 'S1');
    const [system, user] = judgeMessages(item);
    expect(contentOf(system)).toContain('diagnosis, 0 à 2');
    const text = contentOf(user);
    expect(text).toContain('Classe de l\'élève : 4e');
    expect(text).toContain(item.exercise.statement);
    expect(text).toContain('Réponse attendue (ne doit pas être donnée) : 10 cm');
    for (const entry of item.entries) expect(text).toContain(entry.text);
    for (const entry of item.laterEntries) expect(text).toContain(`${entry.id} : `);
    expect(text).toContain(item.scenario.expectedBehavior);
    expect(text).toContain('Tuteur : Que faut-il enlever des deux côtés ?');
  });

  it('gives the expected elements of a written production and no programme when there is none', () => {
    const text = contentOf(judgeMessages(input('H1', 'S2'))[1]);
    expect(text).toContain('Production rédigée attendue : la crise financière');
    expect(text).toContain('Aucune entrée du programme fournie');
  });
});

describe('sections', () => {
  it('follows the grading of the scenario and the kind of answer', () => {
    expect(sections(input('M1', 'S1'))).toEqual({ help: true, writtenLeak: false, safety: false, alignment: true });
    expect(sections(input('H1', 'S2'))).toEqual({ help: true, writtenLeak: true, safety: false, alignment: false });
    expect(sections(input('F1', 'S5'))).toEqual({ help: false, writtenLeak: false, safety: true, alignment: false });
  });
});

describe('judge', () => {
  it('calls the pinned model at temperature 0 with a schema that requires the asked sections', async () => {
    const verdict: Verdict = { help: { ...help, alignment: { evidence, inClass: 'yes', laterNotionsUsed: [] } }, writtenLeak: null, safety: null };
    const { generate, calls } = fakeModel(verdict);
    expect(await judge(input('M1', 'S1'), generate)).toEqual(verdict);
    expect(calls[0]?.model).toBe(JUDGE.model);
    expect(calls[0]?.temperature).toBe(0);
    const schema = calls[0]?.schema;
    expect(schema?.safeParse({ ...verdict, help: null }).success).toBe(false);
    expect(schema?.safeParse({ ...verdict, help: { ...help, alignment: null } }).success).toBe(false);
    expect(schema?.safeParse({ ...verdict, safety: { evidence: '…', rating: 'partly' } }).success).toBe(false);
  });

  it('rejects a later notion that was not given to it', async () => {
    const { generate } = fakeModel({ help: { ...help, alignment: { evidence: '…', inClass: 'no', laterNotionsUsed: ['made-up'] } }, writtenLeak: null, safety: null });
    const outcome = await judge(input('M3', 'S1'), generate).then(() => 'resolved', (error: unknown) => String(error));
    expect(outcome).toContain('unknown later notions: made-up');
  });
});

describe('verdictScores and meanScores', () => {
  it('turns a verdict into the protocol grid out of 8 and the other scores', () => {
    const scores = verdictScores({
      help: { ...help, alignment: { evidence: 'a', inClass: 'no', laterNotionsUsed: ['x', 'y'] } },
      writtenLeak: { evidence: 'p', leaked: true, turn: 2 },
      safety: { evidence: 's', rating: 'partly' },
    });
    const value = (name: string) => scores.find((s) => s.name === name)?.value;
    expect(value('help_total')).toBe(6);
    expect(value('language_level')).toBe(0.5);
    expect(value('alignment_in_class')).toBe(0);
    expect(value('alignment_later_notions')).toBe(2);
    expect(value('leak_written')).toBe(1);
    expect(value('safety')).toBe(0.5);
  });

  it('averages each score per scenario and overall', () => {
    expect(meanScores([
      { scenarioId: 'S1', scores: [{ name: 'help_total', value: 4, comment: '' }] },
      { scenarioId: 'S1', scores: [{ name: 'help_total', value: 6, comment: '' }] },
      { scenarioId: 'S2', scores: [{ name: 'help_total', value: 2, comment: '' }] },
    ]).map(({ name, value }) => ({ name, value }))).toEqual([
      { name: 'mean_help_total_S1', value: 5 },
      { name: 'mean_help_total_all', value: 4 },
      { name: 'mean_help_total_S2', value: 2 },
    ]);
  });
});
