/**
 * Types Index - Barrel exports pour tous les types Tom
 *
 * Structure modulaire :
 * - education.types.ts : Niveaux scolaires, matières, AI relevance
 * - user.types.ts : Utilisateurs, sessions Better Auth
 * - session.types.ts : Sessions d'étude, progression
 * - parent.types.ts : LV2, enfants, métriques parent
 * - forms.types.ts : Props de composants, formulaires
 * - file.types.ts : Upload et gestion de fichiers
 * - voice.types.ts : Audio et Text-to-Speech
 * - subscription.types.ts : Stripe, facturation, usage tokens
 * - learning.types.ts : Outils de révision (13 types de cartes)
 */

// Education types
export type {
  EducationLevelType,
  AIRelevanceLevel,
  AIRelevanceData,
  EducationSubject,
  SubjectsAPIResponse,
  AICategorizedSubjects,
  ValidationResult,
  RagLevel,
} from './education.types';

// User types
export type {
  UserRoleType,
  AccountTypeType,
  IAppUser,
  ITomUser,
  ITomSession,
  IRegisterData,
} from './user.types';
export { isITomUser } from './user.types';

// Session types
export type {
  ISessionResponse,
  SessionStatus,
  IStudySession,
  IProgress,
  ISubjectProgress,
  ICostTracking,
  IProgressData,
  IDashboardStats,
  ISessionsResponse,
} from './session.types';

// Parent types
export type {
  Lv2Option,
  IChild,
  IMetrics,
  IGlobalMetrics,
  IUpdateChildRequest,
  IChildResponse,
  IDeleteChildResponse,
  IChildrenResponse,
  IMetricsResponse,
  IProgressResponse,
  ICreateChildData,
  IUpdateChildData,
} from './parent.types';
export { LV2_ELIGIBLE_LEVELS, isLv2EligibleLevel } from './parent.types';

// Forms types
export type {
  IApiResponse,
  IProtectedRouteProps,
  ILayoutProps,
  ISubjectCardProps,
  ILoginFormData,
  IInputFieldProps,
  IRegisterFormData,
} from './forms.types';

// File types
export type {
  FileType,
  IFileAttachment,
  IFileUploadResult,
  IFileProcessingOptions,
} from './file.types';

// Voice types
export type {
  VoiceMode,
  IVoiceState,
  ITextToSpeechState,
} from './voice.types';

// Subscription types
export type {
  SubscriptionPlanType,
  BillingStatusType,
  ISubscriptionPlan,
  IPricingInfo,
  IChildSubscriptionStatus,
  ISubscriptionStatus,
  ICheckoutResponse,
  IPortalResponse,
  ICancelSubscriptionResponse,
  IManageChildrenResponse,
  IResumeSubscriptionResponse,
  ITokenUsage,
  IWindowUsage,
  IDailyUsage,
  IWeeklyUsage,
  ILifetimeUsage,
  IUsageResponse,
  ISubjectsForStudent,
  ISubjectsResponse,
} from './subscription.types';

// Learning types
export type {
  CardType,
  DeckSource,
  // Pedagogical
  IConceptContent,
  // Universal
  IFlashcardContent,
  IQCMContent,
  IVraiFauxContent,
  IMatchingContent,
  IFillBlankContent,
  IWordOrderContent,
  ICalculationContent,
  ITimelineContent,
  IMatchingEraContent,
  ICauseEffectContent,
  IClassificationContent,
  IProcessOrderContent,
  IGrammarTransformContent,
  CardContent,
  ILearningCard,
  ILearningDeck,
  ILearningDeckWithCards,
  ICreateDeckRequest,
  ICreateCardRequest,
  IDecksResponse,
  IDeckResponse,
  IDeckWithCardsResponse,
  ICardsResponse,
  ICardResponse,
  IGenerateDeckRequest,
  IGenerateDeckResponse,
} from './learning.types';
