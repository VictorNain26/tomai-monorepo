/**
 * The tutor's message, written then checked before the student reads it (`output-check.ts`): on a
 * failed check, one regeneration told what was held back, then a fixed reply. A text moderation
 * could not check is never regenerated, which would only go unchecked again. The whole text is
 * held anyway: the model writes it in one call, and the turn sends what passed.
 */

import type { ModelMessage } from 'ai';
import type { Logger } from 'pino';
import type { Ai, ResponseMessage } from '../../../platform/ai/client';
import type { Moderation } from '../../../platform/ai/moderation';
import { checkReply, FALLBACK_REPLY, regenerationInstruction, type Finding, type OutputCheckContext } from './output-check';

// Small 4's model card: 0.7 for reasoning_effort="high", within its range for "none".
const TEMPERATURE = 0.7;
// A reply is short (the pedagogy asks for one or two sentences); a reasoning turn has no cap, its timeout bounds it.
const MAX_OUTPUT_TOKENS = 1024;

export interface WriterCall {
  studentId: string;
  /** The session: Mistral's prompt cache key, each turn resending the same prefix. */
  sessionId: string;
  system: string;
  /** The turn's messages, an instruction for the regeneration added to the last one. */
  messages: (extra: string | null) => ModelMessage[];
  reasoningEffort: 'none' | 'high';
}

export interface CheckedReply {
  /** What the student reads, and what is stored. */
  text: string;
  /** What the check held back from the first text; empty when it passed. */
  findings: Finding[];
  outcome: 'passed' | 'regenerated' | 'fallback';
  /** The turn as the next ones replay it. */
  replay: ResponseMessage[];
}

const asText = (text: string): ResponseMessage[] => [{ role: 'assistant', content: [{ type: 'text', text }] }];

export async function writeChecked(
  deps: { ai: Ai; moderation: Moderation; logger: Logger },
  call: WriterCall,
  check: OutputCheckContext,
): Promise<CheckedReply> {
  const write = (extra: string | null) =>
    deps.ai.generateText({
      operation: 'chat',
      owner: { studentId: call.studentId },
      system: call.system,
      messages: call.messages(extra),
      temperature: TEMPERATURE,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      promptCacheKey: call.sessionId,
      reasoningEffort: call.reasoningEffort,
    });

  const first = await write(null);
  // An empty text has nothing to check, and nothing to show: it goes to the fixed reply.
  const findings = first.text.trim() ? await checkReply(deps, first.text, check) : [];
  if (first.text.trim() && findings.length === 0) return { text: first.text, findings, outcome: 'passed', replay: first.responseMessages };

  const unmoderated = findings.some((finding) => finding.kind === 'unmoderated');
  const second = first.text.trim() && !unmoderated ? await write(regenerationInstruction(findings)) : null;
  const passed = second !== null && second.text.trim() !== '' && (await checkReply(deps, second.text, check)).length === 0;
  const outcome = passed ? 'regenerated' : 'fallback';
  deps.logger.warn({ findings: findings.map((finding) => finding.kind), outcome, unmoderated }, 'Tutor message held back by the check');
  return passed
    ? { text: second.text, findings, outcome, replay: second.responseMessages }
    : { text: FALLBACK_REPLY, findings, outcome, replay: asText(FALLBACK_REPLY) };
}
