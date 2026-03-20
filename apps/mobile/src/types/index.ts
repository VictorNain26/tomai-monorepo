// Types locaux mobile

export type { EducationLevelType } from '@/constants/levels';
export type { SubjectMetadata, SubjectColor } from '@/constants/subjects';

// Chat types - re-exported from useChat hook (source of truth)
export type {
  ChatMessage,
  AttachedFileInfo,
  ChatFileAttachment,
} from '@/hooks/useChat';

// Pronote types - re-exported from services (source of truth)
export type {
  PronoteHomework,
  PronoteGrade,
  PronoteTimetableEntry,
  PronoteResource,
  PronoteChatContext,
} from '@/services/pronote/pronote-types';
