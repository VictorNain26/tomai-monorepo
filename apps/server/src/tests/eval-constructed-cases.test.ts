import { describe, it, expect } from 'bun:test';
import { casesSchema, constructedCases, detection, versions } from '../eval/constructed-cases';

describe('constructedCases', () => {
  it('hold two cases for each of the six faults', () => {
    const faults = new Map<string, number>();
    for (const c of constructedCases) faults.set(c.fault, (faults.get(c.fault) ?? 0) + 1);
    expect([...faults]).toEqual([
      ['unrolled-method', 2], ['calculation-error', 2], ['two-questions', 2],
      ['later-notion', 2], ['written-answer', 2], ['no-3114', 2],
    ]);
  });

  it('differ between their versions in the faulty tutor message only', () => {
    for (const c of constructedCases) {
      const { clean, faulty } = versions(c);
      const changed = clean.turns.flatMap((turn, index) => (turn.text === faulty.turns[index]?.text ? [] : [index + 1]));
      expect({ id: c.id, changed }).toEqual({ id: c.id, changed: [c.faultyTurn] });
      expect(clean.turns[0]?.student).not.toContain('{statement}');
    }
  });

  it('reject a case on an unknown exercise, an ungraded criterion, equal grades or an unchanged message', () => {
    const [base] = constructedCases;
    if (!base) throw new Error('no case');
    const result = casesSchema.safeParse([
      { ...base, id: 'a', exerciseId: 'X9' },
      { ...base, id: 'b', criterion: 'safety' },
      { ...base, id: 'c', faulty: base.clean },
      { ...base, id: 'd', faultyTutor: base.turns[base.faultyTurn - 1]?.tutor },
      { ...base, id: 'd', faultyTurn: 9 },
    ]);
    expect(result.error?.issues.map((i) => i.message)).toEqual([
      'case a: no exercise X9 in scenario S1',
      'case b: criterion safety is not graded here',
      'case b: clean and faulty grades must be two values of the criterion',
      'case c: clean and faulty grades must be two values of the criterion',
      'case d: the faulty message is the clean one',
      'case d: duplicate id',
      'case d: the faulty turn is past the conversation',
    ]);
  });
});

describe('detection', () => {
  it('counts faulty versions caught and clean versions left alone, per fault', () => {
    expect(detection([
      { id: 'u1', fault: 'unrolled', expected: { clean: 2, faulty: 0 }, got: { clean: 2, faulty: 0 } },
      { id: 'u2', fault: 'unrolled', expected: { clean: 2, faulty: 0 }, got: { clean: 1, faulty: 2 } },
      { id: 'c1', fault: 'calc', expected: { clean: 1, faulty: 0 }, got: { clean: null, faulty: 0 } },
    ])).toEqual([
      { fault: 'unrolled', cases: 2, detected: 1, cleanKept: 1, missed: ['u2'], falseAlarms: ['u2'] },
      { fault: 'calc', cases: 1, detected: 1, cleanKept: 0, missed: [], falseAlarms: ['c1'] },
    ]);
  });
});
