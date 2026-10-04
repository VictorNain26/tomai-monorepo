import type { TurnAnalysis } from '../../modules/tutor/turn-analysis.service';

/** A turn analysis that reads nothing, with the given fields set. */
export function analysis(overrides: Partial<TurnAnalysis> = {}): TurnAnalysis {
  return { subject: 'general', bringsExercise: false, proposesAnswer: false, asksSolution: false, asksExplanation: false, wantsFlashcards: false, ...overrides };
}
