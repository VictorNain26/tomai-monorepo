/**
 * Test Fixtures - Deterministic data factories
 * All IDs are UUIDs, dates are fixed for snapshot-friendliness.
 */

const BASE_DATE = new Date('2025-06-15T10:00:00.000Z');

interface UserData {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  username: string;
  role: 'student' | 'parent';
  schoolLevel: string | null;
  dateOfBirth: string | null;
  parentId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function makeUser(overrides?: Partial<UserData>): UserData {
  return {
    id: 'user-001',
    email: 'alice@test.com',
    name: 'Alice Dupont',
    firstName: 'Alice',
    lastName: 'Dupont',
    username: 'alice',
    role: 'student',
    schoolLevel: 'troisieme',
    dateOfBirth: '2010-03-15',
    parentId: null,
    isActive: true,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
    ...overrides,
  };
}

export function makeParentUser(overrides?: Partial<UserData>): UserData {
  return makeUser({
    id: 'parent-001',
    email: 'parent@test.com',
    name: 'Pierre Dupont',
    firstName: 'Pierre',
    lastName: 'Dupont',
    username: 'pierre',
    role: 'parent',
    schoolLevel: null,
    dateOfBirth: null,
    parentId: null,
    ...overrides,
  });
}

interface StudySessionData {
  id: string;
  userId: string;
  subject: string;
  schoolLevel: string;
  startedAt: Date;
  endedAt: Date | null;
  conversationSummary: string | null;
  summaryUpToMessageId: string | null;
  messageCount: number;
}

export function makeStudySession(overrides?: Partial<StudySessionData>): StudySessionData {
  return {
    id: 'session-001',
    userId: 'user-001',
    subject: 'mathematiques',
    schoolLevel: 'troisieme',
    startedAt: BASE_DATE,
    endedAt: null,
    conversationSummary: null,
    summaryUpToMessageId: null,
    messageCount: 0,
    ...overrides,
  };
}

interface MessageData {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  frustrationLevel: number | null;
  aiModel: string | null;
  tokensUsed: number | null;
  createdAt: Date;
}

export function makeMessage(overrides?: Partial<MessageData>): MessageData {
  return {
    id: 'msg-001',
    sessionId: 'session-001',
    role: 'user',
    content: 'Bonjour, je ne comprends pas les fractions.',
    frustrationLevel: null,
    aiModel: null,
    tokensUsed: null,
    createdAt: BASE_DATE,
    ...overrides,
  };
}

interface SubscriptionData {
  id: string;
  userId: string;
  planId: string;
  status: string;
  windowTokensUsed: number;
  windowStartAt: Date;
  tokensUsedToday: number;
  tokensUsedThisWeek: number;
  totalTokensUsed: number;
  totalMessagesCount: number;
  decksGeneratedToday: number;
  decksGeneratedThisMonth: number;
  lastResetAt: Date;
  lastWeeklyResetAt: Date;
  lastMonthlyResetAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export function makeSubscription(overrides?: Partial<SubscriptionData>): SubscriptionData {
  return {
    id: 'sub-001',
    userId: 'user-001',
    planId: 'plan-free',
    status: 'active',
    windowTokensUsed: 0,
    windowStartAt: BASE_DATE,
    tokensUsedToday: 0,
    tokensUsedThisWeek: 0,
    totalTokensUsed: 0,
    totalMessagesCount: 0,
    decksGeneratedToday: 0,
    decksGeneratedThisMonth: 0,
    lastResetAt: BASE_DATE,
    lastWeeklyResetAt: BASE_DATE,
    lastMonthlyResetAt: BASE_DATE,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
    ...overrides,
  };
}

interface FamilyBillingData {
  id: string;
  parentId: string;
  revenuecatCustomerId: string | null;
  revenuecatSubscriptionId: string | null;
  billingStatus: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  monthlyAmountCents: number;
  premiumChildrenCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export function makeFamilyBilling(overrides?: Partial<FamilyBillingData>): FamilyBillingData {
  return {
    id: 'billing-001',
    parentId: 'parent-001',
    revenuecatCustomerId: 'rc_test_parent_001',
    revenuecatSubscriptionId: 'tom_premium_monthly',
    billingStatus: 'active',
    currentPeriodStart: BASE_DATE,
    currentPeriodEnd: new Date('2025-07-15T10:00:00.000Z'),
    monthlyAmountCents: 1500,
    premiumChildrenCount: 1,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
    ...overrides,
  };
}

export function makeRevenueCatEvent(
  type: string,
  overrides?: Partial<{
    id: string;
    app_user_id: string;
    product_id: string;
    subscriber_attributes: Record<string, { value: string; updated_at_ms: number }>;
  }>
) {
  return {
    api_version: '4.0',
    event: {
      type,
      id: overrides?.id ?? `rc_evt_${Date.now()}`,
      app_id: 'app_test',
      app_user_id: overrides?.app_user_id ?? 'parent-001',
      original_app_user_id: overrides?.app_user_id ?? 'parent-001',
      aliases: [],
      product_id: overrides?.product_id ?? 'tom_premium_monthly',
      entitlement_ids: ['premium'],
      event_timestamp_ms: BASE_DATE.getTime(),
      purchased_at_ms: BASE_DATE.getTime(),
      expiration_at_ms: BASE_DATE.getTime() + 30 * 24 * 60 * 60 * 1000,
      store: 'APP_STORE',
      environment: 'PRODUCTION' as const,
      subscriber_attributes: overrides?.subscriber_attributes,
    },
  };
}

interface CognitiveProfileData {
  id: string;
  userId: string;
  strengths: string[];
  weaknesses: string[];
  preferredStyle: string | null;
  observations: Array<{ date: string; observation: string; subject?: string }>;
  lastUpdatedByAgent: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function makeCognitiveProfile(overrides?: Partial<CognitiveProfileData>): CognitiveProfileData {
  return {
    id: 'profile-001',
    userId: 'user-001',
    strengths: ['calcul mental', 'logique'],
    weaknesses: ['fractions', 'geometrie'],
    preferredStyle: 'visual',
    observations: [
      { date: '2025-06-15T10:00:00.000Z', observation: 'Bonne progression en calcul', subject: 'mathematiques' },
    ],
    lastUpdatedByAgent: BASE_DATE,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
    ...overrides,
  };
}
