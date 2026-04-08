import type { EducationLevelType } from '@/constants/levels';

const LEVEL_PATTERNS: [RegExp, EducationLevelType][] = [
  [/\bCP\b/i, 'cp'],
  [/\bCE1\b/i, 'ce1'],
  [/\bCE2\b/i, 'ce2'],
  [/\bCM1\b/i, 'cm1'],
  [/\bCM2\b/i, 'cm2'],
  [/\b6[eè]me?\b/i, 'sixieme'],
  [/\b5[eè]me?\b/i, 'cinquieme'],
  [/\b4[eè]me?\b/i, 'quatrieme'],
  [/\b3[eè]me?\b/i, 'troisieme'],
  [/\b2n?de?\b/i, 'seconde'],
  [/\b1[eè]re?\b/i, 'premiere'],
  [/\bT(er)?m?(inale)?\b/i, 'terminale'],
];

export function inferSchoolLevel(className: string): EducationLevelType | null {
  for (const [pattern, level] of LEVEL_PATTERNS) {
    if (pattern.test(className)) return level;
  }
  return null;
}
