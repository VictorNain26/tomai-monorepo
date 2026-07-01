/**
 * Non-régression audit 2026-07-01 P0 n°1 : le gate de génération de flashcards
 * comparait averageSimilarity (scores RRF ≈ 0.02) à un seuil cosine calibré
 * à 0.5 → 400 TOPIC_NOT_IN_CURRICULUM systématique en mode qdrant-hybrid-rrf.
 * Le gate ne doit dépendre QUE de la présence de résultats, jamais de la
 * magnitude des scores RRF.
 */

import { describe, it, expect } from 'bun:test';
import { evaluateRagGate } from '../routes/learning/helpers';

const chunk = (score: number) => ({
  id: 'c1',
  score,
  text: 'Les fractions au programme de sixième',
  section: 'Nombres et calculs',
  matiere: 'maths',
  niveau: 'sixieme',
});

describe('evaluateRagGate', () => {
  it('passes with realistic RRF-scale scores (regression: was rejected by cosine threshold)', () => {
    const result = evaluateRagGate({
      strategy: 'qdrant-hybrid-rrf',
      semanticChunks: [chunk(0.016), chunk(0.015), chunk(0.014)],
    });
    expect(result).toEqual({ ok: true });
  });

  it('passes with rerank strategy too', () => {
    const result = evaluateRagGate({
      strategy: 'qdrant-hybrid-rrf+rerank-bge-m3',
      semanticChunks: [chunk(0.92)],
    });
    expect(result).toEqual({ ok: true });
  });

  it('returns 503 when the RAG service is disabled', () => {
    const result = evaluateRagGate({ strategy: 'disabled', semanticChunks: [] });
    expect(result).toEqual({ ok: false, reason: 'rag_disabled', httpStatus: 503 });
  });

  it('returns 400 when the curriculum has no match', () => {
    const result = evaluateRagGate({ strategy: 'qdrant-hybrid-rrf', semanticChunks: [] });
    expect(result).toEqual({ ok: false, reason: 'no_results', httpStatus: 400 });
  });
});
