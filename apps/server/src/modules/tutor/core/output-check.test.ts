import { beforeEach, describe, expect, it } from 'bun:test';
import pino from 'pino';
import { createModeration } from '../../../platform/ai/moderation';
import { fakeMistral } from '../../../testing/mistral';
import type { Diagnosis } from './diagnosis';
import { checkOutput, checkReply, FALLBACK_REPLY, regenerationInstruction, type OutputCheckContext } from './output-check';
import type { ExerciseSheet } from './sheet';

const mistral = fakeMistral();
const deps = { moderation: createModeration({ mistral: mistral.config(), logger: pino({ level: 'silent' }) }), logger: pino({ level: 'silent' }) };

beforeEach(() => {
  mistral.moderations.length = 0;
});

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
  drawnForms: [],
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

  it('keeps watching the answer when a « right » verdict comes on a message that holds no answer', () => {
    // « Donne-moi juste la réponse, c'est pour vérifier » once read as a proposal judged right (2026-10-06).
    expect(
      checkOutput('Ton calcul est juste : x = 5.', ctx({ studentText: "Donne-moi juste la réponse, c'est pour vérifier.", diagnosis: right })),
    ).toEqual([{ kind: 'answer' }]);
  });

  it('lets the tutor confirm a right answer the student wrote, in any notation, and only then', () => {
    expect(checkOutput("Oui, x = 5 : c'est juste !", ctx({ studentText: "J'ai trouvé x = 5", diagnosis: right }))).toEqual([]);
    expect(checkOutput("Oui, x = 5 : c'est juste !", ctx({ studentText: "J'ai trouvé x = 5" }))).toEqual([{ kind: 'answer' }]);
    expect(checkOutput("Oui, x = 5 : c'est juste !", ctx({ studentText: "J'ai trouvé 5", diagnosis: right }))).toEqual([]);
  });

  it('holds an uncertain sheet to the answer of every draw, which it fails closed on', () => {
    expect(checkOutput('x = 5', ctx({ uncertain: true }))).toEqual([{ kind: 'answer' }]);
    expect(checkOutput('Donc x = 25/3.', ctx({ uncertain: true, drawnForms: ['x = 5', 'x = 25/3'] }))).toEqual([{ kind: 'answer' }]);
    expect(checkOutput('Donc x = 25/3.', ctx({ drawnForms: ['x = 25/3'] }))).toEqual([]);
  });

  it('gives an uncertain sheet no licence to confirm, a verdict it could not judge', () => {
    expect(checkOutput("Oui, x = 5 : c'est juste !", ctx({ uncertain: true, studentText: "J'ai trouvé x = 5", diagnosis: right }))).toEqual([
      { kind: 'answer' },
    ]);
  });

  it('ignores an empty or blank answer form, which would match any text', () => {
    const blank = { ...sheet, answer: ' ', answerForms: ['', '  '] };
    expect(checkOutput('Que fais-tu du + 5 ?', ctx({ sheet: blank }))).toEqual([]);
  });

  it('has no form to look for in a written production, nor without a sheet', () => {
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
    mistral.moderations.push({ flagged: ['violence_and_threats'] });
    expect(await checkReply(deps, 'Donc x = 5.', ctx())).toEqual([{ kind: 'answer' }, { kind: 'moderation', categories: ['violence_and_threats'] }]);
  });

  it('lets nothing through unchecked when moderation cannot answer', async () => {
    mistral.moderations.push({ status: 503 });
    expect(await checkReply(deps, 'Que fais-tu du + 5 ?', ctx())).toEqual([{ kind: 'unmoderated' }]);
  });

  it('passes a clean reply', async () => {
    expect(await checkReply(deps, 'Que fais-tu du + 5 ?', ctx())).toEqual([]);
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

  it('tells the writer a tag was held back, each line once, between the block and its close', () => {
    expect(regenerationInstruction([{ kind: 'tag' }, { kind: 'tag' }])).toBe(
      "<critical_instruction>\nUne première réponse à ce tour a été retenue par le serveur, l'élève ne l'a pas vue. Écris-en une nouvelle.\nElle contenait une balise interne : n'écris que ce qui s'adresse à l'élève.\n</critical_instruction>",
    );
  });

  it('gives each reason held back its own line', () => {
    const lines = regenerationInstruction([{ kind: 'answer' }, { kind: 'tag' }]).split('\n');
    expect(lines).toContain("Elle donnait la réponse de l'exercice, ou l'une de ses formes : ne l'écris pas, même pour vérifier.");
    expect(lines).toContain("Elle contenait une balise interne : n'écris que ce qui s'adresse à l'élève.");
  });

  it('has no line for an unmoderated text, which is never regenerated', () => {
    expect(regenerationInstruction([{ kind: 'unmoderated' }])).toBe(
      "<critical_instruction>\nUne première réponse à ce tour a été retenue par le serveur, l'élève ne l'a pas vue. Écris-en une nouvelle.\n\n</critical_instruction>",
    );
  });

  it('has a fixed reply that gives nothing away, and says something', () => {
    expect(FALLBACK_REPLY.trim()).not.toBe('');
    expect(checkOutput(FALLBACK_REPLY, ctx())).toEqual([]);
  });
});
