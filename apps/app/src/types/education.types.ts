/**
 * Education Types - Niveaux scolaires et matières
 */

// ✅ UNIFIÉ avec backend - Source de vérité unique
export type EducationLevelType =
  | 'cp' | 'ce1' | 'ce2' | 'cm1' | 'cm2'
  | 'sixieme' | 'cinquieme' | 'quatrieme' | 'troisieme'
  | 'seconde' | 'premiere' | 'terminale';

// AI Relevance types for educational subjects
export type AIRelevanceLevel = 'high' | 'medium' | 'limited' | 'excluded';

export interface AIRelevanceData {
  level: AIRelevanceLevel;
  efficacyScore: number; // 0-100, based on research
  officialSupport: boolean; // Official MEN support
  limitations?: string[];
  strengths?: string[];
  recommendedUsage: string;
}

// ✅ UNIFIÉ avec backend - Interface unique matières scolaires
export interface EducationSubject {
  key: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  ragKeywords: string[];
  availableIn?: EducationLevelType[];
  combinableWith?: string[];
  aiRelevance?: AIRelevanceData;
  // 🌍 Support langues vivantes - BCP 47 language tag pour TTS multilingue
  ttsLanguage?: string; // ex: "en-US", "es-ES", "de-DE", "it-IT", "zh-CN"
}

// ✅ UNIFIÉ - Structure API matières simplifiée
export interface SubjectsAPIResponse {
  success: boolean;
  level: EducationLevelType;
  subjects: EducationSubject[];
}

// ✅ UNIFIÉ - Catégorisation AI conforme educationService
export interface AICategorizedSubjects {
  recommended: EducationSubject[]; // High relevance (efficacy ≥85%)
  specialized: EducationSubject[];  // Medium relevance (efficacy 70-84%)
  limited: EducationSubject[];      // Limited relevance (efficacy <70%)
  metadata: {
    totalSubjects: number;
    researchBased: boolean;
    lastUpdated: string;
    source: string;
  };
}

// ✅ UNIFIÉ - Interface validation pour educationService
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ✅ UNIFIÉ avec backend - Niveau scolaire avec disponibilité RAG Qdrant
export interface RagLevel {
  key: EducationLevelType;
  ragAvailable: boolean;
  subjectsCount: number;
}
