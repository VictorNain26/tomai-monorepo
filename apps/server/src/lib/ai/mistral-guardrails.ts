/**
 * Mistral guardrails and output safety — CCA Sprint 1 safety.
 *
 * System-prompt leak detector — scans accumulated streaming output for XML
 * tags from the prompt template. Input-side jailbreak defense is structural
 * (the <student_message> wrap + instruction hierarchy in the system prompt),
 * not a regex heuristic.
 */

/**
 * System-prompt leak detector — defense layer CCA D4 §10.
 *
 * The model is instructed never to reveal its system prompt. This detector
 * is the cheap structural check that runs on accumulated streaming output:
 * if we see XML tags from our prompt template, the prompt has leaked.
 *
 * Runs on the accumulated content (a tag split across chunks is still caught).
 * Returns the matched marker (for logging) or null if clean.
 */
const SYSTEM_PROMPT_LEAK_PATTERN =
  /<\/?(?:role|safety|rag_policy|pedagogy|student_message|student|past_sessions|critical_instruction|transparency|tone|level_adaptation|subject_specifics)>/i;

export function detectSystemPromptLeak(content: string): string | null {
  const m = content.match(SYSTEM_PROMPT_LEAK_PATTERN);
  return m ? m[0] : null;
}
