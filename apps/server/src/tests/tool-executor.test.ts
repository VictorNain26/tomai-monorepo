/**
 * Tests unitaires - Tool Executor (services/chat/tool-executor.ts)
 * Mock: learning, DB, logger
 *
 * Note: mock.module paths resolve from the test file location (src/tests/)
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

// ============================================
// MOCKS — paths relative to src/tests/ (this file)
// ============================================

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

// Cognitive profile — src/services/cognitive-profile.service.ts
let profileResult: Record<string, unknown> | null = {
  strengths: ['calcul'],
  weaknesses: ['fractions'],
  preferredStyle: 'visual',
  observations: [{ observation: 'Progresse bien' }],
  lastUpdatedByAgent: new Date('2025-06-15'),
};

mock.module('../services/cognitive-profile.service', () => ({
  cognitiveProfileService: {
    getProfile: mock(async () => profileResult),
  },
}));

// Card generator — src/services/learning/card-generator.service.ts
let cardGenResult: Record<string, unknown> = {
  cards: [
    { cardType: 'front_back', content: { front: 'Q1', back: 'A1' } },
    { cardType: 'front_back', content: { front: 'Q2', back: 'A2' } },
  ],
  count: 2,
};

let cardGenThrows = false;
mock.module('../services/learning/card-generator.service', () => ({
  generateCards: mock(async () => {
    if (cardGenThrows) throw new Error('mistral unreachable');
    return cardGenResult;
  }),
}));

// FSRS — src/services/fsrs.service.ts
mock.module('../services/fsrs.service', () => ({
  fsrsService: {
    initializeCardFsrsData: mock(() => ({ difficulty: 0.3, stability: 0 })),
  },
}));

// DB mock — src/db/connection.ts
const mockTxInsert = mock(() => ({
  values: mock(() => ({
    returning: mock(() => [{ id: 'deck-001', title: 'Test deck' }]),
  })),
}));

mock.module('../db/connection', () => ({
  db: {
    transaction: mock(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
      return fn({
        insert: mockTxInsert,
      });
    }),
  },
}));

mock.module('../db/schema', () => ({
  learningDecks: {},
  learningCards: {},
}));

// Config mocks — src/config/
mock.module('../config/learning-config', () => ({
  getLevelConfig: mock(() => ({ cardsPerSession: 10 })),
}));

mock.module('../config/app-guide/index', () => ({
  getAppHelpContent: mock((topic: string) => {
    if (topic === 'overview') return 'Guide overview content';
    return null;
  }),
}));

// Import after all mocks. chat-tools.test.ts's mock.module('../services/chat/tool-executor', ...)
// registers in the process-wide module registry (bun-types test.d.ts:
// `module(id, factory): ... If the module is already loaded, exports are
// overwritten`) before this file ever loads the real module — there is no
// "previous value" to restore, so `mock.restore()` cannot undo it. The
// `?fresh` suffix makes this a distinct specifier from the one the other
// file mocked, bypassing the registry entry to load the real module. It is
// a runtime-built string, not a literal, so TypeScript treats `import()`
// as returning `any` instead of resolving it as a module path.
const toolExecutorPath = '../services/chat/tool-executor' + '?fresh';
const { executeTool } = (await import(toolExecutorPath)) as typeof import('../services/chat/tool-executor');

const baseContext = {
  userId: 'user-001',
  schoolLevel: 'troisieme' as const,
  sessionId: 'session-001',
  userRole: 'student' as const,
};

beforeEach(() => {
  cardGenThrows = false;
  cardGenResult = {
    cards: [
      { cardType: 'front_back', content: { front: 'Q1', back: 'A1' } },
      { cardType: 'front_back', content: { front: 'Q2', back: 'A2' } },
    ],
    count: 2,
  };
});

describe('Tool Executor', () => {
  describe('unknown tool', () => {
    it('should return error for unknown tool name', async () => {
      const result = await executeTool('get_student_homework', {}, baseContext) as Record<string, unknown>;
      expect(result.isError).toBe(true);
      expect(result.message).toContain('Outil inconnu');
      expect(result.errorCategory).toBe('validation');
    });
  });

  describe('generate_flashcards', () => {
    it('should create deck and cards in transaction', async () => {
      const result = await executeTool('generate_flashcards', {
        topic: 'Fractions', subject: 'mathematiques', cardCount: 5,
      }, baseContext) as Record<string, unknown>;
      expect(result.generated).toBe(true);
      expect(result.deckId).toBeDefined();
    });

    it('should generate without a topic context', async () => {
      const result = await executeTool('generate_flashcards', {
        topic: 'Fractions', subject: 'mathematiques',
      }, baseContext) as Record<string, unknown>;
      expect(result.generated).toBe(true);
    });
  });

  describe('get_student_profile', () => {
    it('should return profile when exists', async () => {
      const result = await executeTool('get_student_profile', {}, baseContext) as Record<string, unknown>;
      expect(result.exists).toBe(true);
      expect(result.strengths).toEqual(['calcul']);
    });

    it('should return exists=false when no profile', async () => {
      profileResult = null;
      const result = await executeTool('get_student_profile', {}, baseContext) as Record<string, unknown>;
      expect(result.exists).toBe(false);
    });
  });

  describe('get_app_help', () => {
    it('should return guide for valid topic', async () => {
      const result = await executeTool('get_app_help', { topic: 'overview' }, baseContext) as Record<string, unknown>;
      expect(result.found).toBe(true);
      expect(result.guide).toBeDefined();
    });

    it('should return not found for invalid topic', async () => {
      const result = await executeTool('get_app_help', { topic: 'nonexistent' }, baseContext) as Record<string, unknown>;
      expect(result.found).toBe(false);
    });
  });

  describe('Unknown tool', () => {
    it('should return error message for unknown tool', async () => {
      const result = await executeTool('unknown_tool', {}, baseContext) as Record<string, unknown>;
      expect(result.isError).toBe(true);
      expect(result.message).toContain('Outil inconnu');
      expect(result.errorCategory).toBe('validation');
    });
  });

  describe('Error encapsulation', () => {
    it('should never throw - encapsulates errors in return value', async () => {
      cardGenThrows = true;
      const result = await executeTool('generate_flashcards', {
        topic: 'Fractions', subject: 'mathematiques',
      }, baseContext) as Record<string, unknown>;
      expect(result.isError).toBe(true);
      expect(result.errorCategory).toBe('business');
    });
  });
});
