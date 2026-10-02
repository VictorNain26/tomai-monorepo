import { z } from 'zod';
import type { EducationLevelType } from '../types/index.js';

/** The 12 French school levels (CP → terminale); the DB `school_level` enum is built from it. */
export const EDUCATION_LEVELS = [
  'cp', 'ce1', 'ce2', 'cm1', 'cm2',
  'sixieme', 'cinquieme', 'quatrieme', 'troisieme',
  'seconde', 'premiere', 'terminale',
] as const;

const LEVEL_SET: ReadonlySet<string> = new Set(EDUCATION_LEVELS);

export function isEducationLevel(value: unknown): value is EducationLevelType {
  return typeof value === 'string' && LEVEL_SET.has(value);
}

export const educationLevelSchema = z.enum(EDUCATION_LEVELS);
