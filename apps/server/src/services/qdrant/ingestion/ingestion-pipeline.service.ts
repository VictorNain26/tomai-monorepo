/**
 * Ingestion Pipeline Service - Pipeline d'indexation Qdrant
 *
 * Architecture simplifiée 2025:
 * 1. Validation des documents sources
 * 2. Chunking sémantique avec enrichissement contextuel
 * 3. Génération d'embeddings Mistral 1024D (dense uniquement)
 * 4. Upsert batch dans Qdrant
 *
 * Migration Gemini → Mistral (Janvier 2025)
 *
 * Note: Sparse vectors conservés pour rétro-compatibilité mais non utilisés en recherche
 */

import type { RawDocument, IngestionStats, SubjectType } from '../curriculum/types.js';
import { chunkDocuments } from './chunking.service.js';
import { mistralEmbeddingsService } from '../../mistral-embeddings.service.js';
import { upsertPoints, getCollectionStats, createCollection, checkQdrantHealth } from '../qdrant-client.service.js';
import { CHUNKING_OPTIONS } from '../curriculum/config-5eme.js';
import type { DocumentToIndex } from '../types.js';

/**
 * Options du pipeline d'ingestion
 */
export interface IngestionPipelineOptions {
  batchSize?: number; // Taille des batches pour Qdrant (défaut: 100)
  useContextualizedContent?: boolean; // Utilise contenu enrichi pour embeddings (défaut: true)
  dryRun?: boolean; // Mode simulation sans upsert (défaut: false)
  verbose?: boolean; // Logs détaillés (défaut: true)
}

/**
 * Résultat du pipeline d'ingestion
 */
export interface IngestionPipelineResult {
  success: boolean;
  stats: IngestionStats;
  errors: Array<{ documentId: string; error: string }>;
  collectionStats: {
    pointsCount: number;
    status: string;
  } | null;
}

/**
 * Logger conditionnel
 */
function log(message: string, verbose: boolean = true): void {
  if (verbose) {
    console.log(`[Ingestion] ${message}`);
  }
}

/**
 * Valide un document brut
 */
function validateDocument(doc: RawDocument): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!doc.id || doc.id.trim().length === 0) {
    errors.push('Document ID is required');
  }

  if (!doc.title || doc.title.trim().length === 0) {
    errors.push('Document title is required');
  }

  if (!doc.content || doc.content.trim().length === 0) {
    errors.push('Document content is required');
  }

  if (!doc.niveau) {
    errors.push('Document niveau is required');
  }

  if (!doc.matiere) {
    errors.push('Document matiere is required');
  }

  if (!doc.cycle) {
    errors.push('Document cycle is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Exécute le pipeline d'ingestion complet
 */
export async function runIngestionPipeline(
  documents: RawDocument[],
  options: IngestionPipelineOptions = {}
): Promise<IngestionPipelineResult> {
  const {
    batchSize = 100,
    useContextualizedContent = true,
    dryRun = false,
    verbose = true,
  } = options;

  const startTime = new Date();
  const errors: Array<{ documentId: string; error: string }> = [];

  const stats: IngestionStats = {
    documentsProcessed: 0,
    chunksCreated: 0,
    tokensTotal: 0,
    errorCount: 0,
    startTime,
    bySubject: {} as Record<SubjectType, { documents: number; chunks: number; tokens: number }>,
  };

  log(`\n${'='.repeat(60)}`, verbose);
  log(`🚀 PIPELINE D'INGESTION QDRANT`, verbose);
  log(`${'='.repeat(60)}`, verbose);
  log(`📄 Documents à traiter: ${documents.length}`, verbose);
  log(`📦 Taille des batches: ${batchSize}`, verbose);
  log(`🔍 Mode: ${dryRun ? 'SIMULATION (dry-run)' : 'PRODUCTION'}`, verbose);
  log(``, verbose);

  // Step 1: Vérifier la connexion Qdrant
  if (!dryRun) {
    log(`[1/5] 🔗 Vérification connexion Qdrant...`, verbose);
    const isHealthy = await checkQdrantHealth();
    if (!isHealthy) {
      log(`❌ Qdrant non accessible - tentative de création de collection...`, verbose);
      try {
        await createCollection();
        log(`✅ Collection créée avec succès`, verbose);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          stats,
          errors: [{ documentId: 'system', error: `Qdrant connection failed: ${msg}` }],
          collectionStats: null,
        };
      }
    } else {
      log(`✅ Qdrant connecté`, verbose);
    }
  }

  // Step 2: Valider les documents
  log(`[2/5] ✅ Validation des documents...`, verbose);
  const validDocuments: RawDocument[] = [];

  for (const doc of documents) {
    const validation = validateDocument(doc);
    if (validation.valid) {
      validDocuments.push(doc);
    } else {
      errors.push({
        documentId: doc.id || 'unknown',
        error: `Validation failed: ${validation.errors.join(', ')}`,
      });
      stats.errorCount++;
    }
  }

  log(`   ✓ ${validDocuments.length}/${documents.length} documents valides`, verbose);
  if (errors.length > 0) {
    log(`   ⚠️  ${errors.length} documents rejetés`, verbose);
  }

  if (validDocuments.length === 0) {
    return {
      success: false,
      stats,
      errors,
      collectionStats: null,
    };
  }

  // Step 3: Chunking des documents
  log(`[3/5] ✂️  Chunking sémantique...`, verbose);
  const { allChunks, totalStats } = await chunkDocuments(validDocuments, CHUNKING_OPTIONS);

  stats.documentsProcessed = totalStats.documentsProcessed;
  stats.chunksCreated = totalStats.totalChunks;
  stats.tokensTotal = totalStats.totalTokens;

  log(`   ✓ ${totalStats.totalChunks} chunks créés`, verbose);
  log(`   ✓ ${totalStats.totalTokens} tokens total`, verbose);
  log(`   ✓ ~${totalStats.avgTokensPerChunk} tokens/chunk en moyenne`, verbose);

  // Statistiques par matière
  for (const doc of validDocuments) {
    if (!stats.bySubject[doc.matiere]) {
      stats.bySubject[doc.matiere] = { documents: 0, chunks: 0, tokens: 0 };
    }
    stats.bySubject[doc.matiere].documents++;
  }

  for (const chunk of allChunks) {
    const matiere = chunk.metadata.matiere;
    if (stats.bySubject[matiere]) {
      stats.bySubject[matiere].chunks++;
      stats.bySubject[matiere].tokens += chunk.tokenCount;
    }
  }

  // Step 4: Génération des embeddings
  log(`[4/5] 🧠 Génération des embeddings...`, verbose);

  const textsToEmbed = allChunks.map((chunk) =>
    useContextualizedContent && chunk.contextualizedContent
      ? chunk.contextualizedContent
      : chunk.content
  );

  const embeddingResults = await mistralEmbeddingsService.batchEmbedTexts(textsToEmbed, batchSize);

  const successfulEmbeddings = embeddingResults.filter((r) => r.success);
  const failedEmbeddings = embeddingResults.filter((r) => !r.success);

  log(`   ✓ ${successfulEmbeddings.length}/${embeddingResults.length} embeddings générés`, verbose);
  if (failedEmbeddings.length > 0) {
    log(`   ⚠️  ${failedEmbeddings.length} embeddings en échec (fallback utilisé)`, verbose);
  }

  // Step 5: Préparation et upsert Qdrant
  log(`[5/5] 📤 Upsert vers Qdrant...`, verbose);

  if (dryRun) {
    log(`   ⏭️  Mode dry-run: upsert ignoré`, verbose);
  } else {
    // Préparer les données pour Qdrant
    const documentsToIndex: DocumentToIndex[] = [];
    const denseVectors: number[][] = [];

    for (let i = 0; i < allChunks.length; i++) {
      const chunk = allChunks[i]!;
      const embeddingResult = embeddingResults[i]!;

      documentsToIndex.push({
        id: chunk.id,
        content: chunk.content,
        payload: {
          title: chunk.metadata.title,
          content: chunk.content,
          niveau: chunk.metadata.niveau,
          matiere: chunk.metadata.matiere,
          cycle: chunk.metadata.cycle,
          domaine: chunk.metadata.domaine,
          sousdomaine: chunk.metadata.sousdomaine,
          source: chunk.metadata.source,
          sourceUrl: chunk.metadata.sourceUrl,
        },
      });

      denseVectors.push(embeddingResult.embedding);
    }

    // Upsert par batches
    for (let i = 0; i < documentsToIndex.length; i += batchSize) {
      const batchDocs = documentsToIndex.slice(i, i + batchSize);
      const batchDense = denseVectors.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(documentsToIndex.length / batchSize);

      log(`   📦 Batch ${batchNum}/${totalBatches}: ${batchDocs.length} points...`, verbose);

      try {
        await upsertPoints(batchDocs, batchDense);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push({
          documentId: `batch_${batchNum}`,
          error: `Upsert failed: ${msg}`,
        });
        stats.errorCount++;
        log(`   ❌ Batch ${batchNum} échoué: ${msg}`, verbose);
      }
    }

    log(`   ✓ Upsert terminé`, verbose);
  }

  // Finalisation
  stats.endTime = new Date();
  const durationMs = stats.endTime.getTime() - stats.startTime.getTime();

  // Récupérer stats collection
  let collectionStats: { pointsCount: number; status: string } | null = null;
  if (!dryRun) {
    const qdrantStats = await getCollectionStats();
    if (qdrantStats) {
      collectionStats = {
        pointsCount: qdrantStats.pointsCount,
        status: qdrantStats.status,
      };
    }
  }

  log(``, verbose);
  log(`${'='.repeat(60)}`, verbose);
  log(`✅ PIPELINE TERMINÉ`, verbose);
  log(`${'='.repeat(60)}`, verbose);
  log(`⏱️  Durée: ${(durationMs / 1000).toFixed(2)}s`, verbose);
  log(`📄 Documents traités: ${stats.documentsProcessed}`, verbose);
  log(`✂️  Chunks créés: ${stats.chunksCreated}`, verbose);
  log(`🔢 Tokens total: ${stats.tokensTotal}`, verbose);
  if (collectionStats) {
    log(`📊 Collection Qdrant: ${collectionStats.pointsCount} points (${collectionStats.status})`, verbose);
  }
  if (stats.errorCount > 0) {
    log(`⚠️  Erreurs: ${stats.errorCount}`, verbose);
  }
  log(``, verbose);

  // Détail par matière
  log(`📚 Répartition par matière:`, verbose);
  for (const [matiere, data] of Object.entries(stats.bySubject)) {
    log(`   • ${matiere}: ${data.documents} docs, ${data.chunks} chunks, ${data.tokens} tokens`, verbose);
  }

  return {
    success: stats.errorCount === 0,
    stats,
    errors,
    collectionStats,
  };
}

/**
 * Réindexe un document existant (supprime + réinsère)
 */
export async function reindexDocument(
  document: RawDocument,
  options: IngestionPipelineOptions = {}
): Promise<IngestionPipelineResult> {
  // Pour l'instant, on utilise simplement le pipeline standard
  // L'upsert Qdrant gère automatiquement le remplacement
  return runIngestionPipeline([document], options);
}

/**
 * Compte le nombre de points dans la collection
 */
export async function getIngestionStats(): Promise<{
  pointsCount: number;
  status: string;
  byMatiere?: Record<string, number>;
} | null> {
  const stats = await getCollectionStats();
  if (!stats) return null;

  return {
    pointsCount: stats.pointsCount,
    status: stats.status,
  };
}
