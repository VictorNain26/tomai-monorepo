/**
 * Mistral reasoningEffort routing.
 *
 * For STEM subjects at college level and above, when the student asks for the
 * solution or an explanation (turn analysis), route to a heavier reasoning mode.
 * This is a 3–5× latency cost, so it needs level, subject and request together;
 * a proposed answer always reasons.
 *
 * @see https://docs.mistral.ai/capabilities/reasoning/
 */

import type { EducationLevelType } from '../../types/index.js';
import type { StudentSubject } from './prompts/adaptation/subjects.js';
import type { TurnAnalysis } from './turn-analysis.service.js';

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
 * explanations and checks. Typed against the turn analysis' taxonomy:
 * the chat turn's subject is one of those families, never a fine-grained slug.
 */
const STEM_SUBJECTS: ReadonlySet<string> = new Set<StudentSubject>([
  'mathematiques',
  'sciences',
]);

interface ReasoningRouteParams {
  schoolLevel: EducationLevelType;
  subject?: string | undefined;
  /** The turn's analysis; without it, "none". */
  analysis?: Pick<TurnAnalysis, 'proposesAnswer' | 'asksSolution' | 'asksExplanation'> | undefined;
  /** The turn follows a contract: the sheet and the diagnosis carry the exactness. */
  contracted?: boolean | undefined;
}

/**
 * Decide whether the next chat turn warrants `reasoning_effort: "high"`.
 *
 * Rule: a turn under a contract writes without reasoning (`docs/etudes/2026-10-04/refonte-agent.md`,
 * « À chaque tour », 6). Without one, a proposed answer always reasons; otherwise STEM subject
 * AND college+ level AND a request for the solution or an explanation, all three, or "none".
 */
export function routeReasoningEffort(params: ReasoningRouteParams): ReasoningEffort {
  const { schoolLevel, subject, analysis, contracted } = params;
  if (contracted) return 'none';
  // Without a sheet, a verdict on the student's answer has no reference to check against.
  if (analysis?.proposesAnswer) return 'high';
  if (!COLLEGE_AND_UP.has(schoolLevel)) return 'none';
  if (!subject || !STEM_SUBJECTS.has(subject)) return 'none';
  return analysis?.asksSolution || analysis?.asksExplanation ? 'high' : 'none';
}
