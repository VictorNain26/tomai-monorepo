/**
 * Who decides the learner memory (`docs/etudes/2026-10-07/memoire-entre-seances.md`, decisions):
 * before 15, the parent proposes it and the child accepts it, either one switching it off; from
 * 15, the child alone (loi Informatique et Libertés, art. 45).
 */

const SELF_CONSENT_AGE = 15;

export type MemoryAnswer = 'accepted' | 'declined';

/** off: nothing asked of the child; asked: the child may answer; active: Tom reads the memory. */
type MemoryState = 'off' | 'asked' | 'active';

export interface MemoryConsent {
  /** The month of birth, `YYYY-MM-DD` on its first day. */
  birthMonth: string;
  proposedAt: Date | null;
  answer: MemoryAnswer | null;
}

/**
 * The age in full years at `now`. The day of birth is not collected: the birthday is counted at the
 * end of its month, so that a child is never taken for older than they are.
 */
export function ageAt(birthMonth: string, now: Date): number {
  const [year = 0, month = 1] = birthMonth.split('-').map(Number);
  const age = now.getUTCFullYear() - year;
  return now.getUTCMonth() + 1 > month ? age : age - 1;
}

/** The state of the memory, whether the child may answer it, and whether they decide alone. */
export function memoryConsent({ birthMonth, proposedAt, answer }: MemoryConsent, now: Date) {
  const decidesAlone = ageAt(birthMonth, now) >= SELF_CONSENT_AGE;
  const mayAnswer = decidesAlone || proposedAt !== null;
  const state: MemoryState = !mayAnswer || answer === 'declined' ? 'off' : answer === 'accepted' ? 'active' : 'asked';
  return { state, mayAnswer, decidesAlone };
}
