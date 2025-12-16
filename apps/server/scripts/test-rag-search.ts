#!/usr/bin/env bun
/**
 * Test de recherche RAG - Vérification fonctionnelle
 *
 * Teste les requêtes problématiques identifiées précédemment
 */

import { denseSearch, isQdrantRAGEnabled, QDRANT_CONFIG } from '../src/services/qdrant/index.js';
import { ragService } from '../src/services/rag.service.js';

const TEST_QUERIES = [
  { query: 'proportionnalité', matiere: 'mathematiques' },
  { query: 'fractions et calcul', matiere: 'mathematiques' },
  { query: 'conjugaison des verbes', matiere: 'francais' },
  { query: 'la Révolution française', matiere: 'histoire_geo' },
  { query: 'cellule et organisme', matiere: 'svt' },
];

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TEST RECHERCHE RAG - 5ème');
  console.log('='.repeat(60) + '\n');

  // Check RAG availability
  if (!isQdrantRAGEnabled()) {
    console.error('❌ RAG Qdrant non configuré');
    process.exit(1);
  }

  const thresholds = ragService.getThresholds();
  console.log('📊 Thresholds configurés:');
  console.log(`   MIN_SCORE: ${thresholds.MIN_SCORE} (inclusion)`);
  console.log(`   GOOD_SCORE: ${thresholds.GOOD_SCORE} (validation)`);
  console.log(`   EXCELLENT_SCORE: ${thresholds.EXCELLENT_SCORE} (excellent)\n`);

  console.log('🔍 Tests de recherche:\n');

  for (const test of TEST_QUERIES) {
    console.log(`Query: "${test.query}" (${test.matiere})`);
    console.log('-'.repeat(50));

    try {
      const results = await denseSearch({
        query: test.query,
        niveau: 'cinquieme',
        matiere: test.matiere,
        limit: 3,
      });

      if (results.length === 0) {
        console.log('   ❌ Aucun résultat trouvé');
      } else {
        const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
        const validationStatus = avgScore >= thresholds.GOOD_SCORE ? '✅ VALIDE' : '⚠️ Score faible';

        console.log(`   📦 ${results.length} résultats trouvés`);
        console.log(`   📈 Score moyen: ${(avgScore * 100).toFixed(1)}% ${validationStatus}`);
        console.log(`   🏆 Top score: ${(results[0]!.score * 100).toFixed(1)}%`);
        console.log(`   📝 Top result: "${results[0]!.payload.title?.substring(0, 50)}..."`);
      }
    } catch (error) {
      console.log(`   ❌ Erreur: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log();
  }

  // Test full RAG service pipeline
  console.log('='.repeat(60));
  console.log('🔬 TEST PIPELINE RAG COMPLET (hybridSearch)');
  console.log('='.repeat(60) + '\n');

  const fullTest = await ragService.hybridSearch({
    query: 'proportionnalité',
    niveau: 'cinquieme',
    matiere: 'mathematiques',
  });

  console.log(`Strategy: ${fullTest.strategy}`);
  console.log(`Results: ${fullTest.semanticChunks.length}`);
  console.log(`Average Similarity: ${(fullTest.averageSimilarity * 100).toFixed(1)}%`);
  console.log(`Search Time: ${fullTest.searchTime}ms`);
  console.log(`Context length: ${fullTest.context.length} chars`);

  if (fullTest.averageSimilarity >= thresholds.GOOD_SCORE) {
    console.log('\n✅ VALIDATION RÉUSSIE - Le topic serait accepté pour générer des flashcards');
  } else {
    console.log('\n⚠️ VALIDATION ÉCHOUÉE - Score insuffisant');
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

main().catch((err) => {
  console.error('Erreur:', err);
  process.exit(1);
});
