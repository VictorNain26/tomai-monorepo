/**
 * Every delimiter tag of the tutor's prompt template: fences for untrusted content and
 * system-prompt sections (`modules/tutor/prompts/`).
 */
const PROMPT_TAG_NAMES = [
  'student_message', 'conversation_summary', 'student_context', 'attached_file', 'attachments',
  'past_sessions', 'subject_memory', 'critical_instruction', 'tutor_message', 'exercise',
  'exercise_statement', 'programme', 'later_programme',
  'role', 'student', 'tone', 'honesty', 'pedagogy', 'visualization',
  'response_format', 'safety', 'level_adaptation', 'subject_specifics',
];

/** An opening or closing prompt tag, attributes included. */
export const PROMPT_TAG = new RegExp(`</?(?:${PROMPT_TAG_NAMES.join('|')})\\b[^>]*>`, 'i');
