/**
 * Tests unitaires - RAG Service (services/rag.service.ts)
 * Focused on RAG_RERANK_ENABLED flag: when disabled, rerank must not be called.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

// ============================================
// MOCKS — paths relative to src/tests/ (this file)
// ============================================

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

// Rerank flag — controlled per test via rerankEnabled
let rerankEnabled = false;
mock.module('../config/env', () => ({
  env: {
    NODE_ENV: 'development',
    RAG_RERANK_CANDIDATES: undefined,
    RAG_RERANK_ENABLED: undefined,
    QDRANT_ENABLED: 'true',
  },
  isDevelopment: () => true,
  isRerankEnabled: () => rerankEnabled,
}));

// qdrantService mock
const mockSearchHybrid = mock(async () => [
  { id: 'c1', score: 0.8, text: 'chunk one', section: 'S1', matiere: 'maths', niveau: 'sixieme' },
  { id: 'c2', score: 0.7, text: 'chunk two', section: 'S2', matiere: 'maths', niveau: 'sixieme' },
  { id: 'c3', score: 0.6, text: 'chunk three', section: 'S3', matiere: 'maths', niveau: 'sixieme' },
]);
const mockQdrantAvailable = mock(async () => true);

mock.module('../services/qdrant.service', () => ({
  qdrantService: {
    isAvailable: mockQdrantAvailable,
    searchHybrid: mockSearchHybrid,
  },
}));

// aiServiceClient mock
const mockRerank = mock(async () => [
  { index: 1, score: 0.95 },
  { index: 0, score: 0.88 },
]);
const mockEmbed = mock(async () => ({
  dense: new Array(1024).fill(0.1),
  sparse: { indices: [1, 2], values: [0.5, 0.5] },
}));
const mockAiAvailable = mock(async () => true);

mock.module('../services/ai-service.client', () => ({
  aiServiceClient: {
    isAvailable: mockAiAvailable,
    embed: mockEmbed,
    rerank: mockRerank,
  },
}));

// retrievalAuditRepository mock — fire-and-forget, we don't need assertions
mock.module('../db/repositories/retrieval-audit.repository', () => ({
  retrievalAuditRepository: {
    log: mock(async () => undefined),
  },
}));

// Import after all mocks
const { ragService } = await import('../services/rag.service');

const BASE_OPTIONS = {
  query: 'fractions et divisions',
  niveau: 'sixieme' as const,
  matiere: 'maths',
  limit: 2,
};

beforeEach(() => {
  rerankEnabled = false;
  mockRerank.mockClear();
  mockSearchHybrid.mockClear();
  mockEmbed.mockClear();
  ragService.invalidateAvailabilityCache();
});

describe('RAGService — rerank flag', () => {
  it('does NOT call rerank when isRerankEnabled() is false', async () => {
    rerankEnabled = false;

    const result = await ragService.hybridSearch(BASE_OPTIONS);

    expect(mockRerank).not.toHaveBeenCalled();
    expect(result.strategy).toBe('qdrant-hybrid-rrf');
  });

  it('truncates results to topK when rerank is disabled', async () => {
    rerankEnabled = false;

    const result = await ragService.hybridSearch({ ...BASE_OPTIONS, limit: 2 });

    // 3 hybrid results, topK=2 → must truncate to 2 without rerank
    expect(result.semanticChunks.length).toBe(2);
    expect(result.strategy).toBe('qdrant-hybrid-rrf');
  });

  it('calls rerank and returns +rerank strategy when isRerankEnabled() is true', async () => {
    rerankEnabled = true;

    const result = await ragService.hybridSearch(BASE_OPTIONS);

    expect(mockRerank).toHaveBeenCalledTimes(1);
    expect(result.strategy).toBe('qdrant-hybrid-rrf+rerank-bge-m3');
  });
});
