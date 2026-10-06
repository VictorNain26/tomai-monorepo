import { z } from 'zod';
import type { EducationLevelType } from '../types/index.js';

/** The levels Tom serves in V1 (`docs/vision.md`), the collège; the DB `school_level` enum is built from it. */
export const EDUCATION_LEVELS = ['sixieme', 'cinquieme', 'quatrieme', 'troisieme'] as const;

const LEVEL_SET: ReadonlySet<string> = new Set(EDUCATION_LEVELS);

export function isEducationLevel(value: unknown): value is EducationLevelType {
  return typeof value === 'string' && LEVEL_SET.has(value);
}

export const educationLevelSchema = z.enum(EDUCATION_LEVELS);

const LEVEL_LABELS: Record<EducationLevelType, string> = {
  sixieme: '6ème (11 ans)',
  cinquieme: '5ème (12 ans)',
  quatrieme: '4ème (13 ans)',
  troisieme: '3ème (14 ans)',
};

export function levelLabel(level: EducationLevelType): string {
  return LEVEL_LABELS[level];
}

/** The class as a teacher writes it, for the exercise sheet and the judge. */
export const LEVEL_SHORT_LABELS: Record<EducationLevelType, string> = {
  sixieme: '6e',
  cinquieme: '5e',
  quatrieme: '4e',
  troisieme: '3e',
};
