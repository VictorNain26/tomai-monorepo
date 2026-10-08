/**
 * The cues Tom gives the parent beside their child, in 6e and 5e (`docs/decisions.md`, « Le mode
 * accompagné » ; `docs/etudes/2026-10-08/aide-parentale.md`, § 6 (c)). Fixed sentences the code
 * picks, never a word of the model: a cue cannot carry the exercise nor its answer. The parent
 * listens and lets the child search; the child reads them too.
 */

/** A session gives the parent four cues at most: past them, help turns into pressure. */
export const MAX_PARENT_CUES = 4;

/** What the turn did, as the cues read it. */
export interface CueTurn {
  first: boolean;
  newExercise: boolean;
  /** The help climbed a step: the child is stuck. */
  levelUp: boolean;
  solved: boolean;
  /** The child asked for the answer or said they don't know. */
  frustrated: boolean;
}

// The child's name keeps them epicene; vous, twenty words at most, nothing to know of the subject.
export const PARENT_CUES = {
  launch: (name: string) => `Ce soir, votre rôle auprès de ${name} : écouter et poser des questions. Les explications, c’est Tom.`,
  newExercise: (name: string) => `Avant de chercher, demandez à ${name} de redire la question avec ses mots.`,
  block: (name: string) => `Demandez à ${name} ce qui est déjà trouvé, et où ça coince. Pas besoin de connaître la réponse.`,
  frustration: (name: string) => `Une erreur de ${name}, c’est normal. Plutôt que corriger, dites : « on regarde cette étape ensemble ».`,
  end: (name: string) => `Demandez à ${name} de vous réexpliquer en une phrase comment l’exercice a été résolu.`,
};

/** The cue of the turn, one at most: the launch first, then the end, a block, a frustration, a new exercise. */
export function parentCue(turn: CueTurn, shown: number, name: string): string | null {
  if (shown >= MAX_PARENT_CUES) return null;
  if (turn.first) return PARENT_CUES.launch(name);
  if (turn.solved) return PARENT_CUES.end(name);
  if (turn.levelUp) return PARENT_CUES.block(name);
  if (turn.frustrated) return PARENT_CUES.frustration(name);
  if (turn.newExercise) return PARENT_CUES.newExercise(name);
  return null;
}
