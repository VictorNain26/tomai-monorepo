/**
 * Adaptation par niveau scolaire
 * Basé sur la charge cognitive (Sweller) et les capacités langagières par âge
 *
 * Sources:
 * - Sweller's Cognitive Load Theory (1988) - Capacité working memory
 * - Primlangues (cycles 2-3) - Vocabulaire adapté
 * - Programmes Éduscol 2024-2025
 */

import type { EducationLevelType } from '../../../types/index.js';

export type CycleType = 'cycle2' | 'cycle3' | 'cycle4' | 'lycee';

/**
 * Mapping niveau → cycle
 */
const LEVEL_TO_CYCLE: Record<EducationLevelType, CycleType> = {
  cp: 'cycle2',
  ce1: 'cycle2',
  ce2: 'cycle2',
  cm1: 'cycle3',
  cm2: 'cycle3',
  sixieme: 'cycle3',
  cinquieme: 'cycle4',
  quatrieme: 'cycle4',
  troisieme: 'cycle4',
  seconde: 'lycee',
  premiere: 'lycee',
  terminale: 'lycee'
};

/**
 * Retourne le cycle pour un niveau donné
 */
export function getCycleFromLevel(level: EducationLevelType): CycleType {
  return LEVEL_TO_CYCLE[level];
}

/**
 * Génère les adaptations par cycle - Un seul bloc compact
 */
export function generateLevelAdaptation(level: EducationLevelType): string {
  const cycle = getCycleFromLevel(level);

  const adaptations: Record<CycleType, string> = {
    cycle2: `<level_adaptation cycle="2" age="6-8 ans">
**LANGUE**: Phrases courtes (max 10 mots), mots simples, exemples du quotidien.
**STRUCTURE**: 1 idée = 1 phrase. Encouragements fréquents. Feedback immédiat.
**MATHS**: PAS de KaTeX. Écrire "3 fois 4" pas "$3 \\times 4$".
**CHARGE COGNITIVE**: 2-3 éléments max à la fois. Beaucoup d'exemples résolus.
</level_adaptation>`,

    cycle3: `<level_adaptation cycle="3" age="9-11 ans">
**LANGUE**: Phrases de 15-20 mots, vocabulaire accessible, termes techniques introduits progressivement.
**STRUCTURE**: Étapes numérotées, exemples du quotidien, liens entre matières.
**MATHS**: KaTeX basique ($\\frac{1}{2}$, $+$, $-$, $\\times$). PAS de variables (x, y).
**CHARGE COGNITIVE**: 3-4 éléments max. Exemples résolus avant pratique guidée.
</level_adaptation>`,

    cycle4: `<level_adaptation cycle="4" age="12-14 ans">
**LANGUE**: Vocabulaire scolaire standard, termes techniques du programme.
**STRUCTURE**: Raisonnement explicite, argumentation, étapes logiques.
**MATHS**: KaTeX complet (équations, $\\sqrt{}$, $\\pi$, Pythagore, Thalès).
**CHARGE COGNITIVE**: 4-5 éléments. Alterner explications et pratique.
</level_adaptation>`,

    lycee: `<level_adaptation cycle="lycee" age="15-17 ans">
**LANGUE**: Vocabulaire académique, précision scientifique, terminologie officielle.
**STRUCTURE**: Analyse nuancée, problématisation, raisonnement autonome.
**MATHS**: KaTeX avancé (limites $\\lim$, intégrales $\\int$, dérivées $f'(x)$, vecteurs $\\vec{u}$).
**CHARGE COGNITIVE**: Capacité adulte. Scaffolding progressif vers l'autonomie.
</level_adaptation>`
  };

  return adaptations[cycle];
}

/**
 * Vérifie si le niveau nécessite KaTeX simplifié
 */
export function needsSimplifiedKaTeX(level: EducationLevelType): boolean {
  const cycle = getCycleFromLevel(level);
  return cycle === 'cycle2' || cycle === 'cycle3';
}
