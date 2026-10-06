import { z } from 'zod';

/** The levels Tom serves in V1 (`docs/vision.md`), the collège. */
export const SCHOOL_LEVELS = ['sixieme', 'cinquieme', 'quatrieme', 'troisieme'] as const;

export type SchoolLevel = (typeof SCHOOL_LEVELS)[number];

export const schoolLevelSchema = z.enum(SCHOOL_LEVELS);
