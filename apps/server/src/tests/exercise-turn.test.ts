import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';
import { analysis } from './_helpers/turn-analysis';
import type { ExerciseSheet } from '../modules/tutor/exercise-sheet';
import type { ExerciseState } from '../modules/tutor/exercise-sheet.service';
import type { Diagnosis } from '../modules/tutor/exercise-diagnosis.service';

mock.module('../platform/observability/logger', () => ({ logger: createMockLogger() }));

const sheet: ExerciseSheet = {
  statement: 'Résous 3x + 5 = 20.', kind: 'short', answer: 'x = 5', answerForms: ['5'], mathEquation: null, mathAnswer: 'x = 5',
  steps: ['Retrancher 5', 'Diviser par 3'], commonErrors: [], rule: null, facts: [], expectedElements: [], entries: [], laterEntries: [],
};
const state = (overrides: Partial<ExerciseState> = {}): ExerciseState => ({ id: 'ex-1', sheet, uncertain: false, hintLevel: 1, hints: [], ...overrides });

let current: ExerciseState | null = state();
const prepareExerciseSheet = mock(async (_params: unknown): Promise<ExerciseState> => state({ id: 'ex-new', hintLevel: 0 }));
mock.module('../modules/tutor/exercise-sheet.service', () => ({ prepareExerciseSheet, currentExercise: mock(async () => current) }));

let verdict: Diagnosis['verdict'] = 'incorrect';
const diagnose = mock(async (_sheet: ExerciseSheet, _turn: unknown): Promise<Diagnosis> => ({ verdict, firstWrongStep: null, errorType: 'careless', proposalMath: null, decidedBy: 'model' }));
mock.module('../modules/tutor/exercise-diagnosis.service', () => ({ diagnose }));

const updateProgress = mock(async (_id: string, _progress: { hintLevel: number; solved: boolean }) => {});
mock.module('../modules/tutor/exercise-sheets.repository', () => ({ exerciseSheetsRepository: { updateProgress } }));

const { prepareExerciseTurn } = await import('../modules/tutor/exercise-turn');

const params = (overrides: Partial<Parameters<typeof prepareExerciseTurn>[0]> = {}) => ({
  userId: 'u1', sessionId: 's1', level: 'quatrieme' as const, subject: 'mathematiques', analysis: analysis(),
  studentText: 'Je bloque', lastTutorText: 'Que cherches-tu ?', attachedFilesBlock: null, ...overrides,
});

beforeEach(() => {
  current = state();
  verdict = 'incorrect';
  prepareExerciseSheet.mockClear();
  diagnose.mockClear();
  updateProgress.mockClear();
});

describe('prepareExerciseTurn', () => {
  it('diagnoses an attempt, climbs on a wrong one, keeps the level and writes the contract', async () => {
    const turn = await prepareExerciseTurn(params({ analysis: analysis({ proposesAnswer: true }), studentText: 'x = 20/3' }));

    expect(diagnose.mock.calls[0]?.[1]).toEqual({ studentText: 'x = 20/3', lastTutorText: 'Que cherches-tu ?', userId: 'u1', sessionId: 's1' });
    expect(turn.hintLevel).toBe(2);
    expect(updateProgress).toHaveBeenCalledWith('ex-1', { hintLevel: 2, solved: false });
    expect(turn.contract).toContain("Palier d'aide autorisé : 3, indice ciblé");
    expect(turn.contract).toContain('sa proposition est fausse');
  });

  it('neither diagnoses nor moves on a message without an attempt', async () => {
    const turn = await prepareExerciseTurn(params({ analysis: analysis({ asksSolution: true }) }));

    expect(diagnose).not.toHaveBeenCalled();
    expect(updateProgress).not.toHaveBeenCalled();
    expect(turn.hintLevel).toBe(1);
    expect(turn.contract).toContain("L'élève demande la solution");
  });

  it('ends the exercise on a right final answer', async () => {
    verdict = 'correct';
    const turn = await prepareExerciseTurn(params({ analysis: analysis({ proposesAnswer: true }) }));

    expect(updateProgress).toHaveBeenCalledWith('ex-1', { hintLevel: 1, solved: true });
    expect(turn.contract).toContain("l'exercice est terminé");
  });

  it('asks no diagnosis of an uncertain sheet', async () => {
    current = state({ uncertain: true, hintLevel: 0 });
    const turn = await prepareExerciseTurn(params({ analysis: analysis({ proposesAnswer: true }) }));

    expect(diagnose).not.toHaveBeenCalled();
    expect(turn.hintLevel).toBe(1);
    expect(turn.contract).toContain('ne peut pas être jugée avec sûreté');
  });

  it('prepares the sheet of a new exercise, and diagnoses a proposal brought with it', async () => {
    const turn = await prepareExerciseTurn(params({ analysis: analysis({ bringsExercise: true, proposesAnswer: true }), attachedFilesBlock: '<attached_file name="p">x</attached_file>' }));

    expect(prepareExerciseSheet.mock.calls[0]?.[0]).toMatchObject({ sessionId: 's1', level: 'quatrieme', subject: 'mathematiques', attachedFilesBlock: '<attached_file name="p">x</attached_file>' });
    expect(diagnose).toHaveBeenCalledTimes(1);
    expect(updateProgress).toHaveBeenCalledWith('ex-new', { hintLevel: 1, solved: false });
    expect(turn.exercise?.id).toBe('ex-new');
  });

  it('gives no contract without an exercise in progress, nor for one whose sheet failed', async () => {
    current = null;
    expect(await prepareExerciseTurn(params())).toEqual({ exercise: null, diagnosis: null, hintLevel: null, contract: null });

    current = state({ sheet: null });
    expect((await prepareExerciseTurn(params({ analysis: analysis({ proposesAnswer: true }) }))).contract).toBeNull();
    expect(diagnose).not.toHaveBeenCalled();
  });

  it('keeps no progress for an exercise that could not be stored', async () => {
    current = state({ id: null });
    await prepareExerciseTurn(params({ analysis: analysis({ proposesAnswer: true }) }));
    expect(updateProgress).not.toHaveBeenCalled();
  });
});
