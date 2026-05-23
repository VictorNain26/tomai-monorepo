/**
 * Types pour le système éducatif français
 * Types centralisés pour les niveaux et matières scolaires
 */

// Type TypeScript complet pour tous les niveaux du système éducatif français
export type EducationLevelType =
  // Primaire (6-11 ans)
  | 'cp' | 'ce1' | 'ce2' | 'cm1' | 'cm2'
  // Collège (11-15 ans)
  | 'sixieme' | 'cinquieme' | 'quatrieme' | 'troisieme'
  // Lycée (15-18 ans)
  | 'seconde' | 'premiere' | 'terminale';

// Types pour les matières complètes selon l'Éducation Nationale
export type SubjectType =
  // Matières fondamentales
  | 'francais' | 'mathematiques'
  // Langues vivantes
  | 'anglais' | 'espagnol' | 'allemand' | 'italien'
  // Langues anciennes
  | 'latin' | 'grec'
  // Sciences
  | 'sciences' | 'svt' | 'physique_chimie'
  // Sciences humaines
  | 'histoire' | 'geographie' | 'hggsp' | 'philosophie'
  // Sciences économiques et sociales
  | 'ses'
  // Technologie et informatique
  | 'technologie' | 'nsi' | 'si'
  // Arts
  | 'arts_plastiques' | 'musique' | 'theatre' | 'cinema' | 'danse'
  // Sport et citoyenneté
  | 'eps' | 'emc'
  // Spécialités technologiques
  | 'st2s' | 'sti2d' | 'stmg' | 'stl' | 'sthr' | 'stav' | 'std2a'
  // Primaire spécifique
  | 'questionner_monde' | 'anglais_initiation';

// 🚀 HYBRID RAG 2025 TYPES - PostgreSQL + pgvector

/**
 * Types pour la configuration Hybrid RAG
 */
export interface HybridRAGConfig {
  /** Mode de récupération (hybrid, semantic, keyword) */
  retrievalMode: 'hybrid' | 'semantic' | 'keyword';
  /** Boost pour la recherche par mots-clés (1.0-2.0) */
  hybridBoost?: number;
  /** Nombre de documents à récupérer (1-20) */
  topK?: number;
  /** Score minimum de pertinence (0.0-1.0) */
  minScore?: number;
  /** Configuration sémantique personnalisée */
  semanticConfig?: string;
}

/**
 * Paramètres de recherche Hybrid RAG
 */
export interface HybridRAGSearchParams {
  /** Requête utilisateur */
  query: string;
  /** Niveau scolaire */
  level: EducationLevelType;
  /** Matière */
  subject: string;
  /** Configuration de recherche */
  retrievalMode?: 'hybrid' | 'semantic' | 'keyword';
  /** Boost pour mots-clés éducatifs */
  hybridBoost?: number;
  /** Nombre de résultats */
  topK?: number;
  /** Filtres additionnels */
  filters?: Record<string, string>;
}

/**
 * Document éducatif indexé dans PostgreSQL + pgvector
 */
export interface EducationalDocument {
  /** ID unique du document */
  id: string;
  /** Titre du programme/ressource */
  titre: string;
  /** Contenu pédagogique */
  contenu: string;
  /** Niveau scolaire */
  niveau: EducationLevelType;
  /** Matière */
  matiere: string;
  /** Cycle scolaire */
  cycle: string;
  /** Compétences visées */
  competences: string[];
  /** Objectifs pédagogiques */
  objectifs: string[];
  /** Source officielle */
  source: string;
  /** Année du programme */
  annee_programme: string;
  /** Statut de validation */
  statut: 'valide' | 'draft' | 'archive';
  /** Métadonnées enrichies */
  metadata: {
    type_document: 'programme' | 'ressource' | 'evaluation';
    derniere_maj: string;
    validateur: string;
    mots_cles: string[];
  };
}

/**
 * Résultat de recherche Hybrid RAG
 */
export interface HybridRAGResult {
  /** Contenu de la réponse enrichie */
  content: string;
  /** Documents sources récupérés */
  sources: EducationalDocument[];
  /** Citations avec contexte */
  citations: Array<{
    content: string;
    source: string;
    relevanceScore: number;
    documentId: string;
  }>;
  /** Métadonnées de la recherche */
  searchMetadata: {
    query: string;
    retrievalMode: string;
    totalDocuments: number;
    searchTime: number;
    hybridBoost?: number;
  };
  /** Contexte pédagogique enrichi */
  pedagogicalContext: {
    level: EducationLevelType;
    subject: string;
    cycle: string;
    complexity: 'basic' | 'intermediate' | 'advanced';
    competences: string[];
  };
}

/**
 * Contexte éducatif pour l'IA (Mistral)
 */
export interface EducationalContext {
  /** Niveau de l'étudiant */
  level: EducationLevelType;
  /** Matière étudiée */
  subject: string;
  /** Cycle scolaire */
  cycle: string;
  /** Complexité du contenu */
  complexity: 'basic' | 'intermediate' | 'advanced';
  /** Compétences à développer */
  targetCompetences: string[];
  /** Objectifs pédagogiques */
  learningObjectives: string[];
  /** Contexte RAG enrichi */
  ragContext?: string;
  /** Flags pédagogiques */
  pedagogicalFlags: string[];
}

/**
 * Paramètres de génération avec contexte éducatif
 */
export interface EducationalGenerationParams {
  /** Paramètres de base */
  level: EducationLevelType;
  subject: string;
  firstName?: string;
  userQuery: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;

  /** Intégration Hybrid RAG */
  useHybridRAG?: boolean;
  ragConfig?: HybridRAGConfig;

  /** Contexte pédagogique */
  educationalContext?: EducationalContext;

  /** Configuration avancée */
  customInstructions?: string;
  adaptiveDifficulty?: boolean;
  socraticMode?: boolean;
}

/**
 * Réponse générée avec métadonnées éducatives
 */
export interface EducationalResponse {
  /** Contenu de la réponse */
  content: string;
  /** Fournisseur IA utilisé */
  provider: 'mistral-medium-3' | 'mistral-large-3' | 'fallback';
  /** Tokens utilisés */
  tokensUsed: number;
  /** Contexte RAG utilisé */
  ragContext?: HybridRAGResult;
  /** Niveau de confiance pédagogique */
  confidence: number;
  /** Recommandations pédagogiques */
  pedagogicalRecommendations?: string[];
  /** Métadonnées de génération */
  generationMetadata: {
    model: string;
    temperature: number;
    maxTokens: number;
    responseTime: number;
    adaptedForLevel: EducationLevelType;
    difficultyLevel: 'basic' | 'intermediate' | 'advanced';
  };
}

/**
 * Analytics de performance Hybrid RAG
 */
export interface HybridRAGAnalytics {
  /** Métriques de précision */
  precision: {
    /** Score de précision global (0.0-1.0) */
    overall: number;
    /** Amélioration vs recherche simple */
    improvement: number;
    /** Précision par niveau scolaire */
    byLevel: Record<EducationLevelType, number>;
    /** Précision par matière */
    bySubject: Record<string, number>;
  };

  /** Métriques de performance */
  performance: {
    /** Temps de recherche moyen (ms) */
    averageSearchTime: number;
    /** Temps de génération moyen (ms) */
    averageGenerationTime: number;
    /** Taux de succès (%) */
    successRate: number;
    /** Utilisation cache (%) */
    cacheHitRate: number;
  };

  /** Utilisation pédagogique */
  usage: {
    /** Requêtes par niveau */
    requestsByLevel: Record<EducationLevelType, number>;
    /** Requêtes par matière */
    requestsBySubject: Record<string, number>;
    /** Types de questions populaires */
    popularQuestionTypes: Record<string, number>;
  };
}

/**
 * Configuration complète du système éducatif
 */
export interface EducationSystemConfig {
  /** Niveaux supportés */
  supportedLevels: EducationLevelType[];
  /** Matières par niveau */
  subjectsByLevel: Record<EducationLevelType, string[]>;
  /** Cycles scolaires */
  cycles: Record<string, EducationLevelType[]>;
  /** Configuration Hybrid RAG */
  hybridRAGConfig: HybridRAGConfig;
  /** Seuils de validation */
  validationThresholds: {
    minConfidence: number;
    maxResponseTime: number;
    minRelevanceScore: number;
  };
}