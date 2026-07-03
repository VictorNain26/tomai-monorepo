/**
 * Tests unitaires - RAG Service (services/rag.service.ts)
 * Hybrid RRF retrieval : troncature à topK et scores RRF jamais présentés
 * comme des pourcentages de similarité dans le contexte LLM.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

// ============================================
// MOCKS — paths relative to src/tests/ (this file)
// ============================================

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

mock.module('../config/env', () => ({
  env: {
    NODE_ENV: 'development',
    QDRANT_ENABLED: 'true',
  },
  isDevelopment: () => true,
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
const mockEmbed = mock(async () => ({
  dense: new Array(1024).fill(0.1),
  sparse: { indices: [1, 2], values: [0.5, 0.5] },
}));
const mockAiAvailable = mock(async () => true);

mock.module('../services/ai-service.client', () => ({
  aiServiceClient: {
    isAvailable: mockAiAvailable,
    embed: mockEmbed,
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
  mockSearchHybrid.mockClear();
  mockEmbed.mockClear();
  ragService.invalidateAvailabilityCache();
});

describe('RAGService — hybrid RRF', () => {
  it('truncates results to topK (mock returns more than the requested limit)', async () => {
    const result = await ragService.hybridSearch({ ...BASE_OPTIONS, limit: 2 });

    expect(result.semanticChunks.length).toBe(2);
    expect(result.strategy).toBe('qdrant-hybrid-rrf');
  });
});

describe('RAGService — contexte LLM (scores RRF jamais affichés en %)', () => {
  it('builds context with rank markers and no percentage', async () => {
    // Scores RRF réalistes (~1/(k+rank)) : le contexte ne doit JAMAIS les
    // présenter comme des pourcentages de similarité.
    mockSearchHybrid.mockImplementationOnce(async () => [
      { id: 'c1', score: 0.016, text: 'chunk one', section: 'S1', matiere: 'maths', niveau: 'sixieme' },
      { id: 'c2', score: 0.015, text: 'chunk two', section: 'S2', matiere: 'maths', niveau: 'sixieme' },
    ]);

    const result = await ragService.hybridSearch(BASE_OPTIONS);

    expect(result.context).toContain('[1] S1 (sixieme - maths)');
    expect(result.context).toContain('[2] S2 (sixieme - maths)');
    expect(result.context).toContain('chunk one');
    expect(result.context).not.toContain('%');
  });
});

describe('RAGService — limites de recherche (pas de double amplification)', () => {
  it('requests exactly topK fused results', async () => {
    await ragService.hybridSearch({ ...BASE_OPTIONS, limit: 5 });

    // 4e argument de searchHybrid = limit fusionné. Avant fix : max(5*4,20)=20
    // (puis re-amplifié ×4 en interne → prefetch 80 = 16× topK).
    const call = mockSearchHybrid.mock.calls[0] as unknown[];
    expect(call[3]).toBe(5);
  });
});
