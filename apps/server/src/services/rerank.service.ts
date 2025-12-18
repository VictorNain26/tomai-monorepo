/**
 * Reranking Service - BM25 + RRF (Reciprocal Rank Fusion)
 *
 * Porté depuis scripts/rerank.py du curriculum.
 * Combine ranking vectoriel (embeddings) avec BM25 lexical.
 */

import type { QdrantSearchResult } from './qdrant.service.js';

// =============================================================================
// BM25
// =============================================================================

/**
 * Tokenize un texte français pour BM25
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .match(/[a-zàâäéèêëïîôùûüÿœæç0-9]+/g) ?? [];
}

/**
 * Calcule les scores BM25 pour une liste de documents
 */
function computeBm25Scores(
  query: string,
  documents: QdrantSearchResult[],
  k1: number = 1.5,
  b: number = 0.75
): number[] {
  if (documents.length === 0) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return documents.map(() => 0);
  }

  // Tokenize tous les documents
  const docTokensList = documents.map((doc) => {
    const text = `${doc.title} ${doc.content}`;
    return tokenize(text);
  });

  // Statistiques du corpus
  const nDocs = documents.length;
  const avgdl = docTokensList.reduce((sum, tokens) => sum + tokens.length, 0) / nDocs;

  // Document frequency pour chaque terme de la query
  const df = new Map<string, number>();
  for (const tokens of docTokensList) {
    const uniqueTerms = new Set(tokens);
    for (const term of queryTokens) {
      if (uniqueTerms.has(term)) {
        df.set(term, (df.get(term) ?? 0) + 1);
      }
    }
  }

  // Calculer les scores BM25
  return docTokensList.map((docTokens) => {
    if (docTokens.length === 0) return 0;

    const docLen = docTokens.length;
    const termFreq = new Map<string, number>();
    for (const token of docTokens) {
      termFreq.set(token, (termFreq.get(token) ?? 0) + 1);
    }

    let score = 0;
    for (const term of queryTokens) {
      const tf = termFreq.get(term) ?? 0;
      if (tf === 0) continue;

      const termDf = df.get(term) ?? 0;
      // IDF: log((N - df + 0.5) / (df + 0.5) + 1)
      const idf = Math.log((nDocs - termDf + 0.5) / (termDf + 0.5) + 1);
      // TF normalisé
      const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * docLen / avgdl));
      score += idf * tfNorm;
    }

    return score;
  });
}

// =============================================================================
// RRF (Reciprocal Rank Fusion)
// =============================================================================

/**
 * Fusion de rangs avec RRF
 * Formule: RRF(d) = Σ 1/(k + rank(d))
 */
function reciprocalRankFusion(
  rankings: Array<Array<[number, number]>>, // [(docIdx, score), ...]
  k: number = 60
): Array<[number, number]> {
  const rrfScores = new Map<number, number>();

  for (const ranking of rankings) {
    for (let rank = 0; rank < ranking.length; rank++) {
      const [docIdx] = ranking[rank];
      const current = rrfScores.get(docIdx) ?? 0;
      rrfScores.set(docIdx, current + 1 / (k + rank + 1));
    }
  }

  // Trier par score décroissant
  return Array.from(rrfScores.entries())
    .sort((a, b) => b[1] - a[1]);
}

// =============================================================================
// Reranking principal
// =============================================================================

export interface RerankedResult extends QdrantSearchResult {
  bm25_score?: number;
  rrf_score: number;
  final_score: number;
}

/**
 * Reranking hybride avec BM25 + RRF
 */
export function rerankWithBm25Rrf(
  query: string,
  results: QdrantSearchResult[],
  topK: number = 5
): RerankedResult[] {
  if (results.length === 0) return [];
  if (results.length <= topK) {
    return results.map((r) => ({
      ...r,
      rrf_score: r.score,
      final_score: r.score,
    }));
  }

  // Ranking 1: Score vectoriel
  const vectorRanking: Array<[number, number]> = results
    .map((r, i) => [i, r.score] as [number, number])
    .sort((a, b) => b[1] - a[1]);

  // Ranking 2: BM25
  const bm25Scores = computeBm25Scores(query, results);
  const bm25Ranking: Array<[number, number]> = bm25Scores
    .map((score, i) => [i, score] as [number, number])
    .sort((a, b) => b[1] - a[1]);

  // Fusion RRF
  const rrfResults = reciprocalRankFusion([vectorRanking, bm25Ranking]);

  // Reconstruire la liste ordonnée
  const reranked: RerankedResult[] = rrfResults
    .slice(0, topK)
    .map(([docIdx, rrfScore]) => ({
      ...results[docIdx],
      bm25_score: bm25Scores[docIdx],
      rrf_score: rrfScore,
      final_score: rrfScore,
    }));

  return reranked;
}

/**
 * Reranking simple sans BM25 (juste tri par score vectoriel)
 */
export function rerankByScore(
  results: QdrantSearchResult[],
  topK: number = 5
): RerankedResult[] {
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((r) => ({
      ...r,
      rrf_score: r.score,
      final_score: r.score,
    }));
}
