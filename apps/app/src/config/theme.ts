/**
 * TomAI Theme Configuration - Système de Couleurs Centralisé
 *
 * Ce fichier définit TOUTES les couleurs de l'application de manière centralisée.
 * Pour modifier une couleur, changez-la ICI uniquement.
 *
 * Architecture:
 * 1. Role Colors: Parent (Bleu), Élève (Vert), IA (Purple)
 * 2. UI Colors: Stats, Badges, Status
 * 3. Helper Functions: Pour obtenir les couleurs facilement
 */

import type { UserRoleType } from '@/types';

// ==========================================
// 1. COULEURS DE RÔLES (Parent, Élève, IA)
// ==========================================

/**
 * Type pour les rôles avec couleurs définies
 */
export type RoleWithColor = 'parent' | 'student' | 'assistant';

/**
 * Mapping rôle utilisateur → token CSS
 * ✅ Source unique de vérité pour les couleurs de rôles
 */
export const ROLE_COLORS: Record<RoleWithColor, { token: string; name: string; description: string }> = {
  parent: {
    token: 'primary',
    name: 'Bleu TomAI',
    description: 'Couleur principale pour les parents'
  },
  student: {
    token: 'secondary',
    name: 'Vert TomAI',
    description: 'Couleur principale pour les élèves'
  },
  assistant: {
    token: 'assistant',
    name: 'Purple TomAI',
    description: 'Couleur principale pour l\'IA/Assistant'
  }
} as const;

/**
 * Obtenir le token de couleur selon le rôle
 * @example getRoleColor('parent') // 'primary'
 */
export function getRoleColor(role: UserRoleType | 'assistant'): string {
  // Admin utilise la même couleur que Parent (primary)
  const mappedRole: RoleWithColor = role === 'admin' ? 'parent' : role as RoleWithColor;
  return ROLE_COLORS[mappedRole]?.token ?? 'primary';
}

/**
 * Obtenir les classes TailwindCSS selon le rôle
 * @example getRoleClasses('parent', 'bg') // 'bg-primary text-primary-foreground'
 */
export function getRoleClasses(
  role: UserRoleType | 'assistant',
  type: 'bg' | 'text' | 'border' | 'ring' = 'bg'
): string {
  const token = getRoleColor(role);

  const classMap = {
    bg: `bg-${token} text-${token}-foreground`,
    text: `text-${token}`,
    border: `border-${token}`,
    ring: `ring-${token}`
  };

  return classMap[type];
}

/**
 * Obtenir les classes de gradient selon le rôle
 * @example getRoleGradient('parent') // 'from-primary to-primary/90'
 */
export function getRoleGradient(role: UserRoleType | 'assistant'): string {
  const token = getRoleColor(role);
  return `from-${token} to-${token}/90`;
}

// ==========================================
// 2. COULEURS UI (Stats, Badges, Status)
// ==========================================

/**
 * Couleurs pour les stats et badges
 * ✅ Palette cohérente et accessible (WCAG AA)
 */
export const UI_COLORS = {
  // Gamification (badges, streaks)
  streak: 'orange',
  trophy: 'yellow',
  target: 'blue',
  heart: 'pink',
  star: 'yellow',
  fire: 'orange',

  // Stats dashboard
  sessions: 'blue',
  studyTime: 'green',
  subjects: 'pink',

  // Status
  success: 'success',
  warning: 'warning',
  error: 'destructive',
  info: 'info'
} as const;

/**
 * Type pour les variantes de couleurs UI
 */
export type UIColorVariant = 'orange' | 'yellow' | 'blue' | 'green' | 'pink';

/**
 * Obtenir les classes TailwindCSS pour une couleur UI
 * @example getUIColorClasses('orange', 'icon') // 'bg-orange-100 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400'
 */
export function getUIColorClasses(color: UIColorVariant, element: 'icon' | 'text' | 'bg' | 'border'): string {
  const colorMap = {
    orange: {
      icon: 'bg-orange-100 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400',
      text: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-500/10',
      border: 'border-orange-200/50 dark:border-orange-800/50'
    },
    yellow: {
      icon: 'bg-yellow-100 dark:bg-yellow-950/30 text-yellow-600 dark:text-yellow-600',
      text: 'text-yellow-600 dark:text-yellow-500',
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-200/50 dark:border-yellow-800/50'
    },
    blue: {
      icon: 'bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400',
      text: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-200/50 dark:border-blue-800/50'
    },
    green: {
      icon: 'bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400',
      text: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-500/10',
      border: 'border-green-200/50 dark:border-green-800/50'
    },
    pink: {
      icon: 'bg-pink-100 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400',
      text: 'text-pink-600 dark:text-pink-400',
      bg: 'bg-pink-500/10',
      border: 'border-pink-200/50 dark:border-pink-800/50'
    }
  };

  return colorMap[color][element];
}

// ==========================================
// 3. MODE-BASED COLORS (Primary, College, Lycée)
// ==========================================

/**
 * Type pour les modes d'interface adaptés à l'âge
 */
export type InterfaceMode = 'primary' | 'college' | 'lycee';

/**
 * Mapping mode → rôle utilisateur
 */
export function getModeRole(_mode: InterfaceMode): UserRoleType {
  // Primary/College/Lycée sont tous des élèves, donc 'student'
  return 'student';
}

/**
 * Obtenir la couleur selon le mode d'interface
 * @example getModeColor('primary') // 'primary' (pourrait être personnalisé si besoin)
 */
export function getModeColor(mode: InterfaceMode): string {
  // Pour l'instant, tous les modes élèves utilisent 'secondary' (vert)
  // Mais on peut personnaliser si besoin futur
  const modeColorMap: Record<InterfaceMode, string> = {
    primary: 'secondary',    // Primaire = Vert élève
    college: 'secondary',    // Collège = Vert élève
    lycee: 'secondary'       // Lycée = Vert élève
  };

  return modeColorMap[mode];
}

/**
 * Obtenir les classes de card selon le mode
 * @example getModeCardClasses('primary') // 'border-secondary/20 bg-secondary/5'
 */
export function getModeCardClasses(mode: InterfaceMode): string {
  const color = getModeColor(mode);
  return `border-${color}/20 bg-${color}/5`;
}

// ==========================================
// 4. VARIANTS DE COMPOSANTS
// ==========================================

/**
 * Variants pour StatCard component
 */
export const STAT_CARD_VARIANTS = {
  orange: {
    iconBg: 'bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-950/40 dark:to-orange-900/20',
    iconColor: 'text-orange-600 dark:text-orange-400',
    valueBg: 'bg-gradient-to-br from-orange-500/10 to-transparent',
    border: 'border-orange-200/50 dark:border-orange-800/50',
    glow: 'shadow-orange-500/10 dark:shadow-orange-400/20'
  },
  yellow: {
    iconBg: 'bg-gradient-to-br from-yellow-100 to-yellow-50 dark:from-yellow-950/40 dark:to-yellow-900/20',
    iconColor: 'text-yellow-600 dark:text-yellow-500',
    valueBg: 'bg-gradient-to-br from-yellow-500/10 to-transparent',
    border: 'border-yellow-200/50 dark:border-yellow-800/50',
    glow: 'shadow-yellow-500/10 dark:shadow-yellow-400/20'
  },
  blue: {
    iconBg: 'bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-950/40 dark:to-blue-900/20',
    iconColor: 'text-blue-600 dark:text-blue-400',
    valueBg: 'bg-gradient-to-br from-blue-500/10 to-transparent',
    border: 'border-blue-200/50 dark:border-blue-800/50',
    glow: 'shadow-blue-500/10 dark:shadow-blue-400/20'
  },
  green: {
    iconBg: 'bg-gradient-to-br from-green-100 to-green-50 dark:from-green-950/40 dark:to-green-900/20',
    iconColor: 'text-green-600 dark:text-green-400',
    valueBg: 'bg-gradient-to-br from-green-500/10 to-transparent',
    border: 'border-green-200/50 dark:border-green-800/50',
    glow: 'shadow-green-500/10 dark:shadow-green-400/20'
  },
  pink: {
    iconBg: 'bg-gradient-to-br from-pink-100 to-pink-50 dark:from-pink-950/40 dark:to-pink-900/20',
    iconColor: 'text-pink-600 dark:text-pink-400',
    valueBg: 'bg-gradient-to-br from-pink-500/10 to-transparent',
    border: 'border-pink-200/50 dark:border-pink-800/50',
    glow: 'shadow-pink-500/10 dark:shadow-pink-400/20'
  }
} as const;

// ==========================================
// 5. DOCUMENTATION
// ==========================================

/**
 * 🎨 TomAI Color System Documentation
 *
 * Pour modifier les couleurs de l'application:
 *
 * 1. Couleurs de rôles (Parent/Élève/IA):
 *    - Modifier ROLE_COLORS
 *    - Utiliser getRoleColor(), getRoleClasses(), getRoleGradient()
 *
 * 2. Couleurs UI (Stats/Badges):
 *    - Modifier UI_COLORS
 *    - Utiliser getUIColorClasses()
 *
 * 3. Couleurs de mode (Primary/College/Lycée):
 *    - Modifier getModeColor() si besoin de différenciation
 *    - Utiliser getModeCardClasses()
 *
 * 4. Variants de composants (StatCard):
 *    - Modifier STAT_CARD_VARIANTS
 *    - Importer directement dans les composants
 *
 * Exemple d'utilisation:
 * ```tsx
 * import { getRoleClasses, UI_COLORS, getModeCardClasses } from '@/config/theme';
 *
 * // Couleur selon rôle
 * <div className={getRoleClasses('parent', 'bg')}>Parent</div>
 *
 * // Couleur UI pour badge
 * const color = UI_COLORS.streak; // 'orange'
 *
 * // Couleur mode
 * <Card className={getModeCardClasses('primary')} />
 * ```
 */
