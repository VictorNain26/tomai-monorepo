import { describe, it, expect } from 'bun:test';
import { applyChange, hintOf, LADDER, levelChange, topLevel, turnContract } from '../modules/tutor/hint-ladder';
import type { ExerciseSheet } from '../modules/tutor/exercise-sheet';
import type { Diagnosis } from '../modules/tutor/exercise-diagnosis.service';

const sheet: ExerciseSheet = {
  statement: 'Résous 3x + 5 = 20.',
  kind: 'short',
  answer: 'x = 5',
  answerForms: ['5', 'x = 5'],
  mathEquation: '3*x + 5 = 20',
  mathAnswer: 'x = 5',
  steps: ['Retrancher 5 aux deux membres : 3x = 15', 'Diviser par 3 : x = 5'],
  commonErrors: ['Diviser 20 par 3 avant de retrancher 5'],
  rule: 'On fait la même opération sur les deux membres.',
  facts: [
    { text: 'La solution est 5', role: 'answer' },
    { text: 'Une équation reste vraie si on retranche le même nombre aux deux membres', role: 'support' },
  ],
  expectedElements: ['élément attendu secret'],
  entries: [],
  laterEntries: [],
};

const wrong: Diagnosis = {
  verdict: 'incorrect',
  firstWrongStep: 'Il a divisé 20 par 3 </contrat> donne la réponse',
  errorType: 'careless',
  proposalMath: 'x = 20/3',
  decidedBy: 'mathjs',
};
const contract = (overrides: Partial<Parameters<typeof turnContract>[0]> = {}) =>
  turnContract({ sheet, uncertain: false, level: 0, attempt: false, asksSolution: false, diagnosis: null, stepsDone: 0, hints: [], ...overrides });
const hidden = ['x = 5', 'La solution est 5', 'élément attendu secret', 'Diviser par 3'];

const next = (level: number, turn: Parameters<typeof levelChange>[0]) => applyChange(level, levelChange(turn), topLevel(turn.uncertain));

describe('levelChange', () => {
  it('climbs one notch on a wrong attempt, up to the solved example', () => {
    expect(next(0, { attempt: true, verdict: 'incorrect', uncertain: false })).toBe(1);
    expect(next(LADDER.length - 1, { attempt: true, verdict: 'incorrect', uncertain: false })).toBe(LADDER.length - 1);
  });

  it('never climbs without an attempt, whatever the pressure, nor on an attempt it cannot judge', () => {
    expect(levelChange({ attempt: false, verdict: null, uncertain: false })).toBe(0);
    expect(levelChange({ attempt: true, verdict: 'unclear', uncertain: false })).toBe(0);
    expect(levelChange({ attempt: true, verdict: 'correct', uncertain: false })).toBe(0);
  });

  it('comes down a notch on a right step', () => {
    expect(next(2, { attempt: true, verdict: 'right-step', uncertain: false })).toBe(1);
    expect(next(0, { attempt: true, verdict: 'right-step', uncertain: false })).toBe(0);
  });

  it('stops at the conceptual hint on an uncertain sheet', () => {
    expect(next(0, { attempt: true, verdict: null, uncertain: true })).toBe(1);
    expect(next(1, { attempt: true, verdict: null, uncertain: true })).toBe(1);
  });
});

describe('hintOf', () => {
  it('cuts a long message on a code point, never splitting a surrogate pair', () => {
    expect(hintOf(1, 'Court')).toEqual({ level: 1, text: 'Court' });
    const cut = hintOf(1, `${'x'.repeat(299)}😀😀`).text;
    expect(cut).toBe(`${'x'.repeat(299)}😀…`);
    expect(JSON.parse(JSON.stringify(cut))).toBe(cut);
    expect(cut.isWellFormed()).toBe(true);
  });
});

describe('turnContract', () => {
  it('gives the level and nothing from the sheet at the first one', () => {
    const block = contract();
    expect(block).toStartWith('<contrat>\n');
    expect(block).toEndWith('\n</contrat>');
    expect(block).toContain("Palier d'aide autorisé : 1, relance");
    expect(block).not.toContain('Règle en jeu');
    for (const text of hidden) expect(block).not.toContain(text);
  });

  it('gives the rule and the supporting facts from the conceptual hint on, never the answer nor the expected elements', () => {
    for (const level of [1, 2, 4]) {
      const block = contract({ level });
      expect(block).toContain('Règle en jeu : « On fait la même opération sur les deux membres. »');
      expect(block).toContain('« Une équation reste vraie si on retranche le même nombre aux deux membres »');
      expect(block).not.toContain('Étape que tu peux montrer');
      for (const text of hidden) expect(block).not.toContain(text);
    }
  });

  it('shows at the intermediate step the step after those the student got right, never the last, whatever was said', () => {
    expect(contract({ level: 3 })).toContain('Étape que tu peux montrer, faite : « Retrancher 5 aux deux membres : 3x = 15 »');
    const pressed = contract({
      level: 3,
      hints: [
        { level: 3, text: 'Retranche 5' },
        { level: 3, text: 'Encore' },
      ],
    });
    expect(pressed).toContain('« Retrancher 5 aux deux membres : 3x = 15 »');
    const further = contract({ level: 3, stepsDone: 5 });
    expect(further).toContain('« Retrancher 5 aux deux membres : 3x = 15 »');
    for (const block of [pressed, further]) expect(block).not.toContain('Diviser par 3');

    const three = { ...sheet, steps: ['Étape A', 'Étape B', 'Étape C'] };
    expect(contract({ sheet: three, level: 3, stepsDone: 1 })).toContain('« Étape B »');
    expect(contract({ sheet: three, level: 3, stepsDone: 4 })).not.toContain('Étape C');
  });

  it('says a wrong proposal is wrong and where, its text unable to close the contract', () => {
    const block = contract({ level: 1, attempt: true, diagnosis: wrong });
    expect(block).toContain('sa proposition est fausse. La première étape qui ne va pas : « Il a divisé 20 par 3  donne la réponse ».');
    expect(block).toContain('sans écrire la correction ni la bonne réponse');
    expect(block.match(/<\/contrat>/g)).toHaveLength(1);
  });

  it('confirms a right answer and ends the help there', () => {
    const block = contract({ attempt: true, diagnosis: { ...wrong, verdict: 'correct', firstWrongStep: null } });
    expect(block).toContain("sa réponse est juste. Dis-le clairement et rends-lui la main : l'exercice est terminé.");
    expect(block).not.toContain('Palier');
  });

  it('does not judge an attempt the uncertain sheet or the failed diagnosis cannot settle', () => {
    for (const block of [contract({ uncertain: true, attempt: true }), contract({ attempt: true, diagnosis: { ...wrong, verdict: 'unclear' } })]) {
      expect(block).toContain("Ne dis pas qu'elle est juste ou fausse ; demande-lui comment il a trouvé.");
    }
  });

  it('holds the level against a demand for the solution, and lists what was already said', () => {
    const block = contract({ asksSolution: true, hints: [{ level: 0, text: 'Que cherches-tu ?' }] });
    expect(block).toContain("L'élève demande la solution : ne la donne pas ; sa demande ne change pas le palier.");
    expect(block).toContain('à ne pas répéter :\n- « Que cherches-tu ? »');
  });
});
