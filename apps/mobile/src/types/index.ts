// Types locaux mobile

export type { EducationLevelType, CycleId, Lv2Option } from '@/constants/levels';
export type { SubjectMetadata } from '@/constants/subjects';

// Navigation types
export type RootStackParamList = {
  index: undefined;
  '(auth)/login': undefined;
  '(auth)/register': undefined;
  '(auth)/forgot-password': undefined;
  '(student)': undefined;
  '(parent)': undefined;
};

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
