#!/usr/bin/env bun
/**
 * Script de réindexation Qdrant - Multi-niveaux
 *
 * Réindexe tous les documents JSONL avec le modèle d'embedding actuel
 * (mistral-embed 1024D avec normalisation - Migration Jan 2025)
 *
 * Supporte automatiquement tous les niveaux présents dans tomai-curriculum:
 * - Collège: sixieme, cinquieme, quatrieme, troisieme (cycle 3-4)
 * - Lycée: seconde, premiere, terminale (cycle lycée)
 *
 * Usage:
 *   bun run scripts/reindex-qdrant.ts              # Réindexe tout
 *   bun run scripts/reindex-qdrant.ts --niveau=cinquieme  # Un seul niveau
 *   bun run scripts/reindex-qdrant.ts --add        # Ajoute sans supprimer
 *
 * @see https://qdrant.tech/documentation/concepts/points/
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import {
  deleteCollection,
  createCollection,
  getCollectionStats,
  upsertPoints,
  QDRANT_CONFIG,
  checkQdrantHealth,
} from '../src/services/qdrant/index.js';
import { mistralEmbeddingsService } from '../src/services/mistral-embeddings.service.js';
import type { DocumentToIndex } from '../src/services/qdrant/types.js';
import type { EducationLevelType } from '../src/types/index.js';
import { createHash } from 'crypto';

// ============================================
// CONFIGURATION
// ============================================

interface JsonlDocument {
  title: string;
  domaine: string;
  sousdomaine?: string;
  content_type: string;
  difficulty?: string;
  content: string;
  keywords?: string[];
  prerequis?: string[];
}

interface NiveauConfig {
  niveau: string;
  cycle: string;
  path: string;
}

const CURRICULUM_BASE = join(__dirname, '../../tomai-curriculum/data/processed');
const BATCH_SIZE = 20; // Batches pour éviter rate limits Mistral

// Mapping niveau → cycle
const NIVEAU_CYCLES: Record<string, string> = {
  // Collège
  sixieme: 'cycle3',
  cinquieme: 'cycle4',
  quatrieme: 'cycle4',
  troisieme: 'cycle4',
  // Lycée
  seconde: 'lycee',
  premiere: 'lycee',
  terminale: 'lycee',
};

// ============================================
// HELPERS
// ============================================

/**
 * Génère un ID déterministe unique (UUID v5-like)
 * Garantit: même niveau+matiere+titre = même ID (idempotent)
 */
function generateId(niveau: string, matiere: string, title: string): string {
  const hash = createHash('md5')
    .update(`${niveau}-${matiere}-${title}`)
    .digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

/**
 * Découvre automatiquement tous les niveaux disponibles
 */
function discoverNiveaux(): NiveauConfig[] {
  const niveaux: NiveauConfig[] = [];

  const cycles = ['college', 'lycee'];
  for (const cycleDir of cycles) {
    const cyclePath = join(CURRICULUM_BASE, cycleDir);
    if (!existsSync(cyclePath)) continue;

    const niveauDirs = readdirSync(cyclePath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const niveau of niveauDirs) {
      const niveauPath = join(cyclePath, niveau);
      const hasJsonl = readdirSync(niveauPath).some((f) => f.endsWith('.jsonl'));

      if (hasJsonl) {
        niveaux.push({
          niveau,
          cycle: NIVEAU_CYCLES[niveau] ?? cycleDir,
          path: niveauPath,
        });
      }
    }
  }

  return niveaux;
}

/**
 * Charge les fichiers JSONL d'un niveau
 */
function loadJsonlFiles(niveauPath: string): { matiere: string; docs: JsonlDocument[] }[] {
  const files = readdirSync(niveauPath).filter((f) => f.endsWith('.jsonl'));
  const result: { matiere: string; docs: JsonlDocument[] }[] = [];

  for (const file of files) {
    const matiere = basename(file, '.jsonl');
    const content = readFileSync(join(niveauPath, file), 'utf-8');
    const lines = content.trim().split('\n').filter((l) => l.length > 0);
    const docs = lines.map((line) => JSON.parse(line) as JsonlDocument);
    result.push({ matiere, docs });
  }

  return result;
}

/**
 * Parse les arguments CLI
 */
function parseArgs(): { niveauFilter?: string; addOnly: boolean } {
  const args = process.argv.slice(2);
  let niveauFilter: string | undefined;
  let addOnly = false;

  for (const arg of args) {
    if (arg.startsWith('--niveau=')) {
      niveauFilter = arg.split('=')[1];
    } else if (arg === '--add') {
      addOnly = true;
    }
  }

  return { niveauFilter, addOnly };
}

// ============================================
// MAIN
// ============================================

async function main() {
  const { niveauFilter, addOnly } = parseArgs();

  console.log('\n' + '='.repeat(60));
  console.log('🔄 RÉINDEXATION QDRANT - Multi-niveaux');
  console.log('='.repeat(60) + '\n');

  // 1. Check health
  console.log('[1/5] Vérification connexion Qdrant...');
  const isHealthy = await checkQdrantHealth();
  if (!isHealthy) {
    console.error('❌ Qdrant non accessible');
    process.exit(1);
  }
  console.log('✅ Qdrant connecté\n');

  // 2. Discover niveaux
  console.log('[2/5] Découverte des niveaux disponibles...');
  let niveaux = discoverNiveaux();

  if (niveauFilter) {
    niveaux = niveaux.filter((n) => n.niveau === niveauFilter);
    if (niveaux.length === 0) {
      console.error(`❌ Niveau "${niveauFilter}" non trouvé`);
      console.log('   Niveaux disponibles:', discoverNiveaux().map((n) => n.niveau).join(', '));
      process.exit(1);
    }
  }

  console.log(`   📚 ${niveaux.length} niveau(x) à indexer:`);
  for (const n of niveaux) {
    console.log(`      • ${n.niveau} (${n.cycle})`);
  }
  console.log();

  // 3. Load all documents
  console.log('[3/5] Chargement des documents...');

  interface NiveauData {
    niveau: string;
    cycle: string;
    matieres: { matiere: string; docs: JsonlDocument[] }[];
    totalDocs: number;
  }

  const allNiveauxData: NiveauData[] = [];
  let grandTotal = 0;

  for (const niveauConfig of niveaux) {
    const matieres = loadJsonlFiles(niveauConfig.path);
    const totalDocs = matieres.reduce((sum, m) => sum + m.docs.length, 0);
    grandTotal += totalDocs;

    allNiveauxData.push({
      niveau: niveauConfig.niveau,
      cycle: niveauConfig.cycle,
      matieres,
      totalDocs,
    });

    console.log(`   📖 ${niveauConfig.niveau}: ${matieres.length} matières, ${totalDocs} documents`);
  }

  console.log(`\n   📊 TOTAL: ${grandTotal} documents\n`);

  // 4. Collection management
  if (!addOnly) {
    console.log('[4/5] Recréation de la collection...');
    try {
      await deleteCollection();
      console.log('   ✓ Collection supprimée');
    } catch {
      console.log('   ⚠️ Collection n\'existait pas');
    }
    await createCollection();
    console.log('   ✓ Collection recréée\n');
  } else {
    console.log('[4/5] Mode --add: conservation de la collection existante\n');
  }

  // 5. Generate embeddings and upsert
  console.log('[5/5] Génération des embeddings et indexation...\n');

  let totalIndexed = 0;
  let totalErrors = 0;
  const startTime = Date.now();

  for (const niveauData of allNiveauxData) {
    console.log(`\n   📚 ${niveauData.niveau.toUpperCase()} (${niveauData.cycle})`);
    console.log('   ' + '-'.repeat(40));

    for (const { matiere, docs } of niveauData.matieres) {
      console.log(`   📦 ${matiere} (${docs.length} docs)...`);

      // Process in batches
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = docs.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(docs.length / BATCH_SIZE);

        if (totalBatches > 1) {
          process.stdout.write(`      Batch ${batchNum}/${totalBatches}... `);
        }

        const documentsToIndex: DocumentToIndex[] = [];
        const embeddings: number[][] = [];

        for (const doc of batch) {
          const id = generateId(niveauData.niveau, matiere, doc.title);

          // Generate embedding
          const embResult = await mistralEmbeddingsService.generateEmbedding(doc.content);

          if (!embResult.success) {
            console.warn(`\n      ⚠️ Embedding failed: ${doc.title}`);
            totalErrors++;
            continue;
          }

          documentsToIndex.push({
            id,
            content: doc.content,
            payload: {
              title: doc.title,
              content: doc.content,
              niveau: niveauData.niveau as EducationLevelType,
              matiere,
              cycle: niveauData.cycle,
              domaine: doc.domaine,
              sousdomaine: doc.sousdomaine ?? '',
              source: 'eduscol',
              sourceUrl: 'https://eduscol.education.fr',
            },
          });

          embeddings.push(embResult.embedding);
        }

        // Upsert batch
        if (documentsToIndex.length > 0) {
          await upsertPoints(documentsToIndex, embeddings);
          totalIndexed += documentsToIndex.length;
        }

        if (totalBatches > 1) {
          console.log('✓');
        }

        // Rate limit pause
        await new Promise((r) => setTimeout(r, 500));
      }

      console.log(`      ✓ ${docs.length} documents`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  // Final stats
  console.log('\n' + '='.repeat(60));
  console.log('[6/6] Vérification finale...\n');

  const stats = await getCollectionStats();
  if (stats) {
    console.log(`   Collection: ${QDRANT_CONFIG.collection.name}`);
    console.log(`   Points totaux: ${stats.pointsCount}`);
    console.log(`   Status: ${stats.status}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ RÉINDEXATION TERMINÉE');
  console.log('='.repeat(60));
  console.log(`   ⏱️ Durée: ${duration}s`);
  console.log(`   📄 Documents indexés: ${totalIndexed}/${grandTotal}`);
  if (totalErrors > 0) {
    console.log(`   ⚠️ Erreurs: ${totalErrors}`);
  }
  console.log(`   🔢 Modèle: mistral-embed (1024D, normalisé)`);
  console.log(`   📚 Niveaux: ${niveaux.map((n) => n.niveau).join(', ')}`);
  console.log('='.repeat(60) + '\n');
}

main().catch((err) => {
  console.error('Erreur:', err);
  process.exit(1);
});
