/**
 * Tests d'intégration RAG - Appels réels Qdrant
 * Vérifie que les réponses sont correctes et pertinentes
 *
 * Requires: QDRANT_URL, QDRANT_API_KEY, MISTRAL_API_KEY
 * Run: bun test src/tests/rag.integration.test.ts
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { ragService } from '../services/rag.service';
import { qdrantService } from '../services/qdrant.service';
import { mistralEmbeddingsService } from '../services/mistral-embeddings.service';

// Skip si pas de credentials
const hasCredentials = Boolean(
  Bun.env['QDRANT_URL'] &&
  Bun.env['QDRANT_API_KEY'] &&
  Bun.env['MISTRAL_API_KEY']
);

// Queries de test avec réponses attendues (basé sur dataset réel)
const TEST_QUERIES = [
  {
    id: 'math_001',
    query: 'Comment calculer l\'aire d\'un triangle ?',
    niveau: 'cinquieme' as const,
    matiere: 'mathematiques',
    expectedInTitle: ['aire', 'triangle'],
    minScore: 0.5,
  },
  {
    id: 'math_002',
    query: 'C\'est quoi la proportionnalité ?',
    niveau: 'cinquieme' as const,
    matiere: 'mathematiques',
    expectedInTitle: ['proportionnal'],
    minScore: 0.5,
  },
  {
    id: 'fr_001',
    query: 'Comment conjuguer à l\'imparfait ?',
    niveau: 'cinquieme' as const,
    matiere: 'francais',
    expectedInTitle: ['imparfait'],
    minScore: 0.5,
  },
  {
    id: 'phys_001',
    query: 'C\'est quoi un circuit électrique ?',
    niveau: 'cinquieme' as const,
    matiere: 'physique_chimie',
    expectedInTitle: ['circuit', 'electrique'],
    minScore: 0.5,
  },
];

describe.skipIf(!hasCredentials)('RAG Integration Tests - Real Qdrant Calls', () => {

  beforeAll(async () => {
    // Vérifier que les services sont disponibles
    const available = await ragService.isAvailable();
    if (!available) {
      throw new Error('RAG service not available - check credentials');
    }
  });

  describe('Service Availability', () => {
    it('should have Qdrant available', async () => {
      const available = await qdrantService.isAvailable();
      expect(available).toBe(true);
    });

    it('should have Mistral embeddings available', async () => {
      const available = await mistralEmbeddingsService.isAvailable();
      expect(available).toBe(true);
    });

    it('should have RAG service available', async () => {
      const available = await ragService.isAvailable();
      expect(available).toBe(true);
    });
  });

  describe('Qdrant Collection Stats', () => {
    it('should return collection statistics', async () => {
      const stats = await qdrantService.getStats();

      expect(stats.total_points).toBeGreaterThan(0);
      expect(Object.keys(stats.by_niveau).length).toBeGreaterThan(0);
      expect(Object.keys(stats.by_matiere).length).toBeGreaterThan(0);
    });

    it('should have cinquieme documents', async () => {
      const stats = await qdrantService.getStats();

      expect(stats.by_niveau['cinquieme']).toBeGreaterThan(0);
    });
  });

  describe('RAG Search Relevance', () => {
    for (const testCase of TEST_QUERIES) {
      it(`should return relevant results for: ${testCase.id}`, async () => {
        const result = await ragService.hybridSearch({
          query: testCase.query,
          niveau: testCase.niveau,
          matiere: testCase.matiere,
          limit: 5,
        });

        // Doit retourner des résultats
        expect(result.semanticChunks.length).toBeGreaterThan(0);

        // Le meilleur résultat doit avoir un score suffisant
        const bestScore = result.semanticChunks[0]?.score ?? 0;
        expect(bestScore).toBeGreaterThanOrEqual(testCase.minScore);

        // Le titre du meilleur résultat doit contenir un des mots attendus
        const bestTitle = result.semanticChunks[0]?.title.toLowerCase() ?? '';
        const hasExpectedTerm = testCase.expectedInTitle.some(term =>
          bestTitle.includes(term.toLowerCase())
        );
        expect(hasExpectedTerm).toBe(true);

        // Le contexte ne doit pas être vide
        expect(result.context.length).toBeGreaterThan(0);
      });
    }
  });

  describe('RAG Search Performance', () => {
    it('should complete search in reasonable time (<3s)', async () => {
      const start = Date.now();

      await ragService.hybridSearch({
        query: 'Comment calculer une fraction ?',
        niveau: 'cinquieme',
        matiere: 'mathematiques',
        limit: 5,
      });

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(3000);
    });
  });

  describe('RAG Search Edge Cases', () => {
    it('should handle query with no good matches gracefully', async () => {
      const result = await ragService.hybridSearch({
        query: 'recette de cuisine poulet rôti',
        niveau: 'cinquieme',
        matiere: 'mathematiques',
        limit: 5,
      });

      // Peut retourner 0 résultats ou résultats avec score bas
      // L'important c'est de ne pas crash
      expect(result.context).toBeDefined();
      expect(result.semanticChunks).toBeDefined();
    });

    it('should filter by matiere correctly', async () => {
      const result = await ragService.hybridSearch({
        query: 'grammaire conjugaison',
        niveau: 'cinquieme',
        matiere: 'francais',
        limit: 5,
      });

      // Tous les résultats doivent être en français
      for (const chunk of result.semanticChunks) {
        // Le chunk vient du payload Qdrant, vérifier via le contexte
        expect(result.context).not.toContain('mathematiques:');
      }
    });
  });
});
