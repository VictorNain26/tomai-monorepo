import type { ComponentType, ReactNode } from 'react';

// ✅ UNIFIÉ avec backend - Source de vérité unique
export type EducationLevelType =
  | 'cp' | 'ce1' | 'ce2' | 'cm1' | 'cm2'
  | 'sixieme' | 'cinquieme' | 'quatrieme' | 'troisieme'
  | 'seconde' | 'premiere' | 'terminale';

// ✅ UNIFIÉ - Aliases SUPPRIMÉS, utiliser EducationLevelType uniquement
// AI Relevance types for educational subjects
export type AIRelevanceLevel = 'high' | 'medium' | 'limited' | 'excluded';

export interface AIRelevanceData {
  level: AIRelevanceLevel;
  efficacyScore: number; // 0-100, based on research
  officialSupport: boolean; // Official MEN support
  limitations?: string[];
  strengths?: string[];
  recommendedUsage: string;
}

// ✅ UNIFIÉ avec backend - Interface unique matières scolaires
export interface EducationSubject {
  key: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  ragKeywords: string[];
  availableIn?: EducationLevelType[];
  combinableWith?: string[];
  aiRelevance?: AIRelevanceData;
  // 🌍 Support langues vivantes - BCP 47 language tag pour TTS multilingue
  ttsLanguage?: string; // ex: "en-US", "es-ES", "de-DE", "it-IT", "zh-CN"
}

// ✅ UNIFIÉ - Alias SUPPRIMÉ, utiliser EducationSubject uniquement

// ✅ UNIFIÉ - Structure API matières simplifiée
export interface SubjectsAPIResponse {
  success: boolean;
  level: EducationLevelType;
  subjects: EducationSubject[];
}

// ✅ UNIFIÉ - Catégorisation AI conforme educationService
export interface AICategorizedSubjects {
  recommended: EducationSubject[]; // High relevance (efficacy ≥85%)
  specialized: EducationSubject[];  // Medium relevance (efficacy 70-84%)
  limited: EducationSubject[];      // Limited relevance (efficacy <70%)
  metadata: {
    totalSubjects: number;
    researchBased: boolean;
    lastUpdated: string;
    source: string;
  };
}

// ✅ UNIFIÉ - Interface validation pour educationService
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// User role types consistent with backend (Better Auth + Tom)
export type UserRoleType = 'student' | 'parent' | 'admin';

// Account type for registration/login forms
export type AccountTypeType = 'student' | 'parent';

// Tom User interface - Single source of truth compatible avec Better Auth
export interface IAppUser {
  id: string;
  name: string;
  email: string;
  image?: string | null | undefined;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Tom fields - optionnels pour compatibilité Better Auth
  role?: UserRoleType;
  firstName?: string;
  lastName?: string;
  username?: string;
  schoolLevel?: EducationLevelType;
  dateOfBirth?: string;
}

// Type alias for backward compatibility
export type ITomUser = IAppUser;

// Type guard simplifié
export function isITomUser(user: IAppUser | null): user is IAppUser {
  return user !== null && 'role' in user && user.role !== undefined;
}

// Better Auth session interface
export interface ITomSession {
  user: IAppUser;
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    token: string;
    createdAt: Date;
    updatedAt: Date;
    ipAddress?: string;
    userAgent?: string;
  };
}

// Registration data interface
export interface IRegisterData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  role: 'parent' | 'student';
}

// Message types
export interface IMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: string;
  sessionId?: string;
  isPartial?: boolean;
  // État du message
  status?: 'typing' | 'streaming' | 'complete';
  frustrationLevel?: number;
  concept?: string;
  aiModel?: string;
  isFallback?: boolean;
  tokensUsed?: number;
  estimatedCost?: number;
  // Fichier attaché
  attachedFile?: {
    fileName: string;
    fileId?: string;
    geminiFileId?: string;
    mimeType?: string;
    fileSizeBytes?: number;
  };
  metadata?: {
    provider?: string;
    questionLevel?: number;
    frustrationLevel?: number;
    tokensUsed?: number;
    aiModelDetails?: {
      name?: string;
      tier?: string;
    };
  };
}

// Chat message for API request
export interface IChatMessage {
  content: string;
  subject: string;
  sessionId: string;
  frustrationLevel: number;
}

// Chat API response types
export interface IChatResponse {
  message: IMessage;
  sessionId: string;
}

// Session creation response
export interface ISessionResponse {
  sessionId: string;
  subject: string;
  message: string;
}

// Session status types matching backend schema
export type SessionStatus = 'draft' | 'active' | 'paused' | 'completed' | 'abandoned' | 'timeout' | 'error';

// Session types
export interface IStudySession {
  id: string;
  userId?: string;
  studentId?: string;
  subject: string;
  status?: SessionStatus; // Session status from backend (default: 'active')
  startedAt: string; // Nom de champ backend
  startTime?: string; // Alias pour compatibilité
  createdAt?: string; // Additional alias
  endedAt?: string;
  endTime?: string; // Alias pour compatibilité
  messagesCount: number;
  avgFrustration?: number;
  frustrationAvg?: number; // Alias backend
  conceptsCovered?: string[];
  durationMinutes?: number;
  duration?: number; // Alias for duration
}

// Progress types
export interface IProgress {
  userId: string;
  subject: string;
  concept: string;
  masteryLevel: number;
  lastPractice: string;
  totalAttempts: number;
  successfulAttempts: number;
}

export interface IProgressData {
  totalSessions: number;
  totalMessages: number;
  averageFrustration: number;
  subjectProgress: ISubjectProgress[];
  recentSessions: IStudySession[];
  costTracking: ICostTracking;
  progress?: IProgress[];
  stats?: {
    totalConcepts: number;
    masteredConcepts: number;
    averageMastery: number;
  };
}

// Dashboard stats
export interface IDashboardStats {
  totalSessions: number;
  totalMessages: number;
  averageFrustration: number;
  subjectProgress: ISubjectProgress[];
  recentSessions: IStudySession[];
  costTracking: ICostTracking;
  studyDays?: number;
  totalStudyTime?: number;
  avgSessionDuration?: number;
  lastSessionDate?: string;
  subjectsStudied?: number;
}

export interface ISubjectProgress {
  studentId?: string;
  studentName?: string;
  subject: string;
  conceptsMastered?: number;
  avgMastery?: number;
  avgSuccessRate?: number;
  totalPracticeTime?: number;
  lastPracticed?: string | null;
}

export interface ICostTracking {
  currentMonthCost: number;
  estimatedMonthlyCost: number;
  totalTokensUsed: number;
  costLimit: number;
  warningThreshold: number;
}

// Parent dashboard types
export interface IChild {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  schoolLevel?: string;
  dateOfBirth?: string;
  age?: number;
  studySessions?: IStudySession[];
  totalSessions?: number;
  totalMinutes?: number;
  createdAt?: string;
}

export interface IMetrics {
  studentId: string;
  studentName: string;
  schoolLevel?: string;
  age: number;
  totalSessions: number;
  studyDays: number;
  avgSessionDuration: number;
  avgFrustration: number;
  subjectsStudied: number;
  totalStudyTime: number;
  lastSessionDate?: string;
}

export interface IGlobalMetrics {
  totalStudents: number;
  totalSessions: number;
  totalMessages: number;
  avgFrustration: number;
  totalStudyTime: number;
  avgSessionDuration: number;
  totalConceptsMastered: number;
  avgMasteryLevel: number;
}

// Store types obsolètes - maintenant séparés en authStore (Better Auth) et useStore (app state)

// API Response types
export interface IApiResponse<T> {
  success: boolean;
  _data?: T;
  _error?: string;
  message?: string;
}

// Child management types (from shared-types)
export interface IUpdateChildRequest {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  schoolLevel?: EducationLevelType;
  username?: string;
}

export interface IChildResponse {
  success: boolean;
  child: IChild;
  message: string;
}

export interface IDeleteChildResponse {
  success: boolean;
  message: string;
}
// Parent API response types
export interface IChildrenResponse {
  children: IChild[];
}

export interface IMetricsResponse {
  metrics: IMetrics[];
}

export interface IProgressResponse {
  progress: ISubjectProgress[];
}

// Session response types
export interface ISessionsResponse {
  sessions: IStudySession[];
  _data?: IStudySession[]; // Alternative backend format
}

export interface ISessionHistoryResponse {
  history: IMessage[];
  messages?: IMessage[]; // Alternative backend format
}

// Component Props types
export interface IProtectedRouteProps {
  children?: ReactNode;
}

export interface ILayoutProps {
  children?: ReactNode;
}

export interface ISubjectCardProps {
  subject: {
    id: string;
    name: string;
    icon: ComponentType<{ className?: string }>;
    color: string;
    lightColor: string;
    darkColor: string;
    description: string;
  };
  onClick: (subjectId: string) => void;
}

// Form types
export interface ILoginFormData {
  username: string;
  password: string;
}

// Input field props
export interface IInputFieldProps {
  label: string;
  _type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  icon?: ReactNode;
  required?: boolean;
  autoComplete?: string;
  'aria-describedby'?: string;
}

// Register form types
export interface IRegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  schoolLevel: string;
  parentFirstName?: string;
  parentLastName?: string;
  parentEmail?: string;
  parentPassword?: string;
}

// ======================================
// File Upload Types (Unified System)
// ======================================

export type FileType = 'image' | 'pdf' | 'document';

export interface IFileAttachment {
  file: File;
  type: FileType;
  preview?: string; // Base64 preview for images
  fileId?: string; // ID unique pour récupération lors du message
  geminiFileId?: string; // Gemini Files API ID for large files (>20MB)
  // Note: L'analyse se fait maintenant côté backend lors de l'envoi du message
  metadata?: {
    fileName: string;
    size: number;
    mimeType?: string;
    hash: string;
    uploadedAt: string;
    userId: string;
    schoolLevel: string;
  };
}

export interface IFileUploadResult {
  success: boolean;
  fileType: FileType;
  fileId?: string; // ID unique pour récupérer le fichier lors du message
  geminiFileId?: string; // ID from Gemini Files API (legacy)
  metadata?: {
    fileId: string;
    fileName: string;
    size: number;
    type: string;
    hash: string;
    uploadedAt: string;
    userId: string;
    schoolLevel: string;
    [key: string]: unknown;
  };
  error?: string;
}

export interface IFileProcessingOptions {
  maxSize?: number;
  allowedTypes?: string[];
  enablePreview?: boolean;
  useGeminiFiles?: boolean; // Auto for files >20MB
  analysisContext?: string;
}

// ======================================
// Voice & Media Types
// ======================================

// Voice input modes for subject-aware voice detection
export type VoiceMode = 'text' | 'audio';

export interface IVoiceState {
  isListening: boolean;
  transcript: string;
  permission: 'granted' | 'denied' | 'prompt';
  confidence: number;
}

export interface ITextToSpeechState {
  isSpeaking: boolean;
  rate: number;
  pitch: number;
  volume: number;
}

// Form data interfaces
export interface ICreateChildData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  schoolLevel: string;
  username: string;
  password: string;
  subjects?: string[];
}

export interface IUpdateChildData {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  schoolLevel: string;
}

// ======================================
// Smart Subjects System Types
// ======================================

export interface ISubjectsForStudent {
  subjects: EducationSubject[];
}

export interface ISubjectsResponse {
  success: boolean;
  data: ISubjectsForStudent;
  message: string;
}

// ======================================
// Subscription & Stripe Types
// ======================================

/**
 * Plan types: free or premium (per-child pricing)
 * Old student/family plans are deprecated
 */
export type SubscriptionPlanType = 'free' | 'premium';

/**
 * Billing status matching backend familyBilling.billingStatus
 */
export type BillingStatusType = 'active' | 'inactive' | 'past_due' | 'canceled' | 'expired';

/**
 * Subscription plan display info
 */
export interface ISubscriptionPlan {
  key: SubscriptionPlanType;
  name: string;
  description: string;
  /** Price for first child in cents (e.g., 1500 = 15€) */
  priceFirstChildCents: number;
  /** Price for additional children in cents (e.g., 500 = 5€) */
  priceAdditionalChildCents: number;
  features: string[];
  highlighted?: boolean;
  badge?: string;
}

/**
 * Per-child pricing info for display
 */
export interface IPricingInfo {
  firstChildPrice: number; // In euros (15)
  additionalChildPrice: number; // In euros (5)
  calculateTotal: (childrenCount: number) => number;
}

/**
 * Child subscription status for parent dashboard
 */
export interface IChildSubscriptionStatus {
  childId: string;
  childName: string;
  plan: SubscriptionPlanType;
  status: 'active' | 'paused' | 'pending_removal';
  /** If pending_removal, when will it be downgraded */
  removalDate?: string;
}

/**
 * Family subscription status - returned by /api/subscriptions/status
 */
export interface ISubscriptionStatus {
  /** Current plan type */
  plan: SubscriptionPlanType;
  /** Billing status */
  status: BillingStatusType;
  /** Billing details (only for premium) */
  billing: {
    premiumChildrenCount: number;
    monthlyAmountCents: number;
    monthlyAmount: string; // Formatted (e.g., "15.00€")
    billingStatus: BillingStatusType;
  } | null;
  /** Stripe subscription details (only for premium) */
  subscription: {
    id: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    /** Children IDs pending removal at period end */
    pendingRemovalChildrenIds?: string[];
    /** New children count after pending changes */
    scheduledChildrenCount?: number;
    /** New monthly amount after pending changes */
    scheduledMonthlyAmountCents?: number;
    /** Has scheduled changes (pending removals) */
    hasScheduledChanges?: boolean;
  } | null;
  /** Children with their subscription status */
  children: Array<{
    id: string;
    name: string;
    username: string;
    plan: string;
    status: string;
  }>;
}

/**
 * Checkout session response
 */
export interface ICheckoutResponse {
  sessionId: string;
  url: string;
  childrenCount: number;
}

/**
 * Portal session response
 */
export interface IPortalResponse {
  url: string;
}

/**
 * Cancel subscription response
 */
export interface ICancelSubscriptionResponse {
  success: boolean;
  message: string;
  subscription: {
    id: string;
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string;
  };
}

/**
 * Add/remove children response
 */
export interface IManageChildrenResponse {
  plan: SubscriptionPlanType;
  status: BillingStatusType;
  subscription: {
    id: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    premiumChildrenCount: number;
    monthlyAmountCents: number;
    monthlyAmount: string;
    /** For removal: pending changes info */
    pendingRemovalChildrenIds?: string[];
    scheduledChildrenCount?: number;
    scheduledMonthlyAmountCents?: number;
    hasScheduledChanges?: boolean;
  } | null;
}

/**
 * Resume subscription response
 */
export interface IResumeSubscriptionResponse {
  success: boolean;
  message: string;
  subscription: IManageChildrenResponse;
}
