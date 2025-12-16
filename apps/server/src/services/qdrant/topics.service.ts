/**
 * Topics Service - Liste les thèmes/domaines disponibles depuis Qdrant
 *
 * Permet à l'élève de sélectionner un thème existant dans le programme
 * au lieu de taper un texte libre (validation RAG garantie).
 */

import { getQdrantClient } from './qdrant-client.service.js';
import { QDRANT_CONFIG } from './config.js';
import { isQdrantRAGEnabled } from './rag-utils.js';
import { logger } from '../../lib/observability.js';
import type { EducationLevelType } from '../../types/index.js';

/**
 * Structure d'un domaine avec ses thèmes
 */
export interface DomainWithTopics {
  /** Nom du domaine (ex: "Nombres et Calculs") */
  domaine: string;
  /** Liste des thèmes/titres uniques dans ce domaine */
  themes: string[];
}

/**
 * Résultat de la requête topics
 */
export interface TopicsResult {
  matiere: string;
  niveau: EducationLevelType;
  domaines: DomainWithTopics[];
  /** Nombre total de thèmes */
  totalTopics: number;
}

/**
 * Options pour récupérer les topics
 */
export interface GetTopicsOptions {
  matiere: string;
  niveau: EducationLevelType;
}

/**
 * Récupère tous les domaines et thèmes disponibles pour une matière/niveau
 * depuis Qdrant en utilisant scroll + aggregation
 */
export async function getTopicsFromRAG(options: GetTopicsOptions): Promise<TopicsResult> {
  const { matiere, niveau } = options;

  // Vérifier si Qdrant est configuré
  if (!isQdrantRAGEnabled()) {
    logger.warn('Qdrant RAG not configured, returning empty topics', {
      operation: 'get-topics'
    });
    return {
      matiere,
      niveau,
      domaines: [],
      totalTopics: 0
    };
  }

  const startTime = Date.now();

  try {
    const client = getQdrantClient();
    const collectionName = QDRANT_CONFIG.collection.name;

    // Utiliser scroll pour récupérer tous les points avec filtres
    // On ne récupère que les payloads (pas les vecteurs) pour la performance
    const allPoints: Array<{ domaine?: string; title: string }> = [];
    let offset: string | number | undefined = undefined;
    const batchSize = 100;

    // Scroll through all matching points
    while (true) {
      const scrollResult = await client.scroll(collectionName, {
        filter: {
          must: [
            { key: 'matiere', match: { value: normalizeMatiere(matiere) } },
            { key: 'niveau', match: { value: niveau } }
          ]
        },
        limit: batchSize,
        offset,
        with_payload: {
          include: ['domaine', 'title']
        },
        with_vector: false
      });

      for (const point of scrollResult.points) {
        const payload = point.payload as { domaine?: string; title?: string } | null;
        if (payload?.title) {
          allPoints.push({
            domaine: payload.domaine ?? 'Général',
            title: payload.title
          });
        }
      }

      // Check if we have more results
      if (!scrollResult.next_page_offset) {
        break;
      }
      // Cast to handle Qdrant's union type for offset
      offset = scrollResult.next_page_offset as string | number | undefined;
    }

    // Agréger par domaine et extraire les titres uniques
    const domaineMap = new Map<string, Set<string>>();

    for (const point of allPoints) {
      const domaine = point.domaine ?? 'Général';
      if (!domaineMap.has(domaine)) {
        domaineMap.set(domaine, new Set());
      }
      domaineMap.get(domaine)!.add(point.title);
    }

    // Convertir en structure finale
    const domaines: DomainWithTopics[] = [];
    let totalTopics = 0;

    // Trier les domaines alphabétiquement
    const sortedDomaines = Array.from(domaineMap.keys()).sort((a, b) =>
      a.localeCompare(b, 'fr')
    );

    for (const domaine of sortedDomaines) {
      const themes = Array.from(domaineMap.get(domaine)!).sort((a, b) =>
        a.localeCompare(b, 'fr')
      );
      domaines.push({ domaine, themes });
      totalTopics += themes.length;
    }

    const searchTime = Date.now() - startTime;

    logger.info('Topics retrieved from RAG', {
      matiere,
      niveau,
      domainesCount: domaines.length,
      totalTopics,
      searchTime,
      operation: 'get-topics'
    });

    return {
      matiere,
      niveau,
      domaines,
      totalTopics
    };
  } catch (error) {
    logger.error('Failed to get topics from RAG', {
      matiere,
      niveau,
      _error: error instanceof Error ? error.message : 'Unknown error',
      severity: 'medium' as const,
      operation: 'get-topics'
    });

    // Retourner une liste vide en cas d'erreur
    return {
      matiere,
      niveau,
      domaines: [],
      totalTopics: 0
    };
  }
}

/**
 * Normalise le nom de matière pour correspondre au format Qdrant
 */
function normalizeMatiere(matiere: string): string {
  const m = matiere.toLowerCase().trim();

  // Mapping vers le format stocké dans Qdrant
  const mappings: Record<string, string> = {
    'mathématiques': 'mathematiques',
    'maths': 'mathematiques',
    'math': 'mathematiques',
    'français': 'francais',
    'francais': 'francais',
    'physique-chimie': 'physique_chimie',
    'physique chimie': 'physique_chimie',
    'physique': 'physique_chimie',
    'chimie': 'physique_chimie',
    'svt': 'svt',
    'sciences de la vie et de la terre': 'svt',
    'histoire-géographie': 'histoire_geo',
    'histoire-geo': 'histoire_geo',
    'histoire': 'histoire_geo',
    'géographie': 'histoire_geo',
    'geographie': 'histoire_geo',
    'anglais': 'anglais',
    'english': 'anglais',
  };

  return mappings[m] ?? m.replace(/[- ]/g, '_');
}

/**
 * Récupère la liste des matières disponibles pour un niveau donné
 */
export async function getAvailableSubjectsForLevel(niveau: EducationLevelType): Promise<string[]> {
  if (!isQdrantRAGEnabled()) {
    return [];
  }

  try {
    const client = getQdrantClient();
    const collectionName = QDRANT_CONFIG.collection.name;

    // Scroll pour récupérer toutes les matières uniques pour ce niveau
    const matieres = new Set<string>();
    let offset: string | number | undefined = undefined;
    const batchSize = 100;

    while (true) {
      const scrollResult = await client.scroll(collectionName, {
        filter: {
          must: [
            { key: 'niveau', match: { value: niveau } }
          ]
        },
        limit: batchSize,
        offset,
        with_payload: {
          include: ['matiere']
        },
        with_vector: false
      });

      for (const point of scrollResult.points) {
        const payload = point.payload as { matiere?: string } | null;
        if (payload?.matiere) {
          matieres.add(payload.matiere);
        }
      }

      if (!scrollResult.next_page_offset) {
        break;
      }
      // Cast to handle Qdrant's union type for offset
      offset = scrollResult.next_page_offset as string | number | undefined;
    }

    return Array.from(matieres).sort((a, b) => a.localeCompare(b, 'fr'));
  } catch (error) {
    logger.error('Failed to get available subjects', {
      niveau,
      _error: error instanceof Error ? error.message : 'Unknown error',
      severity: 'medium' as const,
      operation: 'get-subjects'
    });
    return [];
  }
}
