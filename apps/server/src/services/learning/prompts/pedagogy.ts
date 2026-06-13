/**
 * Pédagogie Cards - Wrapper vers module centralisé
 *
 * Ce fichier réexporte les éléments du module shared/pedagogy
 * pour maintenir la compatibilité avec l'architecture cards.
 *
 * @see src/shared/pedagogy/csen-principles.ts pour les sources CSEN officielles
 */

import { generateCardsPedagogyPrompt } from '../../../shared/pedagogy/index.js';

/**
 * Génère le bloc pédagogique complet pour le prompt de génération de cards
 */
export function getPedagogyPromptBlock(): string {
  return generateCardsPedagogyPrompt();
}
