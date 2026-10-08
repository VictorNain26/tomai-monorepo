/** The collège subjects, named once for the referential, the evaluation set and the tutor (`docs/tuteur.md`, § 3). */
export const SUBJECT_SLUGS = [
  'mathematiques',
  'francais',
  'anglais',
  'espagnol',
  'allemand',
  'italien',
  'histoire-geo',
  'physique-chimie',
  'svt',
  'technologie',
] as const;

export type SubjectSlug = (typeof SUBJECT_SLUGS)[number];

/**
 * The families the tutor's instructions group the subjects into; the turn analysis picks one,
 * `general` when the message is off subject or cannot tell.
 */
export const SUBJECT_FAMILIES = ['mathematiques', 'francais', 'langues', 'sciences', 'histoire-geo', 'general'] as const;

export type SubjectFamily = (typeof SUBJECT_FAMILIES)[number];
