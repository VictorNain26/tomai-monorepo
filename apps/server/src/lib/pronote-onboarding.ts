/**
 * Pronote onboarding helpers — pure functions, no I/O.
 *
 * Used by pronoteConnectService.discover() to enrich raw Pronote resources
 * with name split, school level inference, and dedup against existing children.
 */

import type { SchoolLevel } from '../db/schema.js';

// ============================================
// splitName
// ============================================

/**
 * Split a Pronote full name (format "Prénom NOM") into firstName and lastName.
 * Heuristic: first whitespace-separated token = firstName, rest = lastName.
 */
export function splitName(fullName: string): { firstName: string; lastName: string } {
  const tokens = fullName.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { firstName: '', lastName: '' };
  const [first, ...rest] = tokens;
  return { firstName: first!, lastName: rest.join(' ') };
}

// ============================================
// inferSchoolLevel
// ============================================

/** Normalize a string: lowercase + remove diacritics. */
function normalizeStr(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Infer a SchoolLevel from a Pronote class name (best-effort, case-insensitive).
 * Returns null if the className is null or unrecognized.
 */
export function inferSchoolLevel(className: string | null): SchoolLevel | null {
  if (className === null) return null;

  const n = normalizeStr(className.trim());

  // Primary — exact prefix match (all are standalone tokens at word boundary)
  if (/\bcm2\b/.test(n)) return 'cm2';
  if (/\bcm1\b/.test(n)) return 'cm1';
  if (/\bce2\b/.test(n)) return 'ce2';
  if (/\bce1\b/.test(n)) return 'ce1';
  if (/\bcp\b/.test(n)) return 'cp';

  // Collège — word boundary on BOTH sides to avoid false positives like "A3e", "L3e"
  // Note: "3EME1" normalizes to "3eme1" — \b3eme has left boundary, no right boundary needed
  if (/\btroisieme\b/.test(n)) return 'troisieme';
  if (/\b3eme/.test(n)) return 'troisieme';
  if (/\b3e\b/.test(n)) return 'troisieme';
  if (/3°/.test(n)) return 'troisieme';

  if (/\bquatrieme\b/.test(n)) return 'quatrieme';
  if (/\b4eme/.test(n)) return 'quatrieme';
  if (/\b4e\b/.test(n)) return 'quatrieme';
  if (/4°/.test(n)) return 'quatrieme';

  if (/\bcinquieme\b/.test(n)) return 'cinquieme';
  if (/\b5eme/.test(n)) return 'cinquieme';
  if (/\b5e\b/.test(n)) return 'cinquieme';
  if (/5°/.test(n)) return 'cinquieme';

  if (/\bsixieme\b/.test(n)) return 'sixieme';
  if (/\b6eme/.test(n)) return 'sixieme';
  if (/\b6e\b/.test(n)) return 'sixieme';
  if (/6°/.test(n)) return 'sixieme';

  // Seconde — "2NDE3" normalizes to "2nde3" (no word boundary after "nde")
  if (/\bseconde\b/.test(n)) return 'seconde';
  if (/\b2nde/.test(n)) return 'seconde';
  if (/\b2de\b/.test(n)) return 'seconde';
  if (/\b2nd\b/.test(n)) return 'seconde';

  // Première — before terminale to avoid T-prefix heuristic capturing "T1ERE"
  // No left boundary on 1ere/1re: "T1ERE" is a real Pronote form meaning première
  if (/\bpremiere\b/.test(n)) return 'premiere';
  if (/1ere\b/.test(n)) return 'premiere';
  if (/1re\b/.test(n)) return 'premiere';
  // "1ère" normalizes to "1ere" already handled above

  // Terminale — named forms first, then series codes (TS/TES/TL/TG/TMD/TSTMG…)
  if (/\bterminale\b/.test(n)) return 'terminale';
  if (/\bterm\b/.test(n)) return 'terminale';
  if (/\btle\b/.test(n)) return 'terminale';
  if (/\btale\b/.test(n)) return 'terminale';
  // Series codes: T followed by s/e/l/g/m/d (TS, TES, TL, TG, TMD, TSTMG…)
  // Deliberately excludes generic tokens like "ta", "tb", etc.
  if (/\bt[seglmd]/i.test(n)) return 'terminale';

  return null;
}

// ============================================
// matchExistingChild
// ============================================

/** Normalize a name for comparison: lowercase, no diacritics, compact spaces, trim. */
function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find an existing child whose full name matches the Pronote resource name.
 * Comparison is case-insensitive and diacritic-insensitive.
 * Returns the child id on the first match, null if none.
 */
export function matchExistingChild(
  resourceName: string,
  existingChildren: { id: string; firstName: string | null; lastName: string | null }[],
): string | null {
  const normalizedResource = normalizeName(resourceName);

  for (const child of existingChildren) {
    const fullName = `${child.firstName ?? ''} ${child.lastName ?? ''}`;
    if (normalizeName(fullName) === normalizedResource) {
      return child.id;
    }
  }

  return null;
}
