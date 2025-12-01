/**
 * Configuration Badges - Tom Frontend
 *
 * Mapping badgeKey (backend) → Visual design (frontend)
 * Architecture: Séparation données (backend) / design (frontend)
 *
 * 🎯 RÈGLE: Icônes/couleurs NE SONT PAS dans la database
 * ✅ Backend stocke: badgeKey, name, description, criteria, category
 * ✅ Frontend gère: emoji icons, couleurs, gradient, styles
 */

export interface BadgeVisualConfig {
  icon: string; // Emoji simple pour cohérence design Tom
  gradient: string; // Gradient TailwindCSS classes
  bgColor: string; // Couleur fond badge
  borderColor: string; // Couleur bordure
  textColor: string; // Couleur texte
  glowColor: string; // Couleur glow pour badges débloqués
}

export interface BadgeCategoryVisualConfig {
  name: string;
  icon: string;
  color: string;
  gradient: string;
}

/**
 * Configuration visuelle par catégorie de badges
 */
export const BADGE_CATEGORIES: Record<string, BadgeCategoryVisualConfig> = {
  progression: {
    name: 'Progression',
    icon: '📚',
    color: 'text-blue-600 dark:text-blue-400',
    gradient: 'from-blue-500 to-cyan-500'
  },
  engagement: {
    name: 'Engagement',
    icon: '🔥',
    color: 'text-orange-600 dark:text-orange-400',
    gradient: 'from-orange-500 to-red-500'
  },
  mastery: {
    name: 'Maîtrise',
    icon: '🎓',
    color: 'text-purple-600 dark:text-purple-400',
    gradient: 'from-purple-500 to-pink-600'
  },
  special: {
    name: 'Spécial',
    icon: '⭐',
    color: 'text-yellow-600 dark:text-yellow-400',
    gradient: 'from-yellow-500 to-amber-500'
  }
};

/**
 * Configuration visuelle des 18 badges Tom
 *
 * Catégories:
 * - Progression (7 badges): Basés sur nombre de sessions (first, 5, 10, 20, 30, 50, 100)
 * - Engagement (5 badges): Basés sur streaks quotidiens (3, 5, 7, 14, 30)
 * - Maîtrise (6 badges): Basés sur maîtrise par matière (5+ sessions par sujet)
 */
export const BADGE_VISUALS: Record<string, BadgeVisualConfig> = {
  // ===== PROGRESSION PAR SESSIONS (7 badges) =====
  'first-session': {
    icon: '🎯',
    gradient: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    textColor: 'text-blue-900 dark:text-blue-100',
    glowColor: 'shadow-blue-500/50'
  },
  '5-sessions': {
    icon: '📚',
    gradient: 'from-blue-600 to-cyan-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    borderColor: 'border-blue-300 dark:border-blue-700',
    textColor: 'text-blue-900 dark:text-blue-50',
    glowColor: 'shadow-blue-600/50'
  },
  '10-sessions': {
    icon: '💪',
    gradient: 'from-indigo-500 to-blue-600',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950/30',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
    textColor: 'text-indigo-900 dark:text-indigo-100',
    glowColor: 'shadow-indigo-500/50'
  },
  '20-sessions': {
    icon: '🚀',
    gradient: 'from-indigo-600 to-purple-600',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
    borderColor: 'border-indigo-300 dark:border-indigo-700',
    textColor: 'text-indigo-900 dark:text-indigo-50',
    glowColor: 'shadow-indigo-600/50'
  },
  '30-sessions': {
    icon: '🌟',
    gradient: 'from-purple-500 to-pink-600',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
    textColor: 'text-purple-900 dark:text-purple-100',
    glowColor: 'shadow-purple-500/50'
  },
  '50-sessions': {
    icon: '👑',
    gradient: 'from-purple-600 to-pink-700',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    borderColor: 'border-purple-300 dark:border-purple-700',
    textColor: 'text-purple-900 dark:text-purple-50',
    glowColor: 'shadow-purple-600/50'
  },
  '100-sessions': {
    icon: '🏆',
    gradient: 'from-yellow-500 via-orange-600 to-red-700',
    bgColor: 'bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/30 dark:to-orange-950/30',
    borderColor: 'border-yellow-300 dark:border-yellow-700',
    textColor: 'text-yellow-900 dark:text-yellow-50',
    glowColor: 'shadow-yellow-600/70'
  },

  // ===== ENGAGEMENT PAR STREAKS (5 badges) =====
  'streak-3': {
    icon: '🔥',
    gradient: 'from-orange-500 to-red-500',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
    textColor: 'text-orange-900 dark:text-orange-100',
    glowColor: 'shadow-orange-500/50'
  },
  'streak-5': {
    icon: '💪',
    gradient: 'from-orange-600 to-red-600',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    borderColor: 'border-orange-300 dark:border-orange-700',
    textColor: 'text-orange-900 dark:text-orange-50',
    glowColor: 'shadow-orange-600/50'
  },
  'streak-7': {
    icon: '⚡',
    gradient: 'from-red-500 to-rose-600',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-200 dark:border-red-800',
    textColor: 'text-red-900 dark:text-red-100',
    glowColor: 'shadow-red-500/50'
  },
  'streak-14': {
    icon: '💥',
    gradient: 'from-red-600 to-rose-700',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    borderColor: 'border-red-300 dark:border-red-700',
    textColor: 'text-red-900 dark:text-red-50',
    glowColor: 'shadow-red-600/50'
  },
  'streak-30': {
    icon: '🏅',
    gradient: 'from-yellow-500 via-orange-600 to-red-700',
    bgColor: 'bg-gradient-to-br from-yellow-50 to-red-50 dark:from-yellow-950/30 dark:to-red-950/30',
    borderColor: 'border-yellow-300 dark:border-yellow-700',
    textColor: 'text-yellow-900 dark:text-yellow-50',
    glowColor: 'shadow-yellow-600/70'
  },

  // ===== MAÎTRISE PAR MATIÈRE (6 badges) =====
  'math-explorer': {
    icon: '🔢',
    gradient: 'from-emerald-500 to-teal-600',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    textColor: 'text-emerald-900 dark:text-emerald-100',
    glowColor: 'shadow-emerald-500/50'
  },
  'french-master': {
    icon: '📖',
    gradient: 'from-violet-500 to-purple-600',
    bgColor: 'bg-violet-50 dark:bg-violet-950/30',
    borderColor: 'border-violet-200 dark:border-violet-800',
    textColor: 'text-violet-900 dark:text-violet-100',
    glowColor: 'shadow-violet-500/50'
  },
  'science-star': {
    icon: '🔬',
    gradient: 'from-cyan-500 to-blue-600',
    bgColor: 'bg-cyan-50 dark:bg-cyan-950/30',
    borderColor: 'border-cyan-200 dark:border-cyan-800',
    textColor: 'text-cyan-900 dark:text-cyan-100',
    glowColor: 'shadow-cyan-500/50'
  },
  'history-sage': {
    icon: '📜',
    gradient: 'from-amber-500 to-orange-600',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
    textColor: 'text-amber-900 dark:text-amber-100',
    glowColor: 'shadow-amber-500/50'
  },
  'language-talent': {
    icon: '🌍',
    gradient: 'from-rose-500 to-pink-600',
    bgColor: 'bg-rose-50 dark:bg-rose-950/30',
    borderColor: 'border-rose-200 dark:border-rose-800',
    textColor: 'text-rose-900 dark:text-rose-100',
    glowColor: 'shadow-rose-500/50'
  },
  'philosophy-thinker': {
    icon: '🤔',
    gradient: 'from-slate-500 to-gray-600',
    bgColor: 'bg-slate-50 dark:bg-slate-950/30',
    borderColor: 'border-slate-200 dark:border-slate-800',
    textColor: 'text-slate-900 dark:text-slate-100',
    glowColor: 'shadow-slate-500/50'
  }
};

/**
 * Récupère la configuration visuelle d'un badge
 * Fallback sur config par défaut si badge non trouvé
 */
export function getBadgeVisualConfig(badgeKey: string): BadgeVisualConfig {
  return BADGE_VISUALS[badgeKey] ?? {
    icon: '🎖️',
    gradient: 'from-gray-500 to-gray-600',
    bgColor: 'bg-gray-50 dark:bg-gray-950/30',
    borderColor: 'border-gray-200 dark:border-gray-800',
    textColor: 'text-gray-900 dark:text-gray-100',
    glowColor: 'shadow-gray-500/50'
  };
}

/**
 * Récupère la configuration visuelle d'une catégorie
 */
export function getCategoryVisualConfig(category: string): BadgeCategoryVisualConfig {
  return BADGE_CATEGORIES[category] ?? {
    name: 'Autre',
    icon: '🎖️',
    color: 'text-gray-600 dark:text-gray-400',
    gradient: 'from-gray-500 to-gray-600'
  };
}

/**
 * Styles pour mode adaptatif (primary/college/lycee)
 */
export const BADGE_DISPLAY_MODES = {
  primary: {
    // CP-CM2: Grands badges colorés avec emojis imposants
    cardSize: 'p-5 md:p-6',
    iconSize: 'text-5xl md:text-6xl',
    titleSize: 'text-base md:text-lg font-bold',
    descSize: 'text-xs md:text-sm',
    grid: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4' // ✅ Ajout breakpoint sm pour tablettes
  },
  college: {
    // 6e-3e: Badges medium avec équilibre fun/sérieux
    cardSize: 'p-4',
    iconSize: 'text-4xl md:text-5xl',
    titleSize: 'text-sm md:text-base font-semibold',
    descSize: 'text-xs',
    grid: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3' // ✅ 2 cols mobile, progression fluide
  },
  lycee: {
    // Lycée: Badges compacts et professionnels
    cardSize: 'p-3',
    iconSize: 'text-3xl md:text-4xl',
    titleSize: 'text-xs md:text-sm font-medium',
    descSize: 'text-xs',
    grid: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2' // ✅ 2 cols mobile, 6 cols desktop
  }
};

/**
 * Type guard pour vérifier si un badgeKey existe
 */
export function isBadgeKeyValid(badgeKey: string): boolean {
  return badgeKey in BADGE_VISUALS;
}
