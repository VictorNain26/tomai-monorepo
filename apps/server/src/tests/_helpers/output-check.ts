import type { OutputCheckContext } from '../../modules/tutor/output-check';

/** A turn without an exercise: nothing to compare to but the tags, the equalities and the moderation. */
export const noExercise: OutputCheckContext = { sheet: null, uncertain: false, diagnosis: null, studentText: '', pastStudentTexts: [] };
