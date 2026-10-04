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
import type { StudentSubject } from './prompts/adaptation/subjects.js';

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
 * STEM subject families where reasoning helps the tutor produce better
 * explanations and checks. Typed against the intent classifier's taxonomy:
 * the chat turn's subject is one of those families, never a fine-grained slug.
 */
const STEM_SUBJECTS: ReadonlySet<string> = new Set<StudentSubject>([
  'mathematiques',
  'sciences',
]);

/** Student intents where extra reasoning genuinely helps. */
const HARD_INTENTS = new Set([
  'solve-this-for-me',
  'check-my-answer',
  'explain-concept',
]);

interface ReasoningRouteParams {
  schoolLevel: EducationLevelType;
  subject?: string | undefined;
  /** Output of intent-classifier. Optional; missing → "none". */
  intent?: string | undefined;
}

/**
 * Decide whether the next chat turn warrants `reasoning_effort: "high"`.
 *
 * Rule: a proposed answer always reasons; otherwise STEM subject AND college+ level AND a
 * known hard student intent, all three, or "none".
 * This avoids expensive thinking mode for casual chat in math class.
 */
export function routeReasoningEffort(params: ReasoningRouteParams): ReasoningEffort {
  const { schoolLevel, subject, intent } = params;
  // A verdict on the student's answer must be right, whatever the subject: the tutor has no
  // reference to check against until the exercise sheet exists.
  if (intent === 'check-my-answer') return 'high';
  if (!COLLEGE_AND_UP.has(schoolLevel)) return 'none';
  if (!subject || !STEM_SUBJECTS.has(subject)) return 'none';
  if (!intent || !HARD_INTENTS.has(intent)) return 'none';
  return 'high';
}
