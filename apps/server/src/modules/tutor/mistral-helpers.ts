/**
 * Mistral chat helpers.
 *
 * The following Gemini-era knobs have no Mistral equivalent and were dropped:
 * - ThinkingLevel       : Magistral reasoning quality is controlled by model
 *                         choice, not a config flag.
 * - HarmCategory        : content moderation is built-in to Mistral models,
 *                         no per-category threshold API.
 *
 * Keeps the genuinely useful helpers:
 * - MAX_TOOL_ITERATIONS  : same agentic loop bound (5 iterations).
 * - wrapUserMessage      : prompt-injection defence (delimiter wrap), still
 *                          necessary regardless of provider.
 * - getLearningContext   : turns the learning module's review signals into prompt text.
 */

import { learningService } from '../learning/index.js';
import { logger } from '../../platform/observability/logger.js';
import { PROMPT_TAG } from '../../lib/prompt-tags.js';

export const MAX_TOOL_ITERATIONS = 5;

/**
 * Every delimiter tag used by the prompt template (fences for untrusted content
 * AND system-prompt section tags). Stripped from any untrusted text so a forged
 * value cannot inject e.g. `</safety>` to escape its fence and have trailing
 * text read as a system instruction.
 */
const TEMPLATE_TAGS = new RegExp(PROMPT_TAG.source, 'gi');

/** Remove all template delimiter tags from untrusted content, until removing one cannot join the text around it into another. */
export function stripPromptTags(content: string): string {
  let stripped = content;
  for (let previous = ''; previous !== stripped;) {
    previous = stripped;
    stripped = stripped.replace(TEMPLATE_TAGS, '');
  }
  return stripped;
}

/**
 * Wrap a student message with structured delimiters so the model treats any
 * instruction-looking text inside as content to analyse, never as an order to
 * follow. Pairs with the INSTRUCTION_HIERARCHY block in the system prompt.
 */
export function wrapUserMessage(content: string): string {
  return `<student_message>\n${stripPromptTags(content)}\n</student_message>`;
}

/**
 * Wrap the student's cognitive profile + revision context as a delimited
 * user-turn block. The cognitive profile contains free-text observations the
 * model extracted from the student's own past messages, so it is untrusted —
 * it must never sit in the system prompt where it could read as an
 * instruction. Returns null when there is nothing to inject.
 */
export function wrapStudentContext(
  cognitiveProfileSummary?: string | null,
  learningContext?: string | null,
): string | null {
  const parts: string[] = [];
  if (cognitiveProfileSummary) {
    parts.push(`## PROFIL DE L'ÉLÈVE\n${cognitiveProfileSummary}`);
  }
  if (learningContext) {
    parts.push(learningContext);
  }
  if (parts.length === 0) return null;

  // Strip any literal delimiter tokens so a forged observation cannot break
  // out of the fence and have trailing text read as outside-the-block input.
  const body = stripPromptTags(parts.join('\n\n'));
  return `<student_context>\n${body}\n</student_context>`;
}

/**
 * Wrap each attached file's text as its own `<attached_file>` block. The text comes from the
 * student's file, so it is tag-stripped and fenced: it must never be concatenated into the
 * `<student_message>` (where stripPromptTags would remove the fence). Returns '' when empty.
 */
export function wrapAttachedFiles(files: readonly { fileName: string; text: string }[]): string {
  return files
    .filter((f) => f.text.trim())
    .map((f) => `<attached_file name="${stripPromptTags(f.fileName).replace(/"/g, '')}">\n${stripPromptTags(f.text)}\n</attached_file>`)
    .join('\n\n');
}

export async function getLearningContext(userId: string): Promise<string | null> {
  try {
    const { dueCount, weakSubjects } = await learningService.getReviewSignals(userId);

    if (dueCount === 0 && weakSubjects.length === 0) return null;

    let context = '## CONTEXTE RÉVISION\n';

    if (dueCount > 0) {
      context += `L'élève a ${dueCount} carte${dueCount > 1 ? 's' : ''} de révision en attente.\n`;
    }

    if (weakSubjects.length > 0) {
      const weakList = weakSubjects
        .map(s => `${s.subject} (${s.totalLapses} erreurs)`)
        .join(', ');
      context += `Sujets à renforcer : ${weakList}.\n`;
    }

    context += '→ Si le sujet de la conversation touche un de ces thèmes, propose des flashcards à la fin.';

    return context;
  } catch (err) {
    logger.warn('Failed to fetch learning context', {
      operation: 'chat:learning-context',
      err: err,
      userId,
    });
    return null;
  }
}
