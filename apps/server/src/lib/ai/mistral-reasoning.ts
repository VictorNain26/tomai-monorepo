/**
 * Mistral reasoningEffort routing.
 *
 * For STEM subjects at college level and above, when the student signals
 * they're actively problem-solving (via intent classification), route to
 * a heavier reasoning mode. This is a 3–5× latency cost, so we only
 * activate when all three signals align: level, subject, and explicit intent.
 *
 * @see https://docs.mistral.ai/capabilities/reasoning/
 */

import type { EducationLevelType } from '../../types/index.js';

type ReasoningEffort = 'none' | 'high';

/** School levels where abstract reasoning becomes worth the latency cost. */
const COLLEGE_AND_UP: ReadonlySet<EducationLevelType> = new Set<EducationLevelType>([
  'quatrieme',
  'troisieme',
  'seconde',
  'premiere',
  'terminale',
]);

/**
 * STEM-heavy subjects where reasoning helps the tutor produce better
 * explanations and checks. Math, physics-chemistry, biology, technology, CS.
 */
const STEM_SUBJECTS: ReadonlySet<string> = new Set<string>([
  'mathematiques',
  'physique-chimie',
  'svt',
  'technologie',
  'nsi',
]);

/** Student intents where extra reasoning genuinely helps. */
const HARD_INTENTS = new Set([
  'solve-this-for-me',
  'check-my-answer',
  'explain-concept',
]);

interface ReasoningRouteParams {
  schoolLevel: EducationLevelType;
  subject?: string;
  /** Output of intent-classifier. Optional; missing → "none". */
  intent?: string;
}

/**
 * Decide whether the next chat turn warrants `reasoning_effort: "high"`.
 *
 * Rule: STEM subject AND college+ level AND a known hard student intent.
 * All three must align; missing any one falls back to "none".
 * This avoids expensive thinking mode for casual chat in math class.
 */
export function routeReasoningEffort(params: ReasoningRouteParams): ReasoningEffort {
  const { schoolLevel, subject, intent } = params;
  if (!COLLEGE_AND_UP.has(schoolLevel)) return 'none';
  if (!subject || !STEM_SUBJECTS.has(subject)) return 'none';
  if (!intent || !HARD_INTENTS.has(intent)) return 'none';
  return 'high';
}
