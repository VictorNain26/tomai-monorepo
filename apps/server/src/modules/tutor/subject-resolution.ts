import type { SubjectFamily } from '../../lib/subjects.js';

function isReal(family?: SubjectFamily | null): family is Exclude<SubjectFamily, 'general'> {
  return Boolean(family && family !== 'general');
}

/**
 * Matière effective pour le tour courant : la matière détectée si confiante
 * (≠ 'general'), sinon la matière déjà posée sur la session, sinon le hint client.
 */
export function resolveEffectiveSubject(opts: {
  detected?: SubjectFamily | undefined;
  sessionSubject?: SubjectFamily | null | undefined;
  requested?: SubjectFamily | undefined;
}): SubjectFamily | undefined {
  if (isReal(opts.detected)) return opts.detected;
  if (isReal(opts.sessionSubject)) return opts.sessionSubject;
  return opts.requested;
}

/**
 * Anti-thrash : on ne persiste la matière détectée que si elle est réelle ET que
 * la session est encore sur le défaut ('general') — première détection confiante.
 */
export function shouldPersistDetectedSubject(opts: {
  detected?: SubjectFamily;
  sessionSubject?: SubjectFamily | null;
}): boolean {
  return isReal(opts.detected) && !isReal(opts.sessionSubject);
}
