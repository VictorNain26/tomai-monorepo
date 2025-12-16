/**
 * Types pour le curriculum éducatif français
 *
 * Structure hiérarchique:
 * Cycle → Niveau → Matière → Domaine → Compétence → Contenu
 *
 * @see https://eduscol.education.fr/90/j-enseigne-au-cycle-4
 */

import type { EducationLevelType } from '../../../types/index.js';

/**
 * Cycles scolaires français
 */
export type CycleType = 'cycle2' | 'cycle3' | 'cycle4' | 'lycee';

/**
 * Matières supportées par TomAI
 * Sélectionnées pour leur efficacité avec le tutorat IA
 */
export type SubjectType =
  | 'mathematiques'
  | 'francais'
  | 'physique_chimie'
  | 'svt'
  | 'histoire_geo'
  | 'anglais';

/**
 * Types de contenu éducatif
 */
export type ContentType =
  | 'programme_officiel' // Programme ministère
  | 'competence' // Compétence à acquérir
  | 'notion' // Notion/concept à comprendre
  | 'exercice_type' // Type d'exercice courant
  | 'methode' // Méthode de résolution
  | 'definition' // Définition officielle
  | 'exemple' // Exemple illustratif
  | 'erreur_courante'; // Erreur fréquente à éviter

/**
 * Document source brut avant traitement
 */
export interface RawDocument {
  id: string;
  title: string;
  content: string;
  source: string;
  sourceUrl?: string;
  niveau: EducationLevelType;
  matiere: SubjectType;
  cycle: CycleType;
  domaine?: string;
  sousdomaine?: string;
  contentType: ContentType;
  metadata?: Record<string, unknown>;
}

/**
 * Chunk après découpage sémantique
 */
export interface ContentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  contextualizedContent?: string; // Avec contexte Anthropic-style
  charStart: number;
  charEnd: number;
  tokenCount: number;
  metadata: ChunkMetadata;
}

/**
 * Métadonnées du chunk
 */
export interface ChunkMetadata {
  niveau: EducationLevelType;
  matiere: SubjectType;
  cycle: CycleType;
  domaine?: string;
  sousdomaine?: string;
  contentType: ContentType;
  title: string;
  source: string;
  sourceUrl?: string;
  chunkOf: number; // Total chunks in document
  previousChunkSummary?: string;
  nextChunkSummary?: string;
}

/**
 * Document prêt pour indexation Qdrant
 */
export interface IndexableDocument {
  id: string;
  content: string;
  payload: {
    title: string;
    content: string;
    niveau: EducationLevelType;
    matiere: SubjectType;
    cycle: CycleType;
    domaine?: string;
    sousdomaine?: string;
    contentType: ContentType;
    source: string;
    sourceUrl?: string;
    chunkIndex: number;
    chunkOf: number;
    documentId: string;
    tokenCount: number;
  };
}

/**
 * Configuration d'une matière
 */
export interface SubjectConfig {
  id: SubjectType;
  name: string;
  nameFr: string;
  hoursPerWeek: number;
  domains: DomainConfig[];
  color: string; // Pour UI
  icon: string; // Emoji
  aiTutoringScore: number; // 1-10, efficacité tutorat IA
}

/**
 * Configuration d'un domaine de compétences
 */
export interface DomainConfig {
  id: string;
  name: string;
  nameFr: string;
  subdomains?: SubdomainConfig[];
  competencies: string[];
}

/**
 * Configuration d'un sous-domaine
 */
export interface SubdomainConfig {
  id: string;
  name: string;
  nameFr: string;
  competencies: string[];
}

/**
 * Configuration complète d'un niveau scolaire
 */
export interface LevelConfig {
  niveau: EducationLevelType;
  cycle: CycleType;
  name: string;
  nameFr: string;
  ageRange: string;
  subjects: SubjectType[];
}

/**
 * Statistiques d'ingestion
 */
export interface IngestionStats {
  documentsProcessed: number;
  chunksCreated: number;
  tokensTotal: number;
  errorCount: number;
  startTime: Date;
  endTime?: Date;
  bySubject: Record<SubjectType, {
    documents: number;
    chunks: number;
    tokens: number;
  }>;
}

/**
 * Options de chunking
 */
export interface ChunkingOptions {
  maxTokens: number;
  minTokens: number;
  overlapPercent: number;
  preserveSentences: boolean;
  contextWindow: number; // Tokens de contexte avant/après
}

/**
 * Résultat du chunking
 */
export interface ChunkingResult {
  chunks: ContentChunk[];
  stats: {
    totalChunks: number;
    avgTokensPerChunk: number;
    minTokens: number;
    maxTokens: number;
  };
}
