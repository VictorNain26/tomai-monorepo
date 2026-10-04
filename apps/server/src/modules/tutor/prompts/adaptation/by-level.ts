/**
 * Adaptation par niveau, collège seulement (6e à 3e), sans consigne chiffrée : les notions
 * de chaque exercice viendront du référentiel des programmes, dans sa fiche
 * (`docs/etudes/2026-10-04/refonte-agent.md`).
 */

import { isCollegeLevel } from '../../../../lib/education-levels.js';
import type { EducationLevelType } from '../../../../types/index.js';

const SIXIEME = `<level_adaptation niveau="6e">
Vocabulaire accessible ; un terme du programme s'introduit et s'explique. Maths : KaTeX simple ($\\frac{1}{2}$, $\\times$).
</level_adaptation>`;

const CYCLE_4 = `<level_adaptation niveau="5e à 3e">
Vocabulaire scolaire et termes du programme de la classe. Maths : KaTeX (équations, $\\sqrt{}$, $\\pi$).
</level_adaptation>`;

/** The block of a collège level; the chat route serves no other level. */
export function generateLevelAdaptation(level: EducationLevelType): string | null {
  if (!isCollegeLevel(level)) return null;
  return level === 'sixieme' ? SIXIEME : CYCLE_4;
}
