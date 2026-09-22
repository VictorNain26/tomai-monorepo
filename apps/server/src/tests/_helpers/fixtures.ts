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
