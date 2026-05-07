/**
 * Mistral reasoningEffort routing.
 *
 * `reasoning_effort` is exposed on `mistral-small-latest` and
 * `mistral-medium-3-5` since SDK v2 (2026). The two documented values are
 * `"high"` (full thinking chunk before the answer) and `"none"` (minimal,
 * thinking chunk omitted). High mode multiplies time-to-first-token by
 * roughly 3–5× and the output token count grows accordingly.
 *
 * @see https://docs.mistral.ai/capabilities/reasoning/adjustable/
 *
 * For Tom we route per turn: heavy thinking is reserved for actual
 * problem-solving (math/physics/CS/biology, college level and up, plus
 * the student-intent that signals they're stuck on an exercise). Every
 * other turn — chit-chat, concept explanation in primary school,
 * background summarization, auto-titles, intent classification — runs on
 * `"none"` so latency stays in the conversational range.
 */

import type { EducationLevelType } from '../types/education.types.js';

export type ReasoningEffort = 'none' | 'high';

/** School levels where abstract reasoning becomes worth the latency cost. */
const COLLEGE_AND_UP: ReadonlySet<EducationLevelType> = new Set<EducationLevelType>([
  'quatrieme',
  'troisieme',
  'seconde',
  'premiere',
  'terminale',
]);

/**
 * STEM-heavy subjects: math, physics-chemistry, biology, technology, CS.
 * The normalisation matches `normalizeSubject` output used elsewhere in
 * the prompt builder.
 */
const STEM_SUBJECTS: ReadonlySet<string> = new Set<string>([
  'mathematiques',
  'physique-chimie',
  'svt',
  'technologie',
  'nsi',
]);

/** Student intents where extra reasoning genuinely helps the tutor. */
const HARD_INTENTS = new Set([
  'solve-this-for-me',
  'check-my-answer',
  'explain-concept',
]);

export interface ReasoningRouteParams {
  schoolLevel: EducationLevelType;
  subject?: string;
  /** Output of intent-classifier. Optional; absent → treated as low-stakes. */
  intent?: string;
}

/**
 * Decide whether the next chat turn warrants `reasoning_effort: "high"`.
 *
 * The rule: STEM subject AND college level or higher AND a student intent
 * that signals real problem-solving. Any axis missing → "none". Keeps
 * primary-school turns fast and reserves the expensive mode for the cases
 * where a structured chain-of-thought actually changes the answer.
 */
export function routeReasoningEffort(params: ReasoningRouteParams): ReasoningEffort {
  const { schoolLevel, subject, intent } = params;
  if (!COLLEGE_AND_UP.has(schoolLevel)) return 'none';
  if (!subject || !STEM_SUBJECTS.has(subject)) return 'none';
  if (intent && !HARD_INTENTS.has(intent)) return 'none';
  return 'high';
}
