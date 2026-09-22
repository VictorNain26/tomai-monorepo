/**
 * Card Generator Service - Architecture Simplifiée 2025
 *
 * Génération de cartes en UN SEUL appel Mistral avec schema simplifié.
 *
 * Architecture Evidence-Based:
 * - Schema simplifié (cardType enum + content object) → lisible et stable
 * - Prompt détaillé guide la structure de chaque type
 * - Validation Zod stricte après parsing (discriminatedUnion)
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

import { generateStructured } from '../../lib/ai/mistral-client.js';
import { CardGenerationOutputSchema } from '../../lib/ai/schemas/index.js';
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
import type { CardGenerationParams, ParsedCard } from './types.js';

// Prompt cache sur l'instruction de base + adaptations cycle/sujet.
const CARD_GENERATOR_PROMPT_VERSION = '2026-05-18';
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

// CARD_GENERATOR_PROMPT_VERSION : déjà défini en haut du fichier comme const
// pour le prompt cache key. Conservé en export pour compat.
;

// ============================================================================
// JSON SCHEMA SIMPLIFIÉ
// ============================================================================

/**
 * Schema minimal — Architecture Evidence-Based
 *
 * Le schema garde délibérément `content` non typé (object libre) pour deux
 * raisons : (1) 15 cardTypes × leurs champs imbriqués formeraient un schema
 * verbeux ; (2) Mistral génère mieux quand le prompt guide la structure plutôt
 * qu'un schema exhaustif. La validation de forme métier est déléguée à Zod
 * (discriminatedUnion sur cardType) après parsing.
 *
 * Architecture:
 * - Phase 1: Schema simple (cardType enum + content object non typé)
 * - Phase 2: Validation Zod stricte après parsing (discriminatedUnion)
 */
// JSON Schema Mistral pour génération cartes — wrappé dans response_format.
const cardGenerationSchema = {
  name: 'card_generation',
  strict: false, // content reste libre car typé par cardType (validation Zod après)
  schema: {
    type: 'object',
    properties: {
      cards: {
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
                'classification', 'process_order', 'grammar_transform', 'reformulation',
              ],
              description: 'Type de carte (snake_case obligatoire)',
            },
            content: {
              type: 'object',
              description: 'Contenu de la carte selon le type (voir prompt pour structure)',
            },
          },
          required: ['cardType', 'content'],
        },
      },
    },
    required: ['cards'],
  },
} as const;

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

    // JSON Schema strict natif Mistral. Zod valide ensuite la forme métier
    // (discriminatedUnion sur cardType).
    // Prompt cache sur le préfixe pédagogique stable (templates + matière).
    const wrapped = await withRetry(
      async () => {
        const parsed = await generateStructured<{ cards: unknown[] }>({
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          maxTokens: 4096,
          schema: cardGenerationSchema,
          promptCacheKey: CARD_GENERATOR_CACHE_KEY,
        });
        // Le SDK Mistral ne nous donne pas les tokens usage en JSON Schema
        // mode via notre POST direct. Approximation : taille content sortie.
        return { parsed, tokensUsed: JSON.stringify(parsed).length / 4 };
      },
      {
        operationName: 'card-generation',
        maxAttempts: 3,
        initialDelayMs: 1000,
        nonRetryableErrors: ['INVALID_'],
      },
    );

    // generateStructured retourne déjà l'objet parsé via JSON Schema strict
    // Mistral — pas de JSON.parse manuel ni de try/catch parse error nécessaire.
    // L'objet a la forme { cards: [...] } — on extrait l'array pour la validation Zod suivante.
    const parsedJson: unknown = wrapped.parsed.cards;
    const tokensUsed = wrapped.tokensUsed;

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
