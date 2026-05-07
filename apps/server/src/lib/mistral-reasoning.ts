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
 * Rule: STEM subject AND college+ level AND a *known* hard student intent
 * (solve / check / explain). All three axes must be present; missing any
 * one falls back to "none". Critically, intent missing or "unknown" also
 * falls back — we only escalate when the classifier explicitly signalled
 * problem-solving, otherwise every "bonjour" in 4ᵉ math would trigger the
 * 3–5× latency mode.
 */
export function routeReasoningEffort(params: ReasoningRouteParams): ReasoningEffort {
  const { schoolLevel, subject, intent } = params;
  if (!COLLEGE_AND_UP.has(schoolLevel)) return 'none';
  if (!subject || !STEM_SUBJECTS.has(subject)) return 'none';
  if (!intent || !HARD_INTENTS.has(intent)) return 'none';
  return 'high';
}

/**
 * Reasoning routing for card-generation calls — distinct from chat because
 * there is no "student intent" to classify (the user asked for a deck on a
 * specific topic). Use STEM-subject + college-level only: a Terminale
 * physique deck warrants the chain-of-thought for coherent distractors,
 * a CE1 français deck does not.
 */
export function routeCardReasoningEffort(params: {
  schoolLevel: EducationLevelType;
  subject?: string;
}): ReasoningEffort {
  const { schoolLevel, subject } = params;
  if (!COLLEGE_AND_UP.has(schoolLevel)) return 'none';
  if (!subject || !STEM_SUBJECTS.has(subject)) return 'none';
  return 'high';
}
