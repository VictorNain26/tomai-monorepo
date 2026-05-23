/**
 * Mistral guardrails and output safety — CCA Sprint 1 safety.
 *
 * Structural defense layers:
 * 1. System prompt leak detector — scans for XML tags from the prompt template.
 * 2. Jailbreak patterns detector — detects simple attempts to escape constraints.
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

/**
 * Quick jailbreak heuristic — detects explicit attempts to make the model
 * ignore its constraints. This is NOT a full jailbreak detector (those are
 * hard), just a first-pass heuristic to log and monitor for abuse.
 *
 * Patterns:
 * - "ignore your instructions" / "forget your constraints"
 * - "you are actually [not a tutor]"
 * - "DAN: Do Anything Now" and variants
 */
export function detectJailbreakAttempt(content: string): boolean {
  const jailbreakPatterns = [
    /ignore\s+(?:your|the)\s+(?:instructions|constraints|rules|guidelines)/i,
    /forget\s+(?:your|the)\s+(?:instructions|constraints|rules|guidelines)/i,
    /you\s+(?:are|were)\s+actually\s+(?!a\s+tutor)/i,
    /\bDAN\b.*do\s+anything\s+now/i,
    /disregard\s+(?:your|the)\s+(?:instructions|constraints|rules|guidelines)/i,
  ];
  return jailbreakPatterns.some(pattern => pattern.test(content));
}
