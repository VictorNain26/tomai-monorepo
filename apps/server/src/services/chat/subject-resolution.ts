import type { StudentSubject } from '../../config/prompts/adaptation/subjects.js';

/** Valeur par défaut posée à la création d'une session (study-sessions.repository create). */
const DEFAULT_SESSION_SUBJECT = 'général';

function isReal(detected?: StudentSubject): detected is Exclude<StudentSubject, 'general'> {
  return Boolean(detected && detected !== 'general');
}

/**
 * Matière effective pour le tour courant : la matière détectée si confiante
 * (≠ 'general'), sinon la matière déjà posée sur la session, sinon le hint client.
 */
export function resolveEffectiveSubject(opts: {
  detected?: StudentSubject;
  sessionSubject?: string | null;
  requested?: string;
}): string | undefined {
  if (isReal(opts.detected)) return opts.detected;
  if (opts.sessionSubject && opts.sessionSubject !== DEFAULT_SESSION_SUBJECT) return opts.sessionSubject;
  return opts.requested ?? undefined;
}

/**
 * Anti-thrash : on ne persiste la matière détectée que si elle est réelle ET que
 * la session est encore sur le défaut ('général') — première détection confiante.
 */
export function shouldPersistDetectedSubject(opts: {
  detected?: StudentSubject;
  sessionSubject?: string | null;
}): boolean {
  return isReal(opts.detected) && (!opts.sessionSubject || opts.sessionSubject === DEFAULT_SESSION_SUBJECT);
}
