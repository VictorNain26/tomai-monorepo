/**
 * Tests unitaires - Tool Executor (services/chat/tool-executor.ts)
 * Mock: RAG, learning, DB, logger
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

// RAG service mock — tool-executor imports from '../rag.service.js' (from src/services/chat/)
// Resolves to src/services/rag.service.ts
let ragAvailable = true;
let ragResult: Record<string, unknown> | null = {
  semanticChunks: [{ content: 'chunk1' }],
  context: 'RAG context text',
  averageSimilarity: 0.85,
  bestMatchTitle: 'Programme mathématiques',
  bestMatchDomaine: 'Nombres et calculs',
};

mock.module('../services/rag.service', () => ({
  ragService: {
    isAvailable: mock(async () => ragAvailable),
    hybridSearch: mock(async () => ragResult),
  },
}));

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

mock.module('../services/learning/card-generator.service', () => ({
  generateCards: mock(async () => cardGenResult),
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

// Import after all mocks
const { executeTool } = await import('../services/chat/tool-executor');

const baseContext = {
  userId: 'user-001',
  schoolLevel: 'troisieme' as const,
  sessionId: 'session-001',
  userRole: 'student' as const,
};

beforeEach(() => {
  ragAvailable = true;
  ragResult = {
    semanticChunks: [{ content: 'chunk1' }],
    context: 'RAG context text',
    averageSimilarity: 0.85,
    bestMatchTitle: 'Programme mathématiques',
    bestMatchDomaine: 'Nombres et calculs',
  };
  profileResult = {
    strengths: ['calcul'],
    weaknesses: ['fractions'],
    preferredStyle: 'visual',
    observations: [{ observation: 'Progresse bien' }],
    lastUpdatedByAgent: new Date('2025-06-15'),
  };
  cardGenResult = {
    cards: [
      { cardType: 'front_back', content: { front: 'Q1', back: 'A1' } },
      { cardType: 'front_back', content: { front: 'Q2', back: 'A2' } },
    ],
    count: 2,
  };
});

describe('Tool Executor', () => {
  describe('search_educational_content', () => {
    it('should return RAG results when available', async () => {
      const result = await executeTool('search_educational_content', {
        query: 'fractions', niveau: 'troisieme', matiere: 'mathematiques',
      }, baseContext) as Record<string, unknown>;
      expect(result.found).toBe(true);
      expect(result.context).toBe('RAG context text');
      expect(result.resultsCount).toBe(1);
    });

    it('should return transient error when RAG is down', async () => {
      ragAvailable = false;
      const result = await executeTool('search_educational_content', {
        query: 'fractions', niveau: 'troisieme', matiere: 'mathematiques',
      }, baseContext) as Record<string, unknown>;
      expect(result.isError).toBe(true);
      expect(result.errorCategory).toBe('transient');
      expect(result.isRetryable).toBe(true);
    });
  });

  describe('unknown tool', () => {
    it('should return validation error for unknown tool name', async () => {
      const result = await executeTool('get_student_homework', {}, baseContext) as Record<string, unknown>;
      expect(result.isError).toBe(true);
      expect(result.errorCategory).toBe('validation');
      expect(result.message).toContain('Outil inconnu');
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

    it('should fallback when RAG is down', async () => {
      ragAvailable = false;
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

    it('should return validation error for invalid topic', async () => {
      const result = await executeTool('get_app_help', { topic: 'nonexistent' }, baseContext) as Record<string, unknown>;
      expect(result.isError).toBe(true);
      expect(result.errorCategory).toBe('validation');
      expect(result.message).toContain('non reconnu');
    });
  });

  describe('Unknown tool', () => {
    it('should return validation error for unknown tool', async () => {
      const result = await executeTool('unknown_tool', {}, baseContext) as Record<string, unknown>;
      expect(result.isError).toBe(true);
      expect(result.errorCategory).toBe('validation');
      expect(result.message).toContain('Outil inconnu');
    });
  });

  describe('Error encapsulation', () => {
    it('should never throw - encapsulates transient errors in return value', async () => {
      ragAvailable = true;
      ragResult = null; // Force error in hybridSearch
      const result = await executeTool('search_educational_content', {
        query: 'test', niveau: 'troisieme', matiere: 'maths',
      }, baseContext) as Record<string, unknown>;
      expect(result.isError).toBe(true);
      expect(result.errorCategory).toBe('transient');
      expect(result.isRetryable).toBe(true);
    });
  });
});
