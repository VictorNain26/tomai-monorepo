/**
 * Chat helpers: the agentic loop's bound, and the fences that keep untrusted text (the student's
 * message, an attached file) from reading as instructions.
 */

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
