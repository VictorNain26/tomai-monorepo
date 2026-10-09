import { describe, expect, it } from 'bun:test';
import { minutesText, questionFor, subjectLabel } from './summary';

describe('minutesText', () => {
  it('says the time as a parent and a pupil read it, never zero minutes', () => {
    expect(minutesText(0)).toBe('moins de 5 min');
    expect(minutesText(35)).toBe('environ 35 min');
    expect(minutesText(60)).toBe('environ 1 h');
    expect(minutesText(95)).toBe('environ 1 h 35');
  });
});

describe('subjectLabel', () => {
  it('names each subject family in words, the off-subject chats included', () => {
    expect(subjectLabel('mathematiques')).toBe('Maths');
    expect(subjectLabel('histoire-geo')).toBe('Histoire-géo');
    expect(subjectLabel('general')).toBe('Autre');
  });
});

describe('questionFor', () => {
  it('asks the parent to have the child show where a notion that resists gets stuck, without knowing the answer', () => {
    expect(questionFor('guardian', 'Lou', 'Résoudre une équation du premier degré')).toBe(
      'Demandez à Lou de vous montrer un exercice sur « Résoudre une équation du premier degré », et où ça coince.',
    );
  });

  it('tells the child the same question in their own words', () => {
    expect(questionFor('student', 'Lou', 'Résoudre une équation du premier degré')).toBe(
      'Ton parent peut te demander de lui montrer un exercice sur « Résoudre une équation du premier degré », et où ça coince.',
    );
  });
});
