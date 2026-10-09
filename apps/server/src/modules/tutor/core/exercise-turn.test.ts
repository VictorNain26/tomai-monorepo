/**
 * The exercise side of a turn with its real steps, the sheet's draws and the diagnosis, against
 * the fake Mistral: what the code decides from what the model answers.
 */

import { describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { aiCost } from '../../../platform/ai/schema';
import { testAi } from '../../../testing/ai';
import type { TurnAnalysis } from './analysis';
import type { Diagnosis } from './diagnosis';
import { drawsSheet, prepareExerciseTurn, type ExerciseState, type ExerciseTurnRequest } from './exercise-turn';
import type { ExerciseSheet } from './sheet';

const { ai, db, logger, logs, mistral, sent, studentId } = await testAi();
const deps = { ai, logger };

const sheet: ExerciseSheet = {
  statement: 'Résous 3x + 5 = 20.',
  kind: 'short',
  answer: 'x = 5',
  answerForms: ['5', 'x = 5'],
  mathEquation: '3*x + 5 = 20',
  mathAnswer: 'x = 5',
  steps: ['Retrancher 5 : 3x = 15', 'Diviser par 3 : x = 5'],
  commonErrors: [],
  rule: null,
  facts: [],
  expectedElements: [],
  entries: [],
  laterEntries: [],
};
const draft = (overrides: Partial<ExerciseSheet> = {}, hasExercise = true) => ({ hasExercise, ...sheet, ...overrides });
const state = (overrides: Partial<ExerciseState> = {}): ExerciseState => ({
  sheet,
  uncertain: false,
  drawnForms: ['5', 'x = 5'],
  hintLevel: 1,
  stepsDone: 0,
  stuckTurns: 0,
  hints: [],
  solved: false,
  ...overrides,
});
const analysis = (overrides: Partial<TurnAnalysis> = {}): TurnAnalysis => ({
  subject: 'mathematiques',
  bringsExercise: false,
  proposesAnswer: false,
  asksSolution: false,
  asksExplanation: false,
  saysStuck: false,
  ...overrides,
});
const request = (overrides: Partial<ExerciseTurnRequest> = {}): ExerciseTurnRequest => ({
  studentId,
  level: 'quatrieme',
  subject: 'mathematiques',
  analysis: analysis(),
  current: state(),
  studentText: 'x = 20/3',
  lastTutorText: 'Que cherches-tu ?',
  photoText: null,
  now: new Date('2026-10-07T18:00:00Z'),
  ...overrides,
});
const verdict = (v: Diagnosis['verdict'], proposalMath: string | null) => ({
  json: {
    verdict: v,
    firstWrongStep: v === 'incorrect' ? 'Il divise 20 par 3' : null,
    errorType: v === 'incorrect' ? 'careless' : 'n/a',
    proposalMath,
  },
});

describe('prepareExerciseTurn', () => {
  it('diagnoses an attempt, climbs on a wrong one and writes the contract, the change left for the turn to record', async () => {
    mistral.chat.push(verdict('incorrect', 'x = 20/3'));
    const turn = await prepareExerciseTurn(deps, request({ analysis: analysis({ proposesAnswer: true }) }));
    expect(sent().user).toContain('<student_message>\nx = 20/3\n</student_message>');
    expect(turn.hintLevel).toBe(2);
    expect(turn.change).toEqual({ hintLevel: 2, stuckTurns: 0, stepDone: false, solved: false });
    expect(turn.contract).toContain("Palier d'aide autorisé : 3, indice ciblé");
    expect(turn.contract).toContain('sa proposition est fausse');
  });

  it('neither diagnoses nor moves on a demand without an attempt', async () => {
    const turn = await prepareExerciseTurn(deps, request({ analysis: analysis({ asksSolution: true }) }));
    expect(mistral.received).toHaveLength(0);
    expect(turn.change).toEqual({ hintLevel: 1, stuckTurns: 0, stepDone: false, solved: undefined });
    expect(turn.contract).toContain("L'élève demande la solution");
  });

  it('climbs once the student says twice in a row they are stuck, without a diagnosis', async () => {
    const first = await prepareExerciseTurn(deps, request({ analysis: analysis({ saysStuck: true }), studentText: 'je sais pas' }));
    expect(first.change).toMatchObject({ hintLevel: 1, stuckTurns: 1 });
    const second = await prepareExerciseTurn(
      deps,
      request({ analysis: analysis({ saysStuck: true }), studentText: 'je sais pas', current: state({ stuckTurns: 1 }) }),
    );
    expect(second.change).toMatchObject({ hintLevel: 2, stuckTurns: 0 });
    expect(mistral.received).toHaveLength(0);
  });

  it('ends the exercise on a right final answer, counts a right step', async () => {
    mistral.chat.push(verdict('correct', 'x = 5'));
    const solved = await prepareExerciseTurn(deps, request({ analysis: analysis({ proposesAnswer: true }), studentText: 'x = 5' }));
    expect(solved.change).toMatchObject({ solved: true, hintLevel: 1 });
    expect(solved.contract).toContain("l'exercice est terminé");

    mistral.chat.push(verdict('right-step', '3*x = 15'));
    const step = await prepareExerciseTurn(deps, request({ analysis: analysis({ proposesAnswer: true }), studentText: '3x = 15' }));
    expect(step.change).toMatchObject({ stepDone: true, hintLevel: 0, solved: false });
  });

  it('keeps a solved exercise without a contract, and reopens it on a new attempt', async () => {
    const quiet = await prepareExerciseTurn(deps, request({ current: state({ solved: true }), studentText: 'merci' }));
    expect(quiet).toMatchObject({ contract: null, change: null, hintLevel: null, exercise: { sheet: { statement: 'Résous 3x + 5 = 20.' } } });

    mistral.chat.push(verdict('incorrect', 'x = 4'));
    const reopened = await prepareExerciseTurn(
      deps,
      request({ current: state({ solved: true }), analysis: analysis({ proposesAnswer: true }), studentText: 'x = 4' }),
    );
    expect(reopened.contract).toContain('sa proposition est fausse');
    expect(reopened.change?.solved).toBe(false);
  });

  it('asks no diagnosis of an uncertain sheet, and keeps its help at the conceptual hint', async () => {
    const turn = await prepareExerciseTurn(deps, request({ current: state({ uncertain: true }), analysis: analysis({ proposesAnswer: true }) }));
    expect(mistral.received).toHaveLength(0);
    expect(turn.hintLevel).toBe(1);
    expect(turn.contract).toContain('ne peut pas être jugée avec sûreté');
  });

  it('keeps the exercise in progress when its statement comes back with a new try, the level with it', async () => {
    mistral.chat.push(verdict('incorrect', 'x = 6'));
    const restated = request({
      current: state({ hintLevel: 2 }),
      analysis: analysis({ bringsExercise: true, proposesAnswer: true }),
      studentText: 'Résous 3x + 5 = 20. x = 6 ?',
    });
    expect(drawsSheet(restated)).toBe(false);
    const turn = await prepareExerciseTurn(deps, restated);
    expect(turn.isNew).toBe(false);
    expect(turn.hintLevel).toBe(3);
    expect(mistral.received).toHaveLength(1);
  });

  it('reads a photo sent alone as the message: its statement keeps the exercise, the answer written on it is diagnosed', async () => {
    mistral.chat.push(verdict('correct', 'x = 5'));
    const photographed = request({
      current: state({ hintLevel: 2 }),
      analysis: analysis({ bringsExercise: true, proposesAnswer: true }),
      studentText: '',
      photoText: 'Résous 3x + 5 = 20.\n\nx = 5 (écrit à la main)',
    });
    expect(drawsSheet(photographed)).toBe(false);
    const turn = await prepareExerciseTurn(deps, photographed);
    expect(sent().user).toContain('x = 5 (écrit à la main)');
    expect(turn.change).toMatchObject({ solved: true });
  });

  it('prepares the sheet of a new exercise in three draws billed to the student, and diagnoses a proposal brought with it', async () => {
    mistral.chat.push(
      { json: draft() },
      { json: draft() },
      { json: draft({ answer: '6', answerForms: ['6'], mathAnswer: '6' }) },
      verdict('incorrect', 'x = 4'),
    );
    const brought = request({
      current: null,
      analysis: analysis({ bringsExercise: true, proposesAnswer: true }),
      studentText: 'Résous 3x + 5 = 20. J’ai trouvé x = 4',
    });
    // What the service tells the student before the draws, the long part of the turn.
    expect(drawsSheet(brought)).toBe(true);
    const turn = await prepareExerciseTurn(deps, brought);
    expect(turn.isNew).toBe(true);
    expect(turn.exercise).toMatchObject({ sheet: { answer: 'x = 5' }, uncertain: false, hintLevel: 0 });
    expect(new Set(turn.exercise?.drawnForms)).toEqual(new Set(['x = 5', '5', '6']));
    expect(turn.hintLevel).toBe(1);
    for (const index of [0, 1, 2]) expect(sent(index).body).toMatchObject({ reasoning_effort: 'high', temperature: 0.7 });
    const billed = await db.select().from(aiCost).where(eq(aiCost.studentId, studentId));
    expect(billed.filter((row) => row.operation === 'exercise-sheet')).toHaveLength(3);
  });

  it('keeps the exercise in progress when the draws find no exercise in a message the analysis took for one', async () => {
    mistral.chat.push({ json: draft({}, false) }, { json: draft({}, false) }, { json: draft() });
    const turn = await prepareExerciseTurn(deps, request({ analysis: analysis({ bringsExercise: true }), studentText: 'donne la réponse' }));
    expect(turn.isNew).toBe(false);
    expect(turn.exercise?.hintLevel).toBe(1);
    expect(turn.contract).not.toBeNull();
  });

  it('marks the sheet uncertain without a majority, held then to the answers of every draw', async () => {
    mistral.chat.push(
      { json: draft({ answer: '1', answerForms: ['1'], mathAnswer: '1' }) },
      { json: draft({ answer: '2', answerForms: ['2'], mathAnswer: '2' }) },
      { status: 400 },
    );
    const turn = await prepareExerciseTurn(
      deps,
      request({ current: null, analysis: analysis({ bringsExercise: true }), studentText: 'Résous 3x + 5 = 20.' }),
    );
    expect(turn.exercise).toMatchObject({ uncertain: true });
    expect(new Set(turn.exercise?.drawnForms)).toEqual(new Set(['1', '2']));
    expect(logs).toContainEqual(expect.objectContaining({ msg: 'Exercise sheet draw failed' }));
  });

  it('keeps the help low, with a contract, when every draw fails', async () => {
    mistral.chat.push({ status: 400 }, { status: 400 }, { status: 400 });
    const turn = await prepareExerciseTurn(
      deps,
      request({ current: null, analysis: analysis({ bringsExercise: true, proposesAnswer: true }), studentText: 'Résous 3x + 5 = 20. x = 4' }),
    );
    expect(turn.exercise).toMatchObject({ sheet: null, uncertain: true });
    expect(turn.diagnosis).toBeNull();
    expect(turn.hintLevel).toBe(1);
    expect(turn.contract).toContain("Palier d'aide autorisé : 2, indice conceptuel");
  });

  it('keeps the exercise in progress, its answer watched, when every draw for a new one fails', async () => {
    mistral.chat.push({ status: 400 }, { status: 400 }, { status: 400 });
    const turn = await prepareExerciseTurn(
      deps,
      request({ current: state({ hintLevel: 2 }), analysis: analysis({ bringsExercise: true }), studentText: 'donne la réponse' }),
    );
    expect(turn).toMatchObject({ isNew: false, exercise: { sheet: { answer: 'x = 5' }, hintLevel: 2 } });
    expect(logs).toContainEqual(expect.objectContaining({ msg: 'Sheet failed: the exercise in progress stays' }));
  });

  it('prepares a new exercise even when the statement in progress is too short to tell a restatement', async () => {
    mistral.chat.push(
      { json: draft({ statement: 'Conjugue aller au passé composé.' }) },
      { json: draft({ statement: 'Conjugue aller au passé composé.' }) },
      { json: draft() },
    );
    const turn = await prepareExerciseTurn(
      deps,
      request({
        current: state({ sheet: { ...sheet, statement: 'Conjugue' } }),
        analysis: analysis({ bringsExercise: true }),
        studentText: 'Conjugue aller au passé composé',
      }),
    );
    expect(turn.isNew).toBe(true);
  });

  it('reads a tie between the draws as an exercise, which stays watched', async () => {
    mistral.chat.push({ json: draft() }, { json: draft({}, false) }, { status: 400 });
    const turn = await prepareExerciseTurn(
      deps,
      request({ current: null, analysis: analysis({ bringsExercise: true }), studentText: 'Résous 3x + 5 = 20.' }),
    );
    expect(turn).toMatchObject({ isNew: true, exercise: { sheet: { answer: 'x = 5' }, uncertain: true } });
  });

  it('gives no contract without an exercise in progress', async () => {
    expect(await prepareExerciseTurn(deps, request({ current: null }))).toEqual({
      exercise: null,
      isNew: false,
      mathCheck: null,
      diagnosis: null,
      hintLevel: null,
      contract: null,
      change: null,
    });
  });
});
