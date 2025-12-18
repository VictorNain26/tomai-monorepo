/**
 * RAG Search Server Tool - TanStack AI
 *
 * Server Tool pour recherche sémantique dans les programmes officiels.
 * Permet à l'AI d'accéder aux contenus éducatifs Qdrant.
 *
 * @see https://tanstack.com/ai/latest/docs/guides/server-tools
 */

import { toolDefinition } from '@tanstack/ai';
import { z } from 'zod';
import { ragService } from '../../../services/rag.service.js';
import { logger } from '../../observability.js';
import type { EducationLevelType } from '../../../types/education.types.js';

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS ZOD
// ═══════════════════════════════════════════════════════════════════════════

/** Schema d'entrée pour la recherche RAG */
const RAGSearchInputSchema = z.object({
  query: z
    .string()
    .min(3)
    .max(500)
    .describe('La question ou le sujet à rechercher dans les programmes officiels'),
  niveau: z
    .enum([
      'cp', 'ce1', 'ce2', 'cm1', 'cm2',
      'sixieme', 'cinquieme', 'quatrieme', 'troisieme',
      'seconde', 'premiere', 'terminale'
    ])
    .describe('Le niveau scolaire de l\'élève (cp à terminale)'),
  matiere: z
    .string()
    .min(2)
    .max(50)
    .describe('La matière scolaire (mathematiques, francais, histoire, etc.)'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .default(5)
    .describe('Nombre maximum de résultats à retourner (1-10, défaut: 5)')
});

/** Schema de sortie pour un chunk sémantique */
const SemanticChunkSchema = z.object({
  id: z.string(),
  score: z.number().min(0).max(1),
  content: z.string(),
  title: z.string(),
  domaine: z.string().optional(),
  sousdomaine: z.string().optional()
});

/** Schema de sortie pour la recherche RAG */
const RAGSearchOutputSchema = z.object({
  found: z.boolean().describe('Indique si des résultats pertinents ont été trouvés'),
  context: z.string().describe('Contexte formaté des programmes officiels'),
  resultsCount: z.number().int().min(0),
  averageScore: z.number().min(0).max(1),
  bestMatchTitle: z.string().optional().describe('Titre du meilleur résultat'),
  bestMatchDomaine: z.string().optional().describe('Domaine du meilleur résultat'),
  chunks: z.array(SemanticChunkSchema).describe('Chunks sémantiques détaillés'),
  searchTimeMs: z.number().int()
});

// ═══════════════════════════════════════════════════════════════════════════
// TOOL DEFINITION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Définition du tool RAG Search
 *
 * Permet à l'AI de rechercher dans les programmes officiels français
 * pour fournir des réponses basées sur les contenus Éduscol.
 */
export const ragSearchToolDef = toolDefinition({
  name: 'search_educational_content',
  description: `Recherche dans les programmes officiels français (Éduscol).
Utilise cet outil pour trouver des informations précises sur les contenus éducatifs.
Retourne des extraits des programmes officiels avec leur source et pertinence.
IMPORTANT: Toujours utiliser avant de répondre à une question scolaire.`,
  inputSchema: RAGSearchInputSchema,
  outputSchema: RAGSearchOutputSchema
});

// ═══════════════════════════════════════════════════════════════════════════
// SERVER IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Implémentation serveur du tool RAG Search
 *
 * S'exécute côté serveur avec accès sécurisé à Qdrant.
 */
export const ragSearchTool = ragSearchToolDef.server(async (input) => {
  const startTime = Date.now();

  logger.info('RAG tool invoked', {
    query: input.query.substring(0, 50),
    niveau: input.niveau,
    matiere: input.matiere,
    limit: input.limit,
    operation: 'rag-tool-search'
  });

  try {
    // Vérifier disponibilité du service RAG
    const isAvailable = await ragService.isAvailable();
    if (!isAvailable) {
      logger.warn('RAG service unavailable', {
        operation: 'rag-tool-search'
      });

      return {
        found: false,
        context: '',
        resultsCount: 0,
        averageScore: 0,
        chunks: [],
        searchTimeMs: Date.now() - startTime
      };
    }

    // Exécuter la recherche hybride
    const result = await ragService.hybridSearch({
      query: input.query,
      niveau: input.niveau as EducationLevelType,
      matiere: input.matiere,
      limit: input.limit ?? 5
    });

    const searchTimeMs = Date.now() - startTime;

    logger.info('RAG tool search completed', {
      found: result.semanticChunks.length > 0,
      resultsCount: result.semanticChunks.length,
      avgScore: result.averageSimilarity.toFixed(3),
      searchTimeMs,
      operation: 'rag-tool-search-complete'
    });

    return {
      found: result.semanticChunks.length > 0,
      context: result.context,
      resultsCount: result.semanticChunks.length,
      averageScore: result.averageSimilarity,
      bestMatchTitle: result.bestMatchTitle,
      bestMatchDomaine: result.bestMatchDomaine,
      chunks: result.semanticChunks,
      searchTimeMs
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('RAG tool search failed', {
      _error: errorMessage,
      query: input.query.substring(0, 50),
      operation: 'rag-tool-search-error',
      severity: 'high' as const
    });

    // Retourner résultat vide en cas d'erreur (fail gracefully)
    return {
      found: false,
      context: '',
      resultsCount: 0,
      averageScore: 0,
      chunks: [],
      searchTimeMs: Date.now() - startTime
    };
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export type RAGSearchInput = z.infer<typeof RAGSearchInputSchema>;
export type RAGSearchOutput = z.infer<typeof RAGSearchOutputSchema>;
