/**
 * Every tag of the tutor's prompt template. No text that reaches the student may hold one, nor
 * may an untrusted text the prompt fences (modules/tutor/core/fences.ts); the harness looks for
 * them in what the student reads.
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
