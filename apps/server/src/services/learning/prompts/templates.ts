/**
 * Templates de cartes pour la génération IA
 *
 * Chaque template définit la structure attendue pour un type de carte.
 * Format compact pour réduire les tokens du prompt.
 *
 * Légende:
 * - {} = objet avec les champs listés
 * - [] = array avec nombre d'éléments suggéré
 * - ? = champ optionnel
 */

import type { CardType } from '../types.js';

// ============================================================================
// TEMPLATES PAR TYPE DE CARTE
// ============================================================================

/**
 * Templates compacts pour chaque type de carte
 * Utilisés dans le prompt pour guider la structure de sortie
 */
export const CARD_TEMPLATES: Record<CardType, string> = {
  // Pédagogique - théorie avant pratique
  concept: 'concept: {title, explanation, keyPoints[2-4], example?, formula?}',

  // Universels
  flashcard: 'flashcard: {front, back, hints?}',
  qcm: 'qcm: {question, options[2-6], correctIndex, explanation, hints?, commonMistakes?}',
  vrai_faux: 'vrai_faux: {statement, isTrue:boolean, explanation, commonMistakes?}',

  // Langues
  matching: 'matching: {instruction, pairs[3-6]:[{left,right}]}',
  fill_blank: 'fill_blank: {sentence:"La ___ est...", options, correctIndex, explanation, hints?, commonMistakes?}',
  word_order: 'word_order: {instruction, words[], correctSentence, translation?, hints?}',

  // Maths/Sciences
  calculation: 'calculation: {problem, steps[], answer, hints?, commonMistakes?}',

  // Histoire-Géo
  timeline: 'timeline: {instruction, events[3-6]:[{event,date?,hint?}], correctOrder[]}',
  matching_era: 'matching_era: {instruction, items[], eras[], correctPairs:[[itemIdx,eraIdx]]}',
  cause_effect: 'cause_effect: {context, cause, possibleEffects[], correctIndex, explanation, commonMistakes?}',

  // SVT
  classification: 'classification: {instruction, items[], categories[], correctClassification:{cat:[idx]}, commonMistakes?}',
  process_order: 'process_order: {instruction, processName, steps[], correctOrder[], hints?}',

  // Français
  grammar_transform: 'grammar_transform: {instruction, originalSentence, transformationType:"tense|voice|form|number", correctAnswer, explanation, acceptableVariants?, hints?, commonMistakes?}',

  // Sciences Cognitives 2025 (Extension: Pressley 1987)
  reformulation: 'reformulation: {concept, prompt, keyElements[2-5], sampleAnswer, context?, hints?}'
};

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Génère les templates pour une liste de types de cartes
 * @param types Liste des types de cartes à inclure
 * @returns Templates formatés pour le prompt
 */
export function getTemplatesForTypes(types: CardType[]): string {
  return types
    .filter(type => CARD_TEMPLATES[type])
    .map(type => CARD_TEMPLATES[type])
    .join('\n');
}

/**
 * Vérifie si un type de carte existe dans les templates
 */
export function isValidCardType(type: string): type is CardType {
  return type in CARD_TEMPLATES;
}
