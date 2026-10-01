import { z } from 'zod';
import type { EducationLevelType } from '../types/index.js';
import { schoolLevelEnum } from '../modules/auth/auth.schema.js';

/** The 12 French school levels (CP → terminale), read from the DB `school_level` enum. */
export const EDUCATION_LEVELS = schoolLevelEnum.enumValues;

const LEVEL_SET: ReadonlySet<string> = new Set(EDUCATION_LEVELS);

export function isEducationLevel(value: unknown): value is EducationLevelType {
  return typeof value === 'string' && LEVEL_SET.has(value);
}

export const educationLevelSchema = z.enum(EDUCATION_LEVELS);
