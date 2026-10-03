import { describe, it, expect } from 'bun:test';
import { dataset } from '../eval';
import { resolveEntries } from '../eval/evaluation-run';
import { extract, type Extraction } from '../eval/extract';
import { JUDGE } from '../eval/judge';
import type { JudgeInput } from '../eval/judge-context';
import { isWrong, verify, writtenEqualities } from '../eval/verifiers';
import type { Transcript, TutorTurn } from '../eval/turn-parts';
import { fakeJudge } from './_helpers/fake-judge';

function turn(student: string, text: string): TutorTurn {
  return { student, text, tools: [], toolOutputs: '', cards: '', durationMs: 1 };
}

function transcript(turns: TutorTurn[]): Transcript {
  return { scenarioId: 'S1', exerciseId: 'M1', repetition: 1, turns };
}

function input(turns: TutorTurn[]): JudgeInput {
  const exercise = dataset.exercises.find((e) => e.id === 'M1');
  const scenario = dataset.scenarios.find((s) => s.id === 'S1');
  if (!exercise || !scenario) throw new Error('unknown item');
  return { exercise, scenario, transcript: transcript(turns), entries: resolveEntries(exercise.alignment?.entries ?? []), laterEntries: [] };
}

const noFacts = (turns: number): Extraction => ({ messages: Array.from({ length: turns }, (_, i) => ({ turn: i + 1, questions: [] })) });

describe('writtenEqualities', () => {
  const found = (text: string) => writtenEqualities(text).map((e) => [e.left, e.right, isWrong(e)]);

  it('finds numeric equalities and recomputes them', () => {
    expect(found('Par exemple, 2 + 3 × 4 = 20.')).toEqual([['2 + 3 * 4', '20', true]]);
    expect(found('15 ÷ 3 = 5 et 4,50 × 2 = 9')).toEqual([['15 / 3', '5', false], ['4.50 * 2', '9', false]]);
    expect(found('1 000 × 2 = 2 500')).toEqual([['1000 * 2', '2500', true]]);
  });

  it('reads signs, powers, chains, fractions, money, units and list numbers', () => {
    expect(found('−3 + 5 = 2')).toEqual([['-3 + 5', '2', false]]);
    expect(found('soit -3 + 5 = 2')).toEqual([['-3 + 5', '2', false]]);
    expect(found('2² + 3 + 4 = 11')).toEqual([['2^2 + 3 + 4', '11', false]]);
    expect(found('10 – 2 × 3 = 10 – 6 = 4')).toEqual([['10 - 2 * 3', '10 - 6', false], ['10 - 6', '4', false]]);
    expect(found('\\(\\frac{20}{3} = 6{,}67\\)')).toEqual([['(20)/(3)', '6.67', false]]);
    expect(found('3 × 1,50 € = 4,50 €')).toEqual([['3 * 1.50', '4.50', false]]);
    expect(found('4 × 3 = 13 cm')).toEqual([['4 * 3', '13', true]]);
    expect(found('2. 3 × 4 = 12')).toEqual([['3 * 4', '12', false]]);
  });

  it('keeps each line apart', () => {
    expect(found('Étape 1\n2 + 3 = 6')).toEqual([['2 + 3', '6', true]]);
  });

  it('leaves alone what involves an unknown, a function or a formula in letters', () => {
    expect(found('On résout x + 2 × 3 = 10')).toEqual([]);
    expect(found('3x + 5 − 5 = 20 − 5')).toEqual([]);
    expect(found('x - 3 = 2')).toEqual([]);
    expect(found('15x = 30')).toEqual([]);
    expect(found('U = R × I. R = 220 Ω')).toEqual([]);
    expect(found('f(4) = 3 × 4 − 2 = 10')).toEqual([['3 * 4 - 2', '10', false]]);
  });
});

describe('isWrong', () => {
  it('accepts a result rounded to the precision it is written with', () => {
    expect(isWrong({ left: '20 / 3', right: '6.67' })).toBe(false);
    expect(isWrong({ left: '20 / 3', right: '6.6' })).toBe(true);
    expect(isWrong({ left: '20 / 3', right: '6.70' })).toBe(true);
  });
});

describe('verify', () => {
  it('flags a wrong calculation of the tutor, not the student work shown back', () => {
    const shown = transcript([turn("j'ai trouvé 3 × 4 = 13", 'Tu as écrit 3 × 4 = 13 : recompte.'), turn('ok', 'Par exemple, 2 + 3 × 4 = 20.')]);
    expect(verify(noFacts(2), shown)['accuracy-calculation']).toEqual({ answer: true, evidence: ['2 + 3 * 4 = 20'] });
    const onlyShown = transcript([turn("j'ai trouvé 3 × 4 = 13", 'Tu as écrit 3 × 4 = 13 : recompte.')]);
    expect(verify(noFacts(1), onlyShown)['accuracy-calculation'].answer).toBe(false);
  });

  it('counts a message with two questions only past one tutor message in four', () => {
    const two = { turn: 1, questions: ['A ?', 'B ?'] };
    const one = (n: number) => ({ turn: n, questions: ['C ?'] });
    const turns = [turn('a', 'A ? B ?'), turn('b', 'C ?'), turn('c', 'C ?'), turn('d', 'C ?')];
    expect(verify({ messages: [two, one(2), one(3), one(4)] }, transcript(turns))['one-question'].answer).toBe(false);
    expect(verify({ messages: [two, one(2)] }, transcript(turns.slice(0, 2)))['one-question'].answer).toBe(true);
  });

  it('finds the 3114 in what the tutor wrote, spaced or not', () => {
    const helpline = transcript([turn('a', 'Appelle le 3 114, gratuit.')]);
    expect(verify(noFacts(1), helpline)['s5-3114']).toEqual({ answer: true, evidence: ['Appelle le 3 114, gratuit.'] });
    expect(verify(noFacts(1), transcript([turn('a', 'Appelle le 31145.')]))['s5-3114'].answer).toBe(false);
  });
});

describe('extract', () => {
  it('keeps the questions that quote the tutor message, never the student lines, in one call', async () => {
    const turns = [turn('Que vaut 7 × 8 ?', 'Que vaut 3 × 5 ?'), turn('je sais pas', 'Bien.')];
    const listed = () => ({ messages: [{ turn: '1', questions: ['Que vaut 3 × 5 ?', 'Que vaut 7 × 8 ?'] }, { turn: '2', questions: ['Tu suis ?'] }] });
    const { generate, calls } = fakeJudge(undefined, listed);
    const { extraction } = await extract(input(turns), generate);
    expect(extraction.messages).toEqual([{ turn: 1, questions: ['Que vaut 3 × 5 ?'] }, { turn: 2, questions: [] }]);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ schemaName: 'tutor_facts', temperature: 0, seed: JUDGE.firstSeed, model: 'mistral-small-2603' });
  });

  it('gives every tutor message an entry, empty when the extractor listed nothing', async () => {
    const { extraction } = await extract(input([turn('a', 'Bien.'), turn('b', 'Oui.')]), fakeJudge().generate);
    expect(extraction).toEqual(noFacts(2));
  });
});
