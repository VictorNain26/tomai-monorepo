/** The collège subjects, named once for the referential, the evaluation set and the tutor (`docs/tuteur.md`, § 4). */
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
