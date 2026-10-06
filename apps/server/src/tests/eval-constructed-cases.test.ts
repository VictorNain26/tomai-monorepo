import { describe, it, expect } from 'bun:test';
import { dataset } from '../eval';
import { casesSchema, constructedCases, detection, faultFlagged, versions } from '../eval/constructed-cases';

describe('constructedCases', () => {
  it('hold two cases for each of the eleven faults, each aimed at one judge question', () => {
    expect(constructedCases.map((c) => `${c.fault}:${c.check}`)).toEqual([
      'unrolled-method:hints-unrolls',
      'unrolled-method:hints-unrolls',
      'calculation-error:accuracy-calculation',
      'calculation-error:accuracy-calculation',
      'two-questions:one-question',
      'two-questions:one-question',
      'later-notion:alignment-later',
      'later-notion:alignment-later',
      'written-answer:written-leak',
      'written-answer:written-leak',
      'no-3114:s5-3114',
      'no-3114:s5-3114',
      'no-trusted-adult:s5-trusted-adult',
      'no-trusted-adult:s5-trusted-adult',
      'question-after-distress:s5-question-after',
      'question-after-distress:s5-question-after',
      'wrong-rule:accuracy',
      'wrong-rule:accuracy',
      'no-diagnosis:diagnosis-uses',
      'no-diagnosis:diagnosis-uses',
    ]);
  });

  it('differ between their versions in the faulty tutor message only, and state the exercise', () => {
    for (const c of constructedCases) {
      const { clean, faulty } = versions(c);
      const changed = clean.turns.flatMap((turn, index) => (turn.text === faulty.turns[index]?.text ? [] : [index + 1]));
      expect({ id: c.id, changed }).toEqual({ id: c.id, changed: [c.faultyTurn] });
      const statement = dataset.exercises.find((e) => e.id === c.exerciseId)?.statement ?? '';
      expect(clean.turns[0]?.student).toContain(statement);
    }
  });

  it('reject a case on an unknown exercise, a question not asked, a missing statement, an unchanged message or a distress fault before the end', () => {
    const [base] = constructedCases;
    const distress = constructedCases.find((c) => c.check === 's5-question-after');
    if (!base || !distress) throw new Error('no case');
    const result = casesSchema.safeParse([
      { ...base, id: 'a', exerciseId: 'X9' },
      { ...base, id: 'b', check: 's5-3114' },
      { ...base, id: 'c', turns: [{ student: 'aide-moi', tutor: 'Oui.' }, ...base.turns.slice(1)] },
      { ...base, id: 'd', faultyTutor: base.turns[base.faultyTurn - 1]?.tutor },
      { ...base, id: 'd', faultyTurn: 9 },
      { ...distress, id: 'e', faultyTurn: 2, faultyTutor: 'On reprend : quel est le COD ?' },
    ]);
    expect(result.error?.issues.map((i) => i.message)).toEqual([
      'case a: no exercise X9 in scenario S1',
      'case b: question s5-3114 is not asked here',
      'case c: the first student turn must contain {statement}',
      'case d: the faulty message is the clean one',
      'case d: duplicate id',
      'case d: the faulty turn is past the conversation',
      'case e: the reply to the distress message is the last one',
    ]);
  });
});

describe('faultFlagged', () => {
  it('flags the majority answer that fails the tutor', () => {
    expect(faultFlagged({ yes: 4, samples: 5, pass: 'non' })).toBe(true);
    expect(faultFlagged({ yes: 1, samples: 5, pass: 'non' })).toBe(false);
    expect(faultFlagged({ yes: 1, samples: 5, pass: 'oui' })).toBe(true);
    expect(faultFlagged({ yes: 4, samples: 5, pass: 'oui' })).toBe(false);
  });
});

describe('detection', () => {
  it('counts faulty versions flagged and clean ones left alone, failed judgements apart', () => {
    expect(
      detection([
        { id: 'u1', fault: 'unrolled', flagged: { clean: false, faulty: true } },
        { id: 'u2', fault: 'unrolled', flagged: { clean: true, faulty: false } },
        { id: 'c1', fault: 'calc', flagged: { clean: null, faulty: true } },
      ]),
    ).toEqual([
      { fault: 'unrolled', cases: 2, detected: 1, faultyJudged: 2, cleanKept: 1, cleanJudged: 2, missed: ['u2'], falseAlarms: ['u2'], failed: [] },
      { fault: 'calc', cases: 1, detected: 1, faultyJudged: 1, cleanKept: 0, cleanJudged: 0, missed: [], falseAlarms: [], failed: ['c1 (clean)'] },
    ]);
  });
});
