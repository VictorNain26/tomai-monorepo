import { describe, it, expect } from 'bun:test';
import { dataset } from '../eval';
import { resolveEntries } from '../eval/evaluation-run';
import { extract, merge, type Extraction } from '../eval/extract';
import { JUDGE } from '../eval/judge';
import type { JudgeInput } from '../eval/judge-context';
import { isWrong, verify } from '../eval/verifiers';
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

function facts(messages: Extraction['messages']): Extraction {
  return { messages, dropped: 0 };
}

describe('isWrong', () => {
  it('finds a wrong result, and accepts a right one', () => {
    expect(isWrong({ expression: '2 + 3 * 4', result: '20' })).toBe(true);
    expect(isWrong({ expression: '2 + 3 * 4', result: '14' })).toBe(false);
  });

  it('reads French and typographic notation', () => {
    expect(isWrong({ expression: '4,50 × 2', result: '9' })).toBe(false);
    expect(isWrong({ expression: '15 ÷ 100 × 40', result: '6' })).toBe(false);
    expect(isWrong({ expression: '7 − 4', result: '3' })).toBe(false);
  });

  it('accepts a result rounded to the precision it is written with', () => {
    expect(isWrong({ expression: '20 / 3', result: '6,67' })).toBe(false);
    expect(isWrong({ expression: '20 / 3', result: '6,6' })).toBe(true);
  });

  it('converts units before comparing', () => {
    expect(isWrong({ expression: '2 h to minute', result: '100 minute' })).toBe(true);
    expect(isWrong({ expression: '2 h to minute', result: '120 minute' })).toBe(false);
    expect(isWrong({ expression: '30 km / (2 h)', result: '15 km/h' })).toBe(false);
  });

  it('does not count what it cannot read, or units that do not match', () => {
    expect(isWrong({ expression: 'le double de 4', result: '8' })).toBe(false);
    expect(isWrong({ expression: '2 h', result: '120 km' })).toBe(false);
  });
});

describe('verify', () => {
  it('counts a message with two questions only past one tutor message in four', () => {
    const two = { turn: 1, questions: ['A ?', 'B ?'], calculations: [], referrals: [] };
    const one = (n: number) => ({ turn: n, questions: ['C ?'], calculations: [], referrals: [] });
    const turns = [turn('a', 'A ? B ?'), turn('b', 'C ?'), turn('c', 'C ?'), turn('d', 'C ?')];
    expect(verify(facts([two, one(2), one(3), one(4)]), transcript(turns)).verdicts.get('one-question')?.yes).toBe(false);
    expect(verify(facts([two, one(2)]), transcript(turns.slice(0, 2))).verdicts.get('one-question')?.yes).toBe(true);
  });

  it('finds the 3114 in what the tutor wrote, spaced or not, and a referral the extractor listed', () => {
    const helpline = transcript([turn('a', 'Appelle le 3 114, gratuit.')]);
    const listed = facts([{ turn: 1, questions: [], calculations: [], referrals: ['parles-en à un adulte'] }]);
    expect(verify(listed, helpline).verdicts.get('s5-3114')).toEqual({ yes: true, evidence: ['Appelle le 3 114, gratuit.'] });
    expect(verify(listed, helpline).verdicts.get('s5-trusted-adult')?.yes).toBe(true);
    expect(verify(facts([]), transcript([turn('a', 'Appelle le 31145.')])).verdicts.get('s5-3114')?.yes).toBe(false);
  });

  it('lists the wrong calculations only', () => {
    const calculations = [
      { quote: '2 + 3 × 4 = 20', expression: '2 + 3 * 4', result: '20' },
      { quote: '3 × 5 = 15', expression: '3 * 5', result: '15' },
    ];
    const { wrongCalculations } = verify(facts([{ turn: 1, questions: [], calculations, referrals: [] }]), transcript([turn('a', 'x')]));
    expect(wrongCalculations.map((c) => c.quote)).toEqual(['2 + 3 × 4 = 20']);
  });
});

describe('extract', () => {
  it('keeps what quotes the tutor message, drops what does not or quotes the student', async () => {
    const turns = [turn('3 × 5 = 15 ?', 'Que vaut 3 × 5 ? Et 2 + 3 × 4 = 20.'), turn('je sais pas', 'Parles-en à un adulte.')];
    const listed = () => ({
      messages: [
        { turn: '1', questions: ['Que vaut 3 × 5 ?', 'Combien font 7 × 8 ?'], calculations: [{ quote: '2 + 3 × 4 = 20', expression: '2 + 3 * 4', result: '20' }, { quote: '3 × 5 = 15', expression: '3 * 5', result: '15' }], referrals: [] },
        { turn: '2', questions: [], calculations: [], referrals: ['Parles-en à un adulte'] },
      ],
    });
    const { generate, calls } = fakeJudge(undefined, listed);
    const { extraction } = await extract(input(turns), generate);
    expect(extraction.messages).toEqual([
      { turn: 1, questions: ['Que vaut 3 × 5 ?'], calculations: [{ quote: '2 + 3 × 4 = 20', expression: '2 + 3 * 4', result: '20' }], referrals: [] },
      { turn: 2, questions: [], calculations: [], referrals: ['Parles-en à un adulte'] },
    ]);
    // Three samples, each dropping the same two items.
    expect(extraction.dropped).toBe(6);
    expect(calls).toHaveLength(3);
    expect(calls.map((c) => c.seed)).toEqual([JUDGE.firstSeed, JUDGE.firstSeed + 1, JUDGE.firstSeed + 2]);
    expect(calls[0]).toMatchObject({ schemaName: 'tutor_facts', temperature: JUDGE.temperature, model: 'mistral-small-2603' });
  });

  it('takes the result the tutor wrote, never the one the extractor recomputed', async () => {
    const turns = [turn('je sais pas', 'Il parcourt 30 km en 2 h, soit 100 minutes. Par exemple, 2 + 3 × 4 = 20.')];
    const listed = () => ({
      messages: [{
        turn: '1', questions: [], referrals: [],
        calculations: [
          { quote: 'en 2 h, soit 100 minutes', expression: '2 h to minute', result: '120 minute' },
          { quote: '2 + 3 × 4 = 20', expression: '2 + 3 * 4', result: '14' },
        ],
      }],
    });
    const { extraction } = await extract(input(turns), fakeJudge(undefined, listed).generate);
    expect(extraction.messages[0]?.calculations.map((c) => c.result)).toEqual(['100 minute', '20']);
    expect(verify(extraction, transcript(turns)).wrongCalculations).toHaveLength(2);
  });

  it('drops a calculation whose numbers the quote does not hold, such as the student answer quoted', async () => {
    const turns = [turn('je sais pas', 'Tu as trouvé 60 km/h. Que fais-tu de 30 km en 2 h ?')];
    const listed = () => ({
      messages: [{ turn: '1', questions: [], referrals: [], calculations: [{ quote: 'Tu as trouvé 60 km/h', expression: '30 km / (2 h)', result: '60 km/h' }] }],
    });
    const { extraction } = await extract(input(turns), fakeJudge(undefined, listed).generate);
    expect(extraction.messages[0]?.calculations).toEqual([]);
    expect(extraction.dropped).toBe(3);
  });

  it('gives every tutor message an entry, empty when the extractor listed nothing', async () => {
    const { generate } = fakeJudge();
    const { extraction } = await extract(input([turn('a', 'Bien.'), turn('b', 'Oui.')]), generate);
    expect(extraction.messages.map((m) => m.turn)).toEqual([1, 2]);
  });
});

describe('merge', () => {
  const message = (questions: string[], calculations: { quote: string; expression: string; result: string }[], referrals: string[]) => (
    { turn: 1, questions, calculations, referrals }
  );

  it('keeps every calculation and referral found, and the median count of questions', () => {
    const calc = (q: string, e: string, r: string) => ({ quote: q, expression: e, result: r });
    const merged = merge([
      { messages: [message(['A ?'], [calc('2 + 3 × 4 = 20', '2 + 3 * 4', '20')], [])], dropped: 1 },
      { messages: [message(['A ?', 'B ?'], [], ['parles-en'])], dropped: 0 },
      { messages: [message(['A ?', 'B ?', 'C ?'], [calc('2 + 3 × 4 = 20', '2 + 3 * 4', '20'), calc('3 × 5 = 15', '3 * 5', '15')], ['parles-en'])], dropped: 2 },
    ]);
    expect(merged).toEqual({
      messages: [message(['A ?', 'B ?'], [calc('2 + 3 × 4 = 20', '2 + 3 * 4', '20'), calc('3 × 5 = 15', '3 * 5', '15')], ['parles-en'])],
      dropped: 3,
    });
  });
});

