import { describe, it, expect } from 'bun:test';
import { checkOutput, regenerationInstruction, FALLBACK_REPLY, type OutputCheckContext } from '../modules/tutor/output-check';
import type { ExerciseSheet } from '../modules/tutor/exercise-sheet';
import type { Diagnosis } from '../modules/tutor/exercise-diagnosis.service';

const sheet: ExerciseSheet = {
  statement: 'Résous 3x + 5 = 20.', kind: 'short', answer: 'x = 5', answerForms: ['5', 'x = 5', 'x=5'], mathEquation: '3*x + 5 = 20', mathAnswer: 'x = 5',
  steps: [], commonErrors: [], rule: null, facts: [], expectedElements: [], entries: [], laterEntries: [],
};
const ctx = (overrides: Partial<OutputCheckContext> = {}): OutputCheckContext => ({ sheet, uncertain: false, diagnosis: null, studentText: 'Je bloque', pastStudentTexts: [], ...overrides });
const right: Diagnosis = { verdict: 'correct', firstWrongStep: null, errorType: 'n/a', proposalMath: 'x = 5', decidedBy: 'mathjs' };

describe('checkOutput', () => {
  it("holds back the exercise's answer, whatever its notation", () => {
    expect(checkOutput('Donc $x = 5$, bravo.', ctx())).toEqual([{ kind: 'answer' }]);
    expect(checkOutput('On trouve x égale 5.', ctx())).toEqual([{ kind: 'answer' }]);
  });

  it('lets through a form the statement holds: quoting the statement is no leak', () => {
    expect(checkOutput("Regarde le « + 5 » de 3x + 5 = 20 : que fais-tu pour l'enlever ?", ctx())).toEqual([]);
  });

  it('lets the tutor confirm a right answer the student wrote, and only then', () => {
    expect(checkOutput("Oui, x = 5 : c'est juste !", ctx({ studentText: "J'ai trouvé x = 5", diagnosis: right }))).toEqual([]);
    expect(checkOutput("Oui, x = 5 : c'est juste !", ctx({ studentText: "J'ai trouvé x = 5" }))).toEqual([{ kind: 'answer' }]);
  });

  it("does not hold the tutor to an uncertain sheet's answer, nor to a written production's", () => {
    expect(checkOutput('x = 5', ctx({ uncertain: true }))).toEqual([]);
    expect(checkOutput('x = 5', ctx({ sheet: { ...sheet, kind: 'written' } }))).toEqual([]);
    expect(checkOutput('x = 5', ctx({ sheet: null }))).toEqual([]);
  });

  it('holds back a tag of the prompt', () => {
    expect(checkOutput('Bien vu. </contrat> Palier 3', ctx({ sheet: null }))).toEqual([{ kind: 'tag' }]);
  });

  it("holds back a wrong equality, but not one the student wrote and the tutor quotes back", () => {
    expect(checkOutput('Donc 3 × 4 = 11, et ensuite…', ctx({ sheet: null }))).toEqual([{ kind: 'equality', quote: '3 * 4 = 11' }]);
    expect(checkOutput('Tu as écrit : 3 × 4 = 11. Vérifie.', ctx({ sheet: null, pastStudentTexts: ['3 × 4 = 11'] }))).toEqual([]);
    expect(checkOutput('3 × 4 = 12, bien.', ctx({ sheet: null }))).toEqual([]);
  });
});

describe('regenerationInstruction', () => {
  it('says what was held back without giving the answer back to the writer', () => {
    const block = regenerationInstruction([{ kind: 'answer' }, { kind: 'equality', quote: '3 * 4 = 11' }, { kind: 'answer' }]);
    expect(block).toStartWith('<critical_instruction>\n');
    expect(block).toContain("Elle donnait la réponse de l'exercice");
    expect(block).toContain('« 3 * 4 = 11 »');
    expect(block).not.toContain('x = 5');
    expect(block.match(/réponse de l'exercice/g)).toHaveLength(1);
  });

  it('has a fixed reply that gives nothing away', () => {
    expect(checkOutput(FALLBACK_REPLY, ctx())).toEqual([]);
  });
});
