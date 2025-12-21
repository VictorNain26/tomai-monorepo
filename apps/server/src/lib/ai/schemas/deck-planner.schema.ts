/**
 * Schema Zod pour le meta-planning de deck
 *
 * Phase 1 de la génération : L'IA planifie la structure du deck
 * avant de générer les cartes. Cela permet une progression
 * pédagogique optimale adaptée au contenu.
 *
 * Guardrails minimaux :
 * - Au moins 1 concept si nouvelle notion
 * - Ratio concept/exercice raisonnable
 * - Progression de difficulté cohérente
 */

import { z } from 'zod';
import { CardTypeSchema } from './cards.schema.js';

// ============================================================================
// SCHEMA DU PLAN DE DECK
// ============================================================================

/**
 * Description d'une carte planifiée
 * L'IA décrit ce que chaque carte couvrira
 */
export const PlannedCardSchema = z.object({
  cardType: CardTypeSchema,
  purpose: z.string().min(1)
    .describe('But pédagogique de cette carte (ex: "Introduire la formule", "Tester la compréhension")'),
  difficulty: z.enum(['discovery', 'practice', 'mastery'])
    .describe('Niveau de difficulté: discovery=introduction, practice=application, mastery=maîtrise'),
  notionCovered: z.string().min(1)
    .describe('Notion spécifique couverte par cette carte')
});

/**
 * Groupe de cartes autour d'une notion
 */
export const NotionGroupSchema = z.object({
  notionTitle: z.string().min(1)
    .describe('Titre de la notion'),
  cards: z.array(PlannedCardSchema)
    .min(1)
    .describe('Cartes pour cette notion (concept + exercices)')
});

/**
 * Plan complet du deck
 */
export const DeckPlanSchema = z.object({
  deckTitle: z.string().min(1)
    .describe('Titre descriptif du deck'),
  totalCards: z.number().int().min(1)
    .describe('Nombre total de cartes planifiées'),
  notions: z.array(NotionGroupSchema)
    .min(1)
    .describe('Notions à couvrir, groupées logiquement'),
  difficultyProgression: z.enum(['linear', 'spiral', 'adaptive'])
    .describe('linear=croissante, spiral=retour régulier, adaptive=selon la notion'),
  rationale: z.string().min(1)
    .describe('Justification pédagogique de cette structure')
});

// ============================================================================
// TYPES
// ============================================================================

export type PlannedCard = z.infer<typeof PlannedCardSchema>;
export type NotionGroup = z.infer<typeof NotionGroupSchema>;
export type DeckPlan = z.infer<typeof DeckPlanSchema>;

// ============================================================================
// GUARDRAILS - Validation du plan
// ============================================================================

export interface PlanValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Valide le plan avec des guardrails minimaux
 *
 * Guardrails obligatoires :
 * - Au moins 1 concept dans le deck
 * - Ratio concept/exercice entre 1:2 et 1:5
 * - Chaque notion doit avoir au moins 1 exercice après le concept
 *
 * Warnings (non bloquants) :
 * - Deck trop court (<3 cartes)
 * - Deck trop long (>20 cartes)
 * - Pas de variation de difficulté
 */
export function validateDeckPlan(plan: DeckPlan): PlanValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Flatten all cards
  const allCards = plan.notions.flatMap(n => n.cards);
  const conceptCards = allCards.filter(c => c.cardType === 'concept');
  const exerciseCards = allCards.filter(c => c.cardType !== 'concept');

  // Guardrail 1: Au moins 1 concept
  if (conceptCards.length === 0) {
    errors.push('Le deck doit contenir au moins 1 carte concept pour introduire les notions');
  }

  // Guardrail 2: Ratio concept/exercice (1:2 à 1:5)
  if (conceptCards.length > 0 && exerciseCards.length > 0) {
    const ratio = exerciseCards.length / conceptCards.length;
    if (ratio < 2) {
      warnings.push(`Ratio concept/exercice faible (${ratio.toFixed(1)}). Considérer plus d'exercices.`);
    }
    if (ratio > 5) {
      warnings.push(`Ratio concept/exercice élevé (${ratio.toFixed(1)}). Considérer plus de concepts.`);
    }
  }

  // Guardrail 3: Chaque notion doit avoir concept + exercice(s)
  for (const notion of plan.notions) {
    const hasConceptCard = notion.cards.some(c => c.cardType === 'concept');
    const hasExercise = notion.cards.some(c => c.cardType !== 'concept');

    if (hasConceptCard && !hasExercise) {
      errors.push(`La notion "${notion.notionTitle}" a un concept mais pas d'exercice`);
    }
  }

  // Warnings non bloquants
  if (allCards.length < 3) {
    warnings.push('Deck très court. Considérer plus de cartes pour une révision complète.');
  }
  if (allCards.length > 20) {
    warnings.push('Deck très long. Considérer de le diviser en plusieurs sessions.');
  }

  // Vérifier variation de difficulté
  const difficulties = new Set(allCards.map(c => c.difficulty));
  if (difficulties.size === 1) {
    warnings.push('Toutes les cartes ont la même difficulté. Varier pour une meilleure progression.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Corrige automatiquement un plan invalide si possible
 */
export function autoFixPlan(plan: DeckPlan): DeckPlan {
  const fixed = structuredClone(plan);

  // Si pas de concept, ajouter un concept au début de chaque notion
  const allCards = fixed.notions.flatMap(n => n.cards);
  const hasAnyConcept = allCards.some(c => c.cardType === 'concept');

  if (!hasAnyConcept) {
    for (const notion of fixed.notions) {
      // Ajouter un concept en premier si absent
      const hasConcept = notion.cards.some(c => c.cardType === 'concept');
      if (!hasConcept) {
        notion.cards.unshift({
          cardType: 'concept',
          purpose: `Introduire ${notion.notionTitle}`,
          difficulty: 'discovery',
          notionCovered: notion.notionTitle
        });
      }
    }
    fixed.totalCards = fixed.notions.reduce((sum, n) => sum + n.cards.length, 0);
  }

  return fixed;
}
