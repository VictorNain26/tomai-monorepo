import { z } from 'zod';

/** The levels Tom serves in V1 (`docs/vision.md`), the collège. */
export const SCHOOL_LEVELS = ['sixieme', 'cinquieme', 'quatrieme', 'troisieme'] as const;

export type SchoolLevel = (typeof SCHOOL_LEVELS)[number];

export const schoolLevelSchema = z.enum(SCHOOL_LEVELS);

/** The class as a teacher writes it, for the exercise sheet. */
export const LEVEL_SHORT_LABELS: Record<SchoolLevel, string> = {
  sixieme: '6e',
  cinquieme: '5e',
  quatrieme: '4e',
  troisieme: '3e',
};
