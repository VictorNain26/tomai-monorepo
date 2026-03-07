/**
 * Tests unitaires - Rerank Service (services/rerank.service.ts)
 * Algorithme pur BM25 + RRF — zero mock, zero DB
 */

import { describe, it, expect } from 'bun:test';
import { rerankWithBm25Rrf, rerankByScore } from '../services/rerank.service';
import type { QdrantSearchResult } from '../services/qdrant.service';

// Helper: create a minimal QdrantSearchResult
function makeDoc(id: string, title: string, content: string, score: number): QdrantSearchResult {
  return { id, title, content, score } as QdrantSearchResult;
}

describe('Rerank Service', () => {
  describe('rerankByScore (simple vector sort)', () => {
    it('should sort by score descending', () => {
      const docs = [
        makeDoc('1', 'Low', 'low relevance', 0.3),
        makeDoc('2', 'High', 'high relevance', 0.9),
        makeDoc('3', 'Mid', 'mid relevance', 0.6),
      ];
      const result = rerankByScore(docs, 3);
      expect(result[0]?.id).toBe('2');
      expect(result[1]?.id).toBe('3');
      expect(result[2]?.id).toBe('1');
    });

    it('should limit to topK', () => {
      const docs = Array.from({ length: 10 }, (_, i) =>
        makeDoc(`${i}`, `Doc ${i}`, `content ${i}`, Math.random())
      );
      const result = rerankByScore(docs, 3);
      expect(result.length).toBe(3);
    });

    it('should return empty for empty input', () => {
      const result = rerankByScore([], 5);
      expect(result.length).toBe(0);
    });

    it('should set rrf_score and final_score equal to vector score', () => {
      const docs = [makeDoc('1', 'Test', 'content', 0.75)];
      const result = rerankByScore(docs, 5);
      expect(result[0]?.rrf_score).toBe(0.75);
      expect(result[0]?.final_score).toBe(0.75);
    });
  });

  describe('rerankWithBm25Rrf (hybrid BM25 + vector)', () => {
    it('should return empty for empty input', () => {
      const result = rerankWithBm25Rrf('query', []);
      expect(result.length).toBe(0);
    });

    it('should return all docs unchanged when count <= topK', () => {
      const docs = [
        makeDoc('1', 'Fractions', 'Les fractions en maths', 0.8),
        makeDoc('2', 'Algebre', 'Equations du second degre', 0.6),
      ];
      const result = rerankWithBm25Rrf('fractions', docs, 5);
      expect(result.length).toBe(2);
      // All docs returned with rrf_score = original score
      expect(result[0]?.rrf_score).toBe(0.8);
    });

    it('should boost docs matching query terms via BM25', () => {
      // Partial-match docs (4, 5) push non-matching docs further down in BM25 ranking,
      // creating asymmetric rank gap so BM25 can overcome vector score difference
      const docs = [
        makeDoc('1', 'Geometrie', 'Les angles et les triangles en geometrie', 0.85),
        makeDoc('2', 'Fractions', 'Additionner des fractions et fractions decimales', 0.80),
        makeDoc('3', 'Algebre', 'Equations lineaires et systemes', 0.82),
        makeDoc('4', 'Nombres', 'Les nombres decimales et la numeration', 0.78),
        makeDoc('5', 'Calcul', 'Calcul avec fractions et pourcentages', 0.75),
        makeDoc('6', 'Trigonometrie', 'Sinus cosinus tangente', 0.70),
      ];

      const result = rerankWithBm25Rrf('fractions decimales', docs, 3);

      // Doc 2 matches both query terms → BM25 rank 0, vector rank 2
      // Docs 4,5 match one term each → push Geometrie from BM25 rank 1 to rank 3+
      expect(result.length).toBe(3);
      expect(result[0]?.id).toBe('2');
      expect(result[0]?.bm25_score).toBeGreaterThan(0);
    });

    it('should handle query with no matching terms', () => {
      const docs = [
        makeDoc('1', 'Maths', 'Les equations', 0.9),
        makeDoc('2', 'Physique', 'La gravite', 0.8),
        makeDoc('3', 'Chimie', 'Les atomes', 0.7),
        makeDoc('4', 'Biologie', 'Les cellules', 0.6),
        makeDoc('5', 'Histoire', 'La revolution', 0.5),
        makeDoc('6', 'Geo', 'Les continents', 0.4),
      ];

      const result = rerankWithBm25Rrf('xyznotaword', docs, 3);
      // BM25 scores all 0, so RRF falls back to vector ranking
      expect(result.length).toBe(3);
      expect(result[0]?.id).toBe('1'); // Highest vector score wins
    });

    it('should handle French accented characters in tokenization', () => {
      const docs = [
        makeDoc('1', 'Elementaire', 'Les operations elementaires', 0.7),
        makeDoc('2', 'Avance', 'Théorème de Pythagore et géométrie', 0.8),
        makeDoc('3', 'Algebre', 'Résolution équations', 0.75),
        makeDoc('4', 'Stats', 'Statistiques descriptives', 0.65),
        makeDoc('5', 'Proba', 'Probabilites conditionnelles', 0.6),
        makeDoc('6', 'Trigo', 'Fonctions trigonometriques', 0.55),
      ];

      const result = rerankWithBm25Rrf('géométrie théorème', docs, 3);
      // Doc 2 contains both accented terms
      expect(result[0]?.id).toBe('2');
    });

    it('should respect topK limit', () => {
      const docs = Array.from({ length: 20 }, (_, i) =>
        makeDoc(`${i}`, `Doc ${i}`, `content about maths ${i}`, 0.5 + Math.random() * 0.5)
      );
      const result = rerankWithBm25Rrf('maths', docs, 5);
      expect(result.length).toBe(5);
    });

    it('should include bm25_score in results', () => {
      const docs = [
        makeDoc('1', 'Fractions', 'Les fractions simples', 0.8),
        makeDoc('2', 'Geometrie', 'Les formes', 0.7),
        makeDoc('3', 'Algebre', 'Les equations', 0.6),
        makeDoc('4', 'Stats', 'Les stats', 0.5),
        makeDoc('5', 'Proba', 'Les probabilites', 0.4),
        makeDoc('6', 'Trigo', 'La trigonometrie', 0.3),
      ];

      const result = rerankWithBm25Rrf('fractions', docs, 3);
      // Doc 1 should have non-zero BM25 score (contains "fractions")
      const fractionsDoc = result.find(r => r.id === '1');
      expect(fractionsDoc?.bm25_score).toBeGreaterThan(0);
    });
  });
});
