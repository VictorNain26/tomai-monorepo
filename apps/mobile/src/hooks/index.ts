// Hooks - Export central

export { useChat, type ChatMessage, type ChatFileAttachment, type CreatedDeck } from './useChat';
export { useConversations, type Conversation } from './useConversations';
export { useNetworkStatus } from './useNetworkStatus';
export { useOfflineCache } from './useOfflineCache';
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
export { usePronote } from './usePronote';
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
  useThemeColors,
  type ThemeColors,
} from './useThemeColors';
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
