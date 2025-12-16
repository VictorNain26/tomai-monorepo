/**
 * Mapping éducatif - Niveaux scolaires français
 * Externalisation depuis gemini-simple.service.ts (lignes 351-596)
 * Standards Éducation Nationale 2024-2025
 */

import type { EducationLevelType } from '../../types/index.js';
import type { CycleType, CycleInfo, CycleConfig } from './types.js';

/**
 * Mapping officiel des cycles pédagogiques français
 * Extraction de gemini-simple.service.ts lignes 353-374
 */
export const CYCLE_MAPPING: Record<CycleType, CycleConfig> = {
  cycle2: {
    levels: ['cp', 'ce1', 'ce2'] as EducationLevelType[],
    ageRange: '6-8 ans',
    cognitiveStage: 'Opérations concrètes précoces'
  },
  cycle3: {
    levels: ['cm1', 'cm2', 'sixieme'] as EducationLevelType[],
    ageRange: '9-11 ans',
    cognitiveStage: 'Opérations concrètes maîtrisées'
  },
  cycle4: {
    levels: ['cinquieme', 'quatrieme', 'troisieme'] as EducationLevelType[],
    ageRange: '12-14 ans',
    cognitiveStage: 'Début pensée formelle'
  },
  lycee: {
    levels: ['seconde', 'premiere', 'terminale'] as EducationLevelType[],
    ageRange: '15-17 ans',
    cognitiveStage: 'Pensée formelle développée'
  }
};

/**
 * Mapping niveaux scolaires français vers texte descriptif
 * Extraction de gemini-simple.service.ts lignes 579-596
 */
export const LEVEL_TEXT_MAPPING: Record<EducationLevelType, string> = {
  cp: 'CP (6 ans)',
  ce1: 'CE1 (7 ans)',
  ce2: 'CE2 (8 ans)',
  cm1: 'CM1 (9 ans)',
  cm2: 'CM2 (10 ans)',
  sixieme: '6ème (11 ans)',
  cinquieme: '5ème (12 ans)',
  quatrieme: '4ème (13 ans)',
  troisieme: '3ème (14 ans)',
  seconde: '2nde (15 ans)',
  premiere: '1ère (16 ans)',
  terminale: 'Terminale (17 ans)'
};

/**
 * Détermine le cycle pédagogique pour un niveau donné
 * Extraction de gemini-simple.service.ts lignes 351-393
 */
export function getCycleInfo(level: EducationLevelType): CycleInfo {
  // Détermination du cycle
  for (const [cycleName, cycleInfo] of Object.entries(CYCLE_MAPPING) as [CycleType, CycleConfig][]) {
    if (cycleInfo.levels.includes(level)) {
      return {
        cycle: cycleName,
        ageRange: cycleInfo.ageRange,
        cognitiveStage: cycleInfo.cognitiveStage
      };
    }
  }

  // Fallback cycle 3
  return {
    cycle: 'cycle3' as const,
    ageRange: '9-11 ans',
    cognitiveStage: 'Opérations concrètes maîtrisées'
  };
}

/**
 * Convertit un niveau scolaire en texte descriptif
 * Extraction de gemini-simple.service.ts lignes 579-596
 */
export function getLevelText(level: EducationLevelType): string {
  return LEVEL_TEXT_MAPPING[level] || level;
}

/**
 * Génère le guide de réponses structurées selon le cycle
 * Extraction de gemini-simple.service.ts lignes 398-430
 */
/**
 * Retourne le cycle pédagogique pour un niveau donné
 * Helper simplifié de getCycleInfo
 */
export function getCycleFromLevel(level: EducationLevelType): CycleType {
  return getCycleInfo(level).cycle;
}

export function getStructuredResponseGuide(level: EducationLevelType): string {
  const cycleInfo = getCycleInfo(level);

  switch (cycleInfo.cycle) {
    case 'cycle2':
      return `- Phrases courtes et simples
- 1 idée = 1 phrase
- Exemples très concrets
- Encouragements fréquents`;

    case 'cycle3':
      return `- Explications structurées en étapes
- Exemples du quotidien
- Questions intermédiaires
- Liens avec autres matières`;

    case 'cycle4':
      return `- Raisonnement explicite
- Justifications méthodologiques
- Argumentation progressive
- Développement esprit critique`;

    case 'lycee':
      return `- Analyse complexe et nuancée
- Références expertes et culturelles
- Problématisation avancée
- Ouverture vers approfondissements`;

    default:
      return `- Explications adaptées au niveau
- Progression logique des idées
- Exemples pertinents
- Encouragement approprié`;
  }
}
