/**
 * The fences that keep untrusted text, a student's message or an attached file, from reading as
 * instructions; and every tag of the prompt template, which such a text may not hold.
 */

const TAG_NAMES = [
  'student_message',
  'conversation_summary',
  'attached_file',
  'attachments',
  'critical_instruction',
  'tutor_message',
  'current_exercise',
  'exercise',
  'exercise_statement',
  'programme',
  'later_programme',
  'contrat',
  'fiche',
  'role',
  'student',
  'tone',
  'honesty',
  'pedagogy',
  'visualization',
  'response_format',
  'safety',
  'level_adaptation',
  'subject_specifics',
];

/** An opening or closing tag of the prompt, attributes included. */
export const PROMPT_TAG = new RegExp(`</?(?:${TAG_NAMES.join('|')})\\b[^>]*>`, 'i');
const PROMPT_TAGS = new RegExp(PROMPT_TAG.source, 'gi');

/**
 * The text without the prompt's tags, removed until removing one cannot join the text around it
 * into another: a forged `</safety>` would otherwise close a fence and read as an instruction.
 */
export function stripPromptTags(content: string): string {
  let stripped = content;
  for (let previous = ''; previous !== stripped;) {
    previous = stripped;
    stripped = stripped.replace(PROMPT_TAGS, '');
  }
  return stripped;
}

/** The text without NUL, the C0 controls and DEL: tabs and line breaks stay. */
export function sanitize(text: string): string {
  return Array.from(text)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code === 0x09 || code === 0x0a || code === 0x0d || (code >= 0x20 && code !== 0x7f);
    })
    .join('');
}

/** The student's message, fenced: an instruction inside is content to read, never an order. */
export function wrapUserMessage(content: string): string {
  return `<student_message>\n${stripPromptTags(content)}\n</student_message>`;
}

/**
 * Each attached file's text in its own fence, never inside the student's message, where
 * stripping the tags would remove the fence. Empty when no file has text.
 */
export function wrapAttachedFiles(files: readonly { fileName: string; text: string }[]): string {
  return files
    .filter((file) => file.text.trim())
    .map((file) => `<attached_file name="${stripPromptTags(file.fileName).replace(/"/g, '')}">\n${stripPromptTags(file.text)}\n</attached_file>`)
    .join('\n\n');
}
