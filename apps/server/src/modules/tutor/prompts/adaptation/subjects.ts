export const STUDENT_SUBJECTS = [
  "mathematiques",
  "francais",
  "langues",
  "sciences",
  "histoire-geo",
  "general",
] as const;

export type StudentSubject = (typeof STUDENT_SUBJECTS)[number];
