// ✅ UNIFIÉ avec backend - Import et export type unique
import type { EducationLevelType } from '@/types';

// Export pour utilisation dans d'autres modules
export type { EducationLevelType };

export interface ILevelInfo {
  cycle: string;
  description: string;
}

const schoolLevelsData: [EducationLevelType, ILevelInfo][] = [
  ['cp', { cycle: 'Cycle 2', description: 'CP - Cours Préparatoire' }],
  ['ce1', { cycle: 'Cycle 2', description: 'CE1 - Cours Élémentaire 1ère année' }],
  ['ce2', { cycle: 'Cycle 2', description: 'CE2 - Cours Élémentaire 2ème année' }],
  ['cm1', { cycle: 'Cycle 3', description: 'CM1 - Cours Moyen 1ère année' }],
  ['cm2', { cycle: 'Cycle 3', description: 'CM2 - Cours Moyen 2ème année' }],
  ['sixieme', { cycle: 'Cycle 3', description: '6ème' }],
  ['cinquieme', { cycle: 'Cycle 4', description: '5ème' }],
  ['quatrieme', { cycle: 'Cycle 4', description: '4ème' }],
  ['troisieme', { cycle: 'Cycle 4', description: '3ème - Brevet' }],
  ['seconde', { cycle: 'Lycée', description: 'Seconde - Tronc commun' }],
  ['premiere', { cycle: 'Lycée', description: 'Première - Spécialités' }],
  ['terminale', { cycle: 'Lycée', description: 'Terminale - Baccalauréat' }]
];

export const SCHOOL_LEVELS: Record<EducationLevelType, ILevelInfo> = Object.fromEntries(schoolLevelsData) as Record<EducationLevelType, ILevelInfo>;

export const CYCLES = {
  CYCLE_2: { name: 'Cycle 2 - Apprentissages fondamentaux', levels: ['cp', 'ce1', 'ce2'] as EducationLevelType[] },
  CYCLE_3: { name: 'Cycle 3 - Consolidation', levels: ['cm1', 'cm2', 'sixieme'] as EducationLevelType[] },
  CYCLE_4: { name: 'Cycle 4 - Approfondissements', levels: ['cinquieme', 'quatrieme', 'troisieme'] as EducationLevelType[] },
  LYCEE: { name: 'Lycée - Spécialisation et excellence', levels: ['seconde', 'premiere', 'terminale'] as EducationLevelType[] }
};

export const useLevelInfo = (level: EducationLevelType): ILevelInfo => {
  return SCHOOL_LEVELS[level];
};

export const getSchoolLevelOptions = (): { value: EducationLevelType; label: string }[] => {
  return schoolLevelsData.map(([level, info]) => ({
    value: level,
    label: info.description
  }));
};
