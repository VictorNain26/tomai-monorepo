/**
 * Card Generator Service - Architecture Simplifiée 2025
 *
 * Génération de cartes en UN SEUL appel Mistral avec schema simplifié.
 *
 * Architecture Evidence-Based:
 * - Schema simplifié (cardType enum + content object) → lisible et stable
 * - Prompt détaillé guide la structure de chaque type
 * - Sortie structurée validée par le schéma Zod (discriminatedUnion sur cardType)
 *
 * ## Fondements Scientifiques
 *
 * ### CSEN (Conseil Scientifique de l'Éducation Nationale) - SOURCES OFFICIELLES
 * Les 4 piliers de l'apprentissage de Stanislas Dehaene (président CSEN) :
 * 1. Attention - Focalisation sur une notion par carte
 * 2. Engagement actif - Testing effect / récupération en mémoire
 * 3. Retour sur erreur - Feedback constructif non stressant
 * 4. Consolidation - Réactivation espacée, variation des formats
 *
 * Sources :
 * - Dehaene, S. (2018). Apprendre ! Les talents du cerveau, le défi des machines.
 * - CSEN / Académie Paris: https://pia.ac-paris.fr/portail/jcms/p1_3354981
 *
 * @see prompts/pedagogy.ts pour documentation détaillée des sources
 */

import { NoObjectGeneratedError } from 'ai';
import { generateStructured } from '../../lib/ai/mistral-client.js';
import { CardGenerationSchema } from '../../lib/ai/schemas/index.js';
import {
  getSubjectInstructions,
  getRecommendedCardTypes,
  subjectRequiresKaTeX,
  getEducationCycle,
  getCycleAdaptationInstructions,
  getPedagogyPromptBlock,
  getTemplatesForTypes,
  KATEX_INSTRUCTIONS
} from './prompts/index.js';
import { logger } from '../../lib/observability.js';
import type { CardGenerationParams, ParsedCard } from './types.js';

// Prompt cache sur l'instruction de base + adaptations cycle/sujet.
const CARD_GENERATOR_PROMPT_VERSION = '2026-09-22';
const CARD_GENERATOR_CACHE_KEY = `card-generator-${CARD_GENERATOR_PROMPT_VERSION}`;

// ============================================================================
// TYPES
// ============================================================================

export interface CardGenerationResult {
  cards: ParsedCard[];
  count: number;
  tokensUsed: number;
  provider: string;
}

interface CardGenerationError {
  success: false;
  error: string;
  code: 'GENERATION_FAILED' | 'INVALID_OUTPUT' | 'SERVICE_UNAVAILABLE';
  /** Debug info - ONLY logged server-side, NEVER sent to client */
  _debug?: { actualError: string };
}

// ============================================================================
// PROMPT BUILDER
// ============================================================================

/**
 * Construit le prompt optimisé pour la génération de cartes
 * Architecture modulaire utilisant les fichiers prompts/*.ts
 *
 * Tokens estimés: ~1000-1200
 */
function buildPrompt(params: CardGenerationParams): string {
  const { topic, subject, level, cardCount, domaine } = params;
  const requiresKaTeX = subjectRequiresKaTeX(subject);
  const cycle = getEducationCycle(level);
  const recommendedTypes = getRecommendedCardTypes(subject).slice(0, 8);

  const parts: string[] = [];

  // 1. Introduction + Principes pédagogiques CSEN (module pedagogy.ts)
  parts.push(`Tu es un expert pédagogue français. Génère exactement ${cardCount} cartes de révision pour niveau ${level}.

${getPedagogyPromptBlock()}`);

  // 2. Instructions spécifiques à la matière
  parts.push(getSubjectInstructions(subject));

  // 3. Adaptation au cycle scolaire
  parts.push(getCycleAdaptationInstructions(cycle));

  // 4. Templates des types recommandés (module templates.ts)
  parts.push(`## TYPES DE CARTES
Utilise principalement: ${recommendedTypes.slice(0, 5).join(', ')}

${getTemplatesForTypes(recommendedTypes)}`);

  // 5. KaTeX si matière scientifique
  if (requiresKaTeX) {
    parts.push(KATEX_INSTRUCTIONS);
  }

  // 6. Instructions finales de génération
  parts.push(`## GÉNÉRATION
**Matière**: ${subject}
**Niveau**: ${level}
**Sujet**: ${topic}${domaine ? `\n**Domaine**: ${domaine}` : ''}

Génère exactement ${cardCount} cartes.

Règles: correctIndex=0-based, isTrue=boolean (pas string).`);

  return parts.join('\n\n');
}

// ============================================================================
// SERVICE PRINCIPAL
// ============================================================================

export async function generateCards(
  params: CardGenerationParams
): Promise<CardGenerationResult | CardGenerationError> {
  const startTime = Date.now();
  const provider = 'Mistral';

  try {
    logger.info('Starting card generation', {
      operation: 'learning:generate:start',
      topic: params.topic,
      subject: params.subject,
      level: params.level,
      requestedCards: params.cardCount
    });

    const prompt = buildPrompt(params);

    const { object, usage } = await generateStructured({
      functionId: 'card-generation',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 4096,
      schema: CardGenerationSchema,
      schemaName: 'card_generation',
      promptCacheKey: CARD_GENERATOR_CACHE_KEY,
    });
    const cards = object.cards as ParsedCard[];
    const tokensUsed = usage.inputTokens + usage.outputTokens;
    const durationMs = Date.now() - startTime;

    logger.info('Card generation completed', {
      operation: 'learning:generate:complete',
      topic: params.topic,
      subject: params.subject,
      level: params.level,
      cardsGenerated: cards.length,
      requestedCards: params.cardCount,
      tokensUsed,
      durationMs
    });

    return {
      cards,
      count: cards.length,
      tokensUsed,
      provider
    };

  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      logger.error('Card validation failed', {
        operation: 'learning:generate:validation_error',
        topic: params.topic,
        durationMs: Date.now() - startTime,
        _error: error.message,
        severity: 'high' as const
      });
      return { success: false, error: 'Cartes invalides', code: 'INVALID_OUTPUT' };
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Detect specific error types for better diagnostics
    const isRateLimit = errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate limit');
    const isApiKey = errorMessage.toLowerCase().includes('api key') || errorMessage.includes('401');
    const isModelNotFound = errorMessage.toLowerCase().includes('model not found') || errorMessage.includes('404');
    const isQuota = errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('exceeded');
    const isUnavailable = errorMessage.toLowerCase().includes('unavailable') || errorMessage.includes('503');

    // Determine error code
    let code: 'GENERATION_FAILED' | 'INVALID_OUTPUT' | 'SERVICE_UNAVAILABLE' = 'GENERATION_FAILED';
    if (isUnavailable || isRateLimit) code = 'SERVICE_UNAVAILABLE';

    logger.error('Card generation failed', {
      operation: 'learning:generate:error',
      topic: params.topic,
      subject: params.subject,
      level: params.level,
      cardCount: params.cardCount,
      durationMs: Date.now() - startTime,
      _error: errorMessage,
      stack: errorStack,
      errorType: isRateLimit ? 'rate_limit' : isApiKey ? 'api_key' : isModelNotFound ? 'model_not_found' : isQuota ? 'quota' : isUnavailable ? 'unavailable' : 'unknown',
      severity: 'high' as const
    });

    // User-friendly error message based on error type
    let userMessage = 'Échec de la génération des cartes. Veuillez réessayer.';

    if (isRateLimit) {
      userMessage = 'Le service est temporairement surchargé. Réessayez dans quelques secondes.';
    } else if (isApiKey) {
      userMessage = 'Erreur de configuration du service AI. Contactez le support.';
    } else if (isModelNotFound) {
      userMessage = 'Le modèle AI n\'est pas disponible. Contactez le support.';
    } else if (isQuota) {
      userMessage = 'Quota API dépassé. Réessayez plus tard.';
    } else if (isUnavailable) {
      userMessage = 'Le service AI est temporairement indisponible. Réessayez dans quelques minutes.';
    }

    return {
      success: false,
      error: userMessage,
      code,
      // Include actual error details for debugging
      _debug: { actualError: errorMessage }
    };
  }
}

export function isGenerationError(
  result: CardGenerationResult | CardGenerationError
): result is CardGenerationError {
  return 'success' in result && result.success === false;
}
