/**
 * Index des modules de prompts pour la génération de cartes
 *
 * Architecture modulaire:
 * - base.ts: Instructions communes (format JSON, concision, diversité)
 * - by-subject.ts: Instructions spécifiques par matière
 */

// Re-export tout depuis les modules
export * from './base.js';
export * from './by-subject.js';

// Types réexportés pour commodité
export type {
  CardType,
  SubjectCategory,
  CardGenerationParams,
  ParsedCard,
  FlashcardContent,
  QCMContent,
  VraiFauxContent,
  EducationCycle,
  SubjectConfig
} from '../types.js';
