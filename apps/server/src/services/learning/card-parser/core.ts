/**
 * Card Parser Core
 *
 * Main parsing logic and utilities for AI-generated cards.
 */

import type {
  ParsedCard,
  CardType,
  FlashcardContent,
  QCMContent,
  VraiFauxContent,
  MatchingContent,
  FillBlankContent,
  WordOrderContent,
  CalculationContent,
  TimelineContent,
  MatchingEraContent,
  CauseEffectContent,
  ClassificationContent,
  ProcessOrderContent,
  GrammarTransformContent,
} from '../types.js';
import { VALID_CARD_TYPES } from '../types.js';
import type { ParseResult } from './types.js';

import { validateFlashcard, validateQCM, validateVraiFaux } from './validators-universal.js';
import { validateMatching, validateFillBlank, validateWordOrder } from './validators-langues.js';
import { validateCalculation, validateClassification, validateProcessOrder } from './validators-sciences.js';
import { validateTimeline, validateMatchingEra, validateCauseEffect } from './validators-histoire.js';
import { validateGrammarTransform } from './validators-francais.js';

/**
 * Parse AI response and extract cards
 */
export function parseAIResponse(response: string): ParseResult {
  const errors: string[] = [];
  const cards: ParsedCard[] = [];

  try {
    const cleanedResponse = cleanResponse(response);
    const parsed = JSON.parse(cleanedResponse);

    if (!Array.isArray(parsed)) {
      errors.push('La réponse n\'est pas un tableau JSON');
      return { success: false, cards: [], errors, rawResponse: response };
    }

    for (let i = 0; i < parsed.length; i++) {
      const rawCard = parsed[i];
      const validationResult = validateAndNormalizeCard(rawCard);

      if (validationResult.success && validationResult.card) {
        cards.push(validationResult.card);
      } else {
        errors.push(...validationResult.errors.map(e => `Carte ${i + 1}: ${e}`));
      }
    }

    return {
      success: cards.length > 0,
      cards,
      errors,
      rawResponse: response
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    errors.push(`Erreur de parsing JSON: ${errorMessage}`);

    const recoveryResult = attemptRecovery(response);
    if (recoveryResult.cards.length > 0) {
      errors.push(`Récupération partielle: ${recoveryResult.cards.length} cartes extraites`);
      return {
        success: true,
        cards: recoveryResult.cards,
        errors,
        rawResponse: response
      };
    }

    return { success: false, cards: [], errors, rawResponse: response };
  }
}

/**
 * Clean AI response before parsing
 */
function cleanResponse(response: string): string {
  let cleaned = response.trim();

  // Remove markdown code blocks
  const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    cleaned = jsonBlockMatch[1]?.trim() ?? cleaned;
  }

  // Remove text before first [
  const firstBracket = cleaned.indexOf('[');
  if (firstBracket > 0) {
    cleaned = cleaned.substring(firstBracket);
  }

  // Remove text after last ]
  const lastBracket = cleaned.lastIndexOf(']');
  if (lastBracket > 0 && lastBracket < cleaned.length - 1) {
    cleaned = cleaned.substring(0, lastBracket + 1);
  }

  return cleaned;
}

/**
 * Validate and normalize a card
 */
function validateAndNormalizeCard(raw: unknown): {
  success: boolean;
  card?: ParsedCard;
  errors: string[];
} {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { success: false, errors: ['Carte invalide (pas un objet)'] };
  }

  const obj = raw as Record<string, unknown>;

  // Validate cardType
  const cardType = obj.cardType as string;
  if (!isValidCardType(cardType)) {
    errors.push(`cardType invalide: ${cardType}`);
    return { success: false, errors };
  }

  // Validate content
  const content = obj.content;
  if (!content || typeof content !== 'object') {
    errors.push('content manquant ou invalide');
    return { success: false, errors };
  }

  const contentRecord = content as Record<string, unknown>;

  // Dispatch to appropriate validator
  switch (cardType) {
    case 'flashcard': {
      const result = validateFlashcard(contentRecord);
      if (!result.success) return { success: false, errors: result.errors };
      return {
        success: true,
        card: { cardType: 'flashcard', content: result.content as FlashcardContent },
        errors: []
      };
    }

    case 'qcm': {
      const result = validateQCM(contentRecord);
      if (!result.success) return { success: false, errors: result.errors };
      return {
        success: true,
        card: { cardType: 'qcm', content: result.content as QCMContent },
        errors: []
      };
    }

    case 'vrai_faux': {
      const result = validateVraiFaux(contentRecord);
      if (!result.success) return { success: false, errors: result.errors };
      return {
        success: true,
        card: { cardType: 'vrai_faux', content: result.content as VraiFauxContent },
        errors: []
      };
    }

    case 'matching': {
      const result = validateMatching(contentRecord);
      if (!result.success) return { success: false, errors: result.errors };
      return {
        success: true,
        card: { cardType: 'matching', content: result.content as MatchingContent },
        errors: []
      };
    }

    case 'fill_blank': {
      const result = validateFillBlank(contentRecord);
      if (!result.success) return { success: false, errors: result.errors };
      return {
        success: true,
        card: { cardType: 'fill_blank', content: result.content as FillBlankContent },
        errors: []
      };
    }

    case 'word_order': {
      const result = validateWordOrder(contentRecord);
      if (!result.success) return { success: false, errors: result.errors };
      return {
        success: true,
        card: { cardType: 'word_order', content: result.content as WordOrderContent },
        errors: []
      };
    }

    case 'calculation': {
      const result = validateCalculation(contentRecord);
      if (!result.success) return { success: false, errors: result.errors };
      return {
        success: true,
        card: { cardType: 'calculation', content: result.content as CalculationContent },
        errors: []
      };
    }

    case 'timeline': {
      const result = validateTimeline(contentRecord);
      if (!result.success) return { success: false, errors: result.errors };
      return {
        success: true,
        card: { cardType: 'timeline', content: result.content as TimelineContent },
        errors: []
      };
    }

    case 'matching_era': {
      const result = validateMatchingEra(contentRecord);
      if (!result.success) return { success: false, errors: result.errors };
      return {
        success: true,
        card: { cardType: 'matching_era', content: result.content as MatchingEraContent },
        errors: []
      };
    }

    case 'cause_effect': {
      const result = validateCauseEffect(contentRecord);
      if (!result.success) return { success: false, errors: result.errors };
      return {
        success: true,
        card: { cardType: 'cause_effect', content: result.content as CauseEffectContent },
        errors: []
      };
    }

    case 'classification': {
      const result = validateClassification(contentRecord);
      if (!result.success) return { success: false, errors: result.errors };
      return {
        success: true,
        card: { cardType: 'classification', content: result.content as ClassificationContent },
        errors: []
      };
    }

    case 'process_order': {
      const result = validateProcessOrder(contentRecord);
      if (!result.success) return { success: false, errors: result.errors };
      return {
        success: true,
        card: { cardType: 'process_order', content: result.content as ProcessOrderContent },
        errors: []
      };
    }

    case 'grammar_transform': {
      const result = validateGrammarTransform(contentRecord);
      if (!result.success) return { success: false, errors: result.errors };
      return {
        success: true,
        card: { cardType: 'grammar_transform', content: result.content as GrammarTransformContent },
        errors: []
      };
    }

    default:
      return { success: false, errors: [`Type de carte non supporté: ${cardType}`] };
  }
}

/**
 * Attempt recovery when initial parsing fails
 */
function attemptRecovery(response: string): { cards: ParsedCard[] } {
  const cards: ParsedCard[] = [];

  // Try to extract individual JSON objects
  const objectMatches = response.matchAll(/\{[^{}]*"cardType"[^{}]*\}/g);

  for (const match of objectMatches) {
    try {
      const obj = JSON.parse(match[0]);
      const result = validateAndNormalizeCard(obj);
      if (result.success && result.card) {
        cards.push(result.card);
      }
    } catch {
      // Ignore invalid objects
    }
  }

  return { cards };
}

/**
 * Check if value is a valid CardType
 */
function isValidCardType(value: unknown): value is CardType {
  return typeof value === 'string' && (VALID_CARD_TYPES as readonly string[]).includes(value);
}

/**
 * Count cards by type
 */
export function countCardsByType(cards: ParsedCard[]): Record<CardType, number> {
  const initial: Record<CardType, number> = {
    flashcard: 0, qcm: 0, vrai_faux: 0,
    matching: 0, fill_blank: 0, word_order: 0,
    calculation: 0,
    timeline: 0, matching_era: 0, cause_effect: 0,
    classification: 0, process_order: 0,
    grammar_transform: 0
  };

  return cards.reduce((acc, card) => {
    acc[card.cardType] = (acc[card.cardType] ?? 0) + 1;
    return acc;
  }, initial);
}
