/**
 * Card Generator Service - Architecture Simplifiée 2025
 *
 * Génération de cartes en UN SEUL appel Gemini avec schema simplifié.
 *
 * Architecture Evidence-Based (Google recommandé):
 * - Schema simplifié (cardType enum + content object) → respecte limite 4 niveaux
 * - Prompt détaillé guide la structure de chaque type
 * - Validation Zod stricte après parsing (discriminatedUnion)
 *
 * @see https://ai.google.dev/gemini-api/docs/structured-output
 * @see https://discuss.ai.google.dev/t/maximum-tool-nesting-depth-update-this-morning/104341
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

import { getGeminiClient } from '../../lib/gemini-client.js';
import { CardGenerationOutputSchema } from '../../lib/ai/index.js';
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
import { withRetry } from '../../lib/retry.js';
import { appConfig } from '../../config/app.config.js';
import type { CardGenerationParams, ParsedCard } from './types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface CardGenerationResult {
  cards: ParsedCard[];
  count: number;
  tokensUsed: number;
  provider: string;
}

export interface CardGenerationError {
  success: false;
  error: string;
  code: 'GENERATION_FAILED' | 'INVALID_OUTPUT' | 'SERVICE_UNAVAILABLE';
  /** Debug info - ONLY logged server-side, NEVER sent to client */
  _debug?: { actualError: string };
}

// ============================================================================
// GEMINI CLIENT — shared singleton for DI-friendly tests
// ============================================================================

export const CARD_GENERATOR_PROMPT_VERSION = '2026-04-21';

function genai() {
  return getGeminiClient();
}

// ============================================================================
// JSON SCHEMA SIMPLIFIÉ - Respecte limite 4 niveaux Gemini
// ============================================================================

/**
 * Schema minimal pour Gemini - Architecture Evidence-Based
 *
 * Problème: discriminatedUnion avec 15 types + nested objects dépasse
 * la limite de nesting (4 niveaux) de Gemini → INVALID_ARGUMENT
 *
 * Solution Google recommandée:
 * "Simplify your schema by reducing nesting, rely on prompt to guide structure"
 * @see https://ai.google.dev/gemini-api/docs/structured-output
 * @see https://discuss.ai.google.dev/t/maximum-tool-nesting-depth-update-this-morning/104341
 *
 * Architecture:
 * - Phase 1: Schema simple (cardType enum + content object non typé)
 * - Phase 2: Validation Zod stricte après parsing (discriminatedUnion)
 *
 * Niveaux: cards[] → {cardType, content} → content fields = 3 niveaux ✅
 */
const simplifiedCardSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      cardType: {
        type: 'string',
        enum: [
          'concept', 'flashcard', 'qcm', 'vrai_faux',
          'matching', 'fill_blank', 'word_order',
          'calculation', 'timeline', 'matching_era', 'cause_effect',
          'classification', 'process_order', 'grammar_transform', 'reformulation'
        ],
        description: 'Type de carte (snake_case obligatoire)'
      },
      content: {
        type: 'object',
        description: 'Contenu de la carte selon le type (voir prompt pour structure)'
      }
    },
    required: ['cardType', 'content']
  }
} as const;

// ============================================================================
// PROMPT BUILDER
// ============================================================================

/**
 * Construit le prompt optimisé pour la génération de cartes
 * Architecture modulaire utilisant les fichiers prompts/*.ts
 *
 * Tokens estimés: ~1000-1200 (optimisé pour quotas Gemini)
 */
function buildPrompt(params: CardGenerationParams): string {
  const { topic, subject, level, cardCount, ragContext, domaine } = params;
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

  // 6. Contexte RAG (programme officiel)
  if (ragContext?.trim()) {
    parts.push(`## PROGRAMME OFFICIEL\n${ragContext}`);
  }

  // 7. Instructions finales de génération
  // Créer une liste explicite avec guillemets pour éviter toute ambiguïté
  const quotedTypes = recommendedTypes.map(t => `"${t}"`).join(' | ');

  parts.push(`## GÉNÉRATION
**Matière**: ${subject}
**Niveau**: ${level}
**Sujet**: ${topic}${domaine ? `\n**Domaine**: ${domaine}` : ''}

Génère exactement ${cardCount} cartes.

**FORMAT JSON OBLIGATOIRE** - Chaque carte DOIT avoir cette structure exacte:
\`\`\`json
[
  {
    "cardType": "vrai_faux",
    "content": { "statement": "...", "isTrue": true, "explanation": "..." }
  },
  {
    "cardType": "qcm",
    "content": { "question": "...", "options": [...], "correctIndex": 0, "explanation": "..." }
  }
]
\`\`\`

**ATTENTION CRITIQUE - cardType**:
Le champ "cardType" DOIT être EXACTEMENT une de ces valeurs (snake_case, en minuscules):
${quotedTypes}

⚠️ N'utilise JAMAIS:
- camelCase (vraiFaux, fillBlank) → INCORRECT
- kebab-case (vrai-faux, fill-blank) → INCORRECT
- Anglais (true_false, mcq) → INCORRECT
- Autres variantes → INCORRECT

Règles: cardType en snake_case EXACT, correctIndex=0-based, isTrue=boolean (pas string).`);

  return parts.join('\n\n');
}

// ============================================================================
// SERVICE PRINCIPAL
// ============================================================================

export async function generateCards(
  params: CardGenerationParams
): Promise<CardGenerationResult | CardGenerationError> {
  const startTime = Date.now();
  const provider = 'Google Gemini';

  try {
    logger.info('Starting card generation', {
      operation: 'learning:generate:start',
      topic: params.topic,
      subject: params.subject,
      level: params.level,
      requestedCards: params.cardCount
    });

    const prompt = buildPrompt(params);

    const { text, tokensUsed } = await withRetry(
      async () => {
        const response = await genai().models.generateContent({
          model: appConfig.ai.gemini.model,
          contents: prompt,
          config: {
            // Schema simplifié pour respecter limite 4 niveaux Gemini
            // Le prompt guide la structure, Zod valide après parsing
            responseMimeType: 'application/json',
            responseJsonSchema: simplifiedCardSchema,
            temperature: 0.7,
            topK: 40,
            topP: 0.95
          }
        });

        return {
          text: response.text ?? '',
          tokensUsed: response.usageMetadata?.totalTokenCount ?? 0
        };
      },
      {
        operationName: 'card-generation',
        maxAttempts: 3,
        initialDelayMs: 1000,
        nonRetryableErrors: ['INVALID_']
      }
    );

    // Parse JSON
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      logger.error('Card generation JSON parse error', {
        operation: 'learning:generate:parse_error',
        topic: params.topic,
        contentPreview: text.substring(0, 300),
        durationMs: Date.now() - startTime,
        _error: 'JSON parse failed',
        severity: 'high' as const
      });

      return {
        success: false,
        error: 'La réponse IA n\'est pas un JSON valide',
        code: 'INVALID_OUTPUT'
      };
    }

    // Best Practice 2025: Validation Zod comme défense en profondeur
    // responseJsonSchema garantit la structure, Zod valide les invariants métier
    const validation = CardGenerationOutputSchema.safeParse(parsedJson);

    if (!validation.success) {
      const errors = validation.error.issues.slice(0, 5).map(i => `${i.path.join('.')}: ${i.message}`);

      // Log première carte pour diagnostic
      const firstCard = Array.isArray(parsedJson) ? parsedJson[0] : null;

      logger.error('Card validation failed', {
        operation: 'learning:generate:validation_error',
        topic: params.topic,
        firstCard: firstCard ? JSON.stringify(firstCard) : 'N/A',
        durationMs: Date.now() - startTime,
        _error: errors.join('; '),
        severity: 'high' as const
      });

      return {
        success: false,
        error: `Cartes invalides: ${errors[0]}`,
        code: 'INVALID_OUTPUT'
      };
    }

    const cards = validation.data as ParsedCard[];
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
