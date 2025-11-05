/**
 * UI Mode System for TomIA - Version 2.0
 * Système adaptatif selon l'âge et le niveau scolaire
 */

export type UIMode = 'primary' | 'college' | 'lycee';

// ✅ UNIFIÉ - Import direct sans alias
import type { EducationLevelType } from '@/types';

// Re-export for convenience
export type { EducationLevelType };

export interface InterfaceConfig {
  mode: UIMode;
  buttonSize: 'sm' | 'default' | 'lg';
  fontSize: 'text-sm' | 'text-base' | 'text-lg';
  spacing: 'p-2' | 'p-3' | 'p-4';
  borderRadius: 'rounded-md' | 'rounded-lg' | 'rounded-xl';
}

/**
 * 🎯 EXPERT: Détermine le mode UI selon le niveau scolaire - PAS DE FALLBACK
 */
export function getUIMode(schoolLevel: EducationLevelType): UIMode {
  const primaryLevels: EducationLevelType[] = ['cp', 'ce1', 'ce2', 'cm1', 'cm2'];
  const collegeLevels: EducationLevelType[] = ['sixieme', 'cinquieme', 'quatrieme', 'troisieme'];

  if (primaryLevels.includes(schoolLevel)) return 'primary';
  if (collegeLevels.includes(schoolLevel)) return 'college';
  return 'lycee'; // seconde, premiere, terminale
}

/**
 * Configuration d'interface selon le mode UI
 */
export function getInterfaceConfig(mode: UIMode): InterfaceConfig {
  switch (mode) {
    case 'primary':
      return {
        mode,
        buttonSize: 'lg',
        fontSize: 'text-lg',
        spacing: 'p-4',
        borderRadius: 'rounded-xl'
      };
    case 'college':
      return {
        mode,
        buttonSize: 'default',
        fontSize: 'text-base',
        spacing: 'p-3',
        borderRadius: 'rounded-lg'
      };
    case 'lycee':
      return {
        mode,
        buttonSize: 'default',
        fontSize: 'text-base',
        spacing: 'p-3',
        borderRadius: 'rounded-md'
      };
  }
}

/**
 * Adapte le texte selon l'âge
 */
export function getAgeAppropriateText(mode: UIMode, texts: {
  primary: string;
  college: string;
  lycee: string;
}): string {
  return texts[mode];
}

/**
 * Calcule l'âge depuis une date de naissance
 */
export function calculateAge(birthDate: string | Date): number {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}
