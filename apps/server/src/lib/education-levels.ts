import type { EducationLevelType } from '../types/index.js';

/** Single source of truth for the 12 French school levels (CP → terminale). */
export const EDUCATION_LEVELS = [
  'cp', 'ce1', 'ce2', 'cm1', 'cm2',
  'sixieme', 'cinquieme', 'quatrieme', 'troisieme',
  'seconde', 'premiere', 'terminale',
] as const satisfies readonly EducationLevelType[];

const LEVEL_SET: ReadonlySet<string> = new Set(EDUCATION_LEVELS);

export function isEducationLevel(value: string): value is EducationLevelType {
  return LEVEL_SET.has(value);
}
