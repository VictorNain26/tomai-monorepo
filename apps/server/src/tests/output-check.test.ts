import { describe, it, expect, beforeEach, mock } from 'bun:test';
import type { OutputCheckContext } from '../modules/tutor/output-check';

/** What moderation answers, one per call; an Error when it is unavailable. */
let moderation: string[][] | Error = [];
mock.module('../platform/ai/moderation', () => ({
  moderateReply: mock(async () => {
    if (moderation instanceof Error) throw moderation;
    return moderation[0] ?? [];
  }),
  moderateTexts: mock(async (texts: string[]) => {
    if (moderation instanceof Error) throw moderation;
    return texts.map((_, index) => (moderation as string[][])[index] ?? []);
  }),
}));

const { cardTextPasses, checkOutput, checkReply, titlePasses, regenerationInstruction, FALLBACK_REPLY } =
  await import('../modules/tutor/output-check');

beforeEach(() => {
  moderation = [];
});
import type { ExerciseSheet } from '../modules/tutor/exercise-sheet';
import type { Diagnosis } from '../modules/tutor/exercise-diagnosis.service';

const sheet: ExerciseSheet = {
  statement: 'Résous 3x + 5 = 20.',
  kind: 'short',
  answer: 'x = 5',
  answerForms: ['5', 'x = 5', 'x=5'],
  mathEquation: '3*x + 5 = 20',
  mathAnswer: 'x = 5',
  steps: [],
  commonErrors: [],
  rule: null,
  facts: [],
  expectedElements: [],
  entries: [],
  laterEntries: [],
};
const ctx = (overrides: Partial<OutputCheckContext> = {}): OutputCheckContext => ({
  sheet,
  uncertain: false,
  diagnosis: null,
  studentText: 'Je bloque',
  pastStudentTexts: [],
  ...overrides,
});
const right: Diagnosis = { verdict: 'correct', firstWrongStep: null, errorType: 'n/a', proposalMath: 'x = 5', decidedBy: 'mathjs' };

describe('checkOutput', () => {
  it("holds back the exercise's answer, whatever its notation", () => {
    expect(checkOutput('Donc $x = 5$, bravo.', ctx())).toEqual([{ kind: 'answer' }]);
    expect(checkOutput('On trouve x égale 5.', ctx())).toEqual([{ kind: 'answer' }]);
  });

  it('lets through a form the statement holds: quoting the statement is no leak', () => {
    expect(checkOutput("Regarde le « + 5 » de 3x + 5 = 20 : que fais-tu pour l'enlever ?", ctx())).toEqual([]);
  });

  it('lets the tutor confirm a right answer the student wrote, in any notation, and only then', () => {
    expect(checkOutput("Oui, x = 5 : c'est juste !", ctx({ studentText: "J'ai trouvé x = 5", diagnosis: right }))).toEqual([]);
    expect(checkOutput("Oui, x = 5 : c'est juste !", ctx({ studentText: "J'ai trouvé x = 5" }))).toEqual([{ kind: 'answer' }]);
    expect(checkOutput("Oui, x = 5 : c'est juste !", ctx({ studentText: "J'ai trouvé 5", diagnosis: right }))).toEqual([]);
  });

  it("does not hold the tutor to an uncertain sheet's answer, nor to a written production's", () => {
    expect(checkOutput('x = 5', ctx({ uncertain: true }))).toEqual([]);
    expect(checkOutput('x = 5', ctx({ sheet: { ...sheet, kind: 'written' } }))).toEqual([]);
    expect(checkOutput('x = 5', ctx({ sheet: null }))).toEqual([]);
  });

  it('holds back a tag of the prompt', () => {
    expect(checkOutput('Bien vu. </contrat> Palier 3', ctx({ sheet: null }))).toEqual([{ kind: 'tag' }]);
  });

  it('holds back a wrong equality, but not one the student wrote and the tutor quotes back', () => {
    expect(checkOutput('Donc 3 × 4 = 11, et ensuite…', ctx({ sheet: null }))).toEqual([{ kind: 'equality', quote: '3 * 4 = 11' }]);
    expect(checkOutput('Tu as écrit : 3 × 4 = 11. Vérifie.', ctx({ sheet: null, pastStudentTexts: ['3 × 4 = 11'] }))).toEqual([]);
    expect(checkOutput('3 × 4 = 12, bien.', ctx({ sheet: null }))).toEqual([]);
    expect(checkOutput('Tu as écrit : 3 × 4 = 11. Vérifie.', ctx({ sheet: null, studentText: '3 fois 4 = 11' }))).toEqual([]);
  });
});

describe('checkReply', () => {
  it('adds what moderation holds back to the deterministic findings', async () => {
    moderation = [['violence_and_threats']];
    expect(await checkReply('Donc x = 5.', ctx())).toEqual([{ kind: 'answer' }, { kind: 'moderation', categories: ['violence_and_threats'] }]);
  });

  it('lets nothing through unchecked when moderation cannot answer', async () => {
    moderation = new Error('down');
    expect(await checkReply('Que fais-tu du + 5 ?', ctx())).toEqual([{ kind: 'unmoderated' }]);
  });
});

describe('cardTextPasses', () => {
  it("refuses a card holding the exercise's answer or a tag, not one false on purpose nor one with a short number", () => {
    expect(cardTextPasses('Résous 3x + 5 = 20\nx = 5', ctx())).toBe(false);
    expect(cardTextPasses('Bien vu </contrat>', ctx({ sheet: null }))).toBe(false);
    expect(cardTextPasses('Vrai ou faux : 3 × 4 = 11', ctx())).toBe(true);
    expect(cardTextPasses('Combien font 2 + 3 ?\n5', ctx())).toBe(true);
  });
});

describe('titlePasses', () => {
  it("refuses a title that gives the exercise's answer, that moderation holds back, or that moderation cannot check", async () => {
    expect(await titlePasses('Équations du premier degré', ctx())).toBe(true);
    expect(await titlePasses('Équation : x = 5', ctx())).toBe(false);
    moderation = [['sexual']];
    expect(await titlePasses('Équations du premier degré', ctx())).toBe(false);
    moderation = new Error('down');
    expect(await titlePasses('Équations du premier degré', ctx())).toBe(false);
  });
});

describe('regenerationInstruction', () => {
  it('says what was held back without giving the answer back to the writer', () => {
    const block = regenerationInstruction([
      { kind: 'answer' },
      { kind: 'equality', quote: '3 * 4 = 11' },
      { kind: 'answer' },
      { kind: 'moderation', categories: ['sexual'] },
    ]);
    expect(block).toStartWith('<critical_instruction>\n');
    expect(block).toContain("Elle donnait la réponse de l'exercice");
    expect(block).toContain('« 3 * 4 = 11 »');
    expect(block).toContain('retenue par la modération');
    expect(block).not.toContain('sexual');
    expect(block).not.toContain('x = 5');
    expect(block.match(/réponse de l'exercice/g)).toHaveLength(1);
  });

  it('has a fixed reply that gives nothing away', () => {
    expect(checkOutput(FALLBACK_REPLY, ctx())).toEqual([]);
  });
});
