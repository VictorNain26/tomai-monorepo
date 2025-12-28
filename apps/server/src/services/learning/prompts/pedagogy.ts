/**
 * Pédagogie Cards - Wrapper vers module centralisé
 *
 * Ce fichier réexporte les éléments du module shared/pedagogy
 * pour maintenir la compatibilité avec l'architecture cards.
 *
 * @see src/shared/pedagogy/csen-principles.ts pour les sources CSEN officielles
 */

import {
  CSEN_FOUR_PILLARS as SHARED_PILLARS,
  SCIENTIFIC_EXTENSIONS as SHARED_EXTENSIONS,
  generateCardsPedagogyPrompt
} from '../../../shared/pedagogy/index.js';

// Réexport des données centralisées
export const CSEN_FOUR_PILLARS = SHARED_PILLARS;
export const SCIENTIFIC_EXTENSIONS = SHARED_EXTENSIONS;

// Prompts formatés pour cards (compatibilité existante)
export const CSEN_PRINCIPLES_PROMPT = `**4 Piliers de l'apprentissage (CSEN - Stanislas Dehaene)** :
1. ${CSEN_FOUR_PILLARS.attention.name} : ${CSEN_FOUR_PILLARS.attention.cardApplication}
2. ${CSEN_FOUR_PILLARS.engagementActif.name} : ${CSEN_FOUR_PILLARS.engagementActif.cardApplication}
3. ${CSEN_FOUR_PILLARS.retourErreur.name} : ${CSEN_FOUR_PILLARS.retourErreur.cardApplication}
4. ${CSEN_FOUR_PILLARS.consolidation.name} : ${CSEN_FOUR_PILLARS.consolidation.cardApplication}`;

export const OPTIONAL_FIELDS_PROMPT = `**Champs OPTIONNELS** (extensions pédagogiques) :
- hints?: ["indice1", "indice2"] - aide progressive avant correction
- commonMistakes?: [{"mistake":"...", "why":"..."}] - erreurs fréquentes à éviter`;

export const STRUCTURE_RECOMMENDATIONS = `**Structure recommandée** :
- 1-2 cartes 'concept' d'abord (poser les notions avant de tester)
- Varier les types (pas 2 QCM consécutifs)
- Chaque carte autonome et compréhensible seule`;

/**
 * Génère le bloc pédagogique complet pour le prompt de génération de cards
 */
export function getPedagogyPromptBlock(): string {
  return generateCardsPedagogyPrompt();
}
