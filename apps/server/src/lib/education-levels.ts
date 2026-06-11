import { t } from 'elysia';
import type { EducationLevelType } from '../types/index.js';

/** Single source of truth for the 12 French school levels (CP → terminale). */
export const EDUCATION_LEVELS = [
  'cp', 'ce1', 'ce2', 'cm1', 'cm2',
  'sixieme', 'cinquieme', 'quatrieme', 'troisieme',
  'seconde', 'premiere', 'terminale',
] as const satisfies readonly EducationLevelType[];

const LEVEL_SET: ReadonlySet<string> = new Set(EDUCATION_LEVELS);

// Compile-time guard: EDUCATION_LEVELS must list EVERY SchoolLevel. If the DB
// enum gains a level not added here, this fails to typecheck (the `satisfies`
// above only rejects *invalid* values; this rejects *missing* ones).
type AssertExtends<Superset, Subset extends Superset> = Subset;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _ExhaustiveLevels = AssertExtends<(typeof EDUCATION_LEVELS)[number], EducationLevelType>;

export function isEducationLevel(value: unknown): value is EducationLevelType {
  return typeof value === 'string' && LEVEL_SET.has(value);
}

// TypeBox schema for use in Elysia route definitions. Declared here so the
// literal tuple is statically typed — t.Union([...array.map(...)]) loses
// per-element inference and collapses to TLiteral<string>[] which breaks Eden
// Treaty type generation on the client side.
export const EDUCATION_LEVEL_UNION = t.Union([
  t.Literal('cp'), t.Literal('ce1'), t.Literal('ce2'),
  t.Literal('cm1'), t.Literal('cm2'),
  t.Literal('sixieme'), t.Literal('cinquieme'),
  t.Literal('quatrieme'), t.Literal('troisieme'),
  t.Literal('seconde'), t.Literal('premiere'), t.Literal('terminale'),
]);
