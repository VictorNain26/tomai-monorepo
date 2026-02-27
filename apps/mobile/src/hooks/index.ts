// Hooks - Export central

export { useChat, type ChatMessage, type ChatFileAttachment, type CreatedDeck } from './useChat';
export {
  usePresignedUpload,
  type FileAttachment,
  type FileType,
} from './usePresignedUpload';
export {
  useStudentDashboard,
  type TokenUsage,
} from './useStudentDashboard';
export {
  useLearning,
  useDecks,
  useDeck,
  useDeleteDeck,
  useCreateDeck,
  useLearningSubjects,
  useLearningTopics,
  type LearningDeck,
  type LearningCard,
  type CardType,
  type CreateDeckRequest,
  type LearningSubject,
  type LearningDomaine,
} from './useLearning';
export {
  useParentDashboard,
  type IChild,
  type ICreateChildData,
  type SchoolLevel,
  type EducationLevelType,
} from './useParentDashboard';
export {
  useParentPronoteStatus,
  useChildMappings,
  useConnectPronote,
  useDisconnectPronote,
  useChildHomework,
  useChildGrades,
  useChildTimetable,
  useChildPronote,
  type ParentConnectionStatus,
  type ChildMapping,
  type PronoteHomework,
  type PronoteGrade,
  type PronoteTimetableEntry,
} from './useParentPronote';
export {
  useStudentPronoteStatus,
  useStudentHomework,
  useStudentGrades,
  useStudentTimetable,
  useStudentPronote,
  type StudentPronoteStatus,
  type PronoteHomework as StudentPronoteHomework,
  type PronoteGrade as StudentPronoteGrade,
  type PronoteTimetableEntry as StudentPronoteTimetableEntry,
} from './useStudentPronote';
export {
  useTheme,
  type ThemeMode,
  type ColorScheme,
} from './useTheme';
export {
  useSubscription,
  useIsPro,
  type SubscriptionState,
  type SubscriptionActions,
} from './useSubscription';
export {
  useVoiceInput,
  type VoiceInputState,
} from './useVoiceInput';
export {
  useTextToSpeech,
  type TextToSpeechState,
  type TTSOptions,
} from './useTextToSpeech';
export {
  useFileShare,
  type FileShareState,
} from './useFileShare';
export {
  useChildTokenUsage,
  type ChildWindowUsage,
  type ChildWeeklyUsage,
} from './useChildTokenUsage';
export {
  useIconColors,
  type IconColors,
} from './useIconColors';
export {
  useDueCards,
  useReviewCard,
  useDeckStats,
  type FSRSRating,
  type FSRSState,
  type DueCard,
  type ReviewResult,
  type DeckStats,
} from './useFsrs';
export { useDueSummary } from './useDueSummary';
export {
  useUserFiles,
  useSessionFiles,
  useAttachFile,
  useDetachFile,
  type LibraryFile,
  type SessionFile,
} from './useFiles';
