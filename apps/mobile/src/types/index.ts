// Types locaux mobile

export type { EducationLevelType } from '@/constants/levels';
export type { SubjectMetadata } from '@/constants/subjects';

// Chat types - re-exported from useChat hook (source of truth)
export type {
  ChatMessage,
  AttachedFileInfo,
  ChatFileAttachment,
} from '@/hooks/useChat';

// Pronote types - re-exported from hooks (source of truth)
export type {
  PronoteHomework,
  PronoteGrade,
  PronoteTimetableEntry,
  ParentConnectionStatus,
  ChildMapping,
  PronoteResource,
} from '@/hooks/useParentPronote';

export type {
  StudentPronoteStatus,
} from '@/hooks/useStudentPronote';
