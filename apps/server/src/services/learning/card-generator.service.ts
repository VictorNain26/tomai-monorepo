/**
 * Card Generator Service - Single-Phase Architecture 2025
 *
 * Génération de cartes en UN SEUL appel Gemini.
 * - responseMimeType: 'application/json' → JSON syntaxiquement valide
 * - Prompt détaillé → structure correcte par type de carte
 * - Validation Zod → conformité métier stricte
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
 * - Testing effect: https://www.site.ac-aix-marseille.fr/lyc-stexupery/spip/Tester-les-eleves-pour-les-faire-memoriser.html
 *
 * ### EXTENSIONS SCIENTIFIQUES (non-CSEN, académiquement validées)
 * - Elaborative Interrogation (Pressley 1987) → type 'reformulation'
 * - Scaffolding/ZPD (Vygotsky 1978) → champs 'hints'
 *
 * @see prompts/pedagogy.ts pour documentation détaillée des sources
 */

import { GoogleGenAI, Type } from '@google/genai';
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
}

// ============================================================================
// GEMINI CLIENT
// ============================================================================

const genai = new GoogleGenAI({ apiKey: appConfig.ai.gemini.apiKey ?? '' });

// ============================================================================
// GEMINI RESPONSE SCHEMA - Force { cardType, content } structure
// ============================================================================

/**
 * ResponseSchema for Gemini Structured Output.
 * Forces correct structure that Zod validation expects.
 *
 * Without this, Gemini may return { type: "concept", title: "..." }
 * instead of the required { cardType: "concept", content: { title: "..." } }
 */
const CARD_RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      cardType: {
        type: Type.STRING,
        enum: [
          'concept', 'flashcard', 'qcm', 'vrai_faux',
          'matching', 'fill_blank', 'word_order',
          'calculation', 'timeline', 'matching_era', 'cause_effect',
          'classification', 'process_order', 'grammar_transform', 'reformulation'
        ],
        description: 'Type de carte en snake_case'
      },
      content: {
        type: Type.OBJECT,
        description: 'Contenu de la carte selon le type'
      }
    },
    required: ['cardType', 'content'],
    propertyOrdering: ['cardType', 'content']
  }
};

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
        const response = await genai.models.generateContent({
          model: appConfig.ai.gemini.model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: CARD_RESPONSE_SCHEMA,
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

    // Validation Zod stricte
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

    logger.error('Card generation failed', {
      operation: 'learning:generate:error',
      topic: params.topic,
      subject: params.subject,
      durationMs: Date.now() - startTime,
      _error: errorMessage,
      severity: 'high' as const
    });

    return {
      success: false,
      error: 'Échec de la génération des cartes. Veuillez réessayer.',
      code: errorMessage.includes('UNAVAILABLE') ? 'SERVICE_UNAVAILABLE' : 'GENERATION_FAILED'
    };
  }
}

export function isGenerationError(
  result: CardGenerationResult | CardGenerationError
): result is CardGenerationError {
  return 'success' in result && result.success === false;
}
