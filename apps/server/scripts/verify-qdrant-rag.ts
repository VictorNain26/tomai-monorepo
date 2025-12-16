#!/usr/bin/env bun
/**
 * Script de vérification RAG Qdrant - Multi-niveaux
 *
 * Vérifie:
 * 1. Connexion Qdrant
 * 2. Nombre de documents par niveau/matière
 * 3. Comparaison avec dataset tomai-curriculum
 *
 * Usage:
 *   bun run scripts/verify-qdrant-rag.ts           # Vérifie tout
 *   bun run scripts/verify-qdrant-rag.ts cinquieme # Un seul niveau
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { getQdrantClient, checkQdrantHealth, getCollectionStats, QDRANT_CONFIG } from '../src/services/qdrant/index.js';

const CURRICULUM_BASE = join(__dirname, '../../tomai-curriculum/data/processed');

interface ExpectedCounts {
  niveau: string;
  cycle: string;
  matieres: Record<string, number>;
  total: number;
}

/**
 * Compte les documents dans les fichiers JSONL
 */
function countExpectedDocuments(): ExpectedCounts[] {
  const results: ExpectedCounts[] = [];

  const cycles = ['college', 'lycee'];
  for (const cycleDir of cycles) {
    const cyclePath = join(CURRICULUM_BASE, cycleDir);
    if (!existsSync(cyclePath)) continue;

    const niveauDirs = readdirSync(cyclePath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const niveau of niveauDirs) {
      const niveauPath = join(cyclePath, niveau);
      const files = readdirSync(niveauPath).filter((f) => f.endsWith('.jsonl'));

      if (files.length === 0) continue;

      const matieres: Record<string, number> = {};
      let total = 0;

      for (const file of files) {
        const matiere = basename(file, '.jsonl');
        const content = readFileSync(join(niveauPath, file), 'utf-8');
        const count = content.trim().split('\n').filter((l) => l.length > 0).length;
        matieres[matiere] = count;
        total += count;
      }

      results.push({
        niveau,
        cycle: cycleDir === 'college' ? 'cycle4' : 'lycee',
        matieres,
        total,
      });
    }
  }

  return results;
}

async function main() {
  const niveauFilter = process.argv[2];

  console.log('\n' + '='.repeat(60));
  console.log('🔍 VÉRIFICATION RAG QDRANT - Multi-niveaux');
  console.log('='.repeat(60) + '\n');

  // 1. Check health
  console.log('[1/3] Vérification connexion Qdrant...');
  const isHealthy = await checkQdrantHealth();

  if (!isHealthy) {
    console.error('❌ Qdrant non accessible');
    process.exit(1);
  }
  console.log('✅ Qdrant connecté\n');

  // 2. Get collection stats
  console.log('[2/3] Récupération statistiques collection...');
  const stats = await getCollectionStats();

  if (!stats) {
    console.error('❌ Collection non trouvée');
    process.exit(1);
  }

  console.log(`   Collection: ${QDRANT_CONFIG.collection.name}`);
  console.log(`   Points totaux: ${stats.pointsCount}`);
  console.log(`   Status: ${stats.status}\n`);

  // 3. Count expected vs actual
  console.log('[3/3] Comparaison avec dataset tomai-curriculum...\n');

  let expectedData = countExpectedDocuments();

  if (niveauFilter) {
    expectedData = expectedData.filter((e) => e.niveau === niveauFilter);
    if (expectedData.length === 0) {
      console.error(`❌ Niveau "${niveauFilter}" non trouvé dans le dataset`);
      process.exit(1);
    }
  }

  const client = getQdrantClient();
  let grandTotalExpected = 0;
  let grandTotalActual = 0;
  let allMatch = true;

  for (const expected of expectedData) {
    console.log(`📚 ${expected.niveau.toUpperCase()} (${expected.cycle})`);
    console.log('-'.repeat(50));

    let niveauActual = 0;

    for (const [matiere, expectedCount] of Object.entries(expected.matieres)) {
      const result = await client.count(QDRANT_CONFIG.collection.name, {
        filter: {
          must: [
            { key: 'niveau', match: { value: expected.niveau } },
            { key: 'matiere', match: { value: matiere } },
          ],
        },
        exact: true,
      });

      const actualCount = result.count;
      niveauActual += actualCount;
      const status = actualCount === expectedCount ? '✅' : '❌';

      if (actualCount !== expectedCount) {
        allMatch = false;
      }

      console.log(`   ${status} ${matiere.padEnd(15)} : ${actualCount}/${expectedCount}`);
    }

    console.log('-'.repeat(50));
    console.log(`   TOTAL ${expected.niveau}: ${niveauActual}/${expected.total}\n`);

    grandTotalExpected += expected.total;
    grandTotalActual += niveauActual;
  }

  // Final verdict
  console.log('='.repeat(60));
  console.log(`📊 TOTAL GLOBAL: ${grandTotalActual}/${grandTotalExpected}`);
  console.log('='.repeat(60));

  if (allMatch && grandTotalActual === grandTotalExpected) {
    console.log('\n✅ RAG 100% COMPLET !');
    console.log('   Tous les documents du programme scolaire sont indexés.\n');
  } else if (grandTotalActual === 0) {
    console.log('\n❌ RAG VIDE - Aucun document indexé');
    console.log('   Exécutez: bun run scripts/reindex-qdrant.ts\n');
  } else {
    console.log(`\n⚠️ RAG INCOMPLET: ${grandTotalActual}/${grandTotalExpected} documents`);
    console.log('   Certains documents manquent. Vérifiez l\'ingestion.\n');
  }
}

main().catch((err) => {
  console.error('Erreur:', err);
  process.exit(1);
});
