/**
 * Tool Executor — dispatch des appels d'outils Mistral.
 *
 * Chaque outil retourne un objet JSON sérialisable, transformé en `role: tool`
 * message côté chat pour la prochaine itération du modèle. Les erreurs sont
 * encapsulées (jamais throw) pour éviter d'interrompre le streaming.
 */

import { ragService } from '../rag.service.js';
import { generateCards, type CardGenerationResult } from '../learning/card-generator.service.js';
import { learningService } from '../learning/learning.service.js';
import { cognitiveProfileService } from '../cognitive-profile.service.js';
import { getLevelConfig } from '../../config/learning-config.js';
import { getAppHelpContent } from '../../config/app-guide/index.js';
import { logger } from '../../lib/observability.js';
import type { EducationLevelType } from '../../types/index.js';

export interface ToolExecutionContext {
  userId: string;
  schoolLevel: EducationLevelType;
  sessionId: string;
  userRole: 'student' | 'parent';
}

/**
 * Structured result returned when `generate_flashcards` successfully creates a
 * deck. Consumers (e.g. mistral-chat stream emitter) narrow on
 * `kind: 'deck_created'` rather than duck-typing `deckId && generated`.
 */
export interface DeckCreatedToolResult {
  kind: 'deck_created';
  generated: true;
  deckId: string;
  deckTitle: string;
  cardCount: number;
  topic: string;
  subject: string;
  message: string;
}

export function isDeckCreatedResult(value: unknown): value is DeckCreatedToolResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { kind?: unknown }).kind === 'deck_created'
  );
}

/**
 * Structured tool error — CCA D2 §2 / Anthropic tool error pattern.
 *
 * Lets the model decide between retry / reformulate / escalate based on the
 * `errorCategory` and `isRetryable` flags. Replaces the legacy ad-hoc
 * `{error: true, message: '…'}` shape which was the #1 anti-pattern flagged
 * in the audit.
 *
 * - transient   : timeout, 5xx, rate-limit. Safe to retry.
 * - validation  : bad arguments, schema mismatch. Retry only after fixing input.
 * - business    : valid call, unexpected domain state (e.g. missing profile).
 * - permission  : 401/403, RLS denial. Never retry, escalate.
 */
export type ToolErrorCategory = 'transient' | 'validation' | 'business' | 'permission';

export interface StructuredToolError {
  isError: true;
  errorCategory: ToolErrorCategory;
  isRetryable: boolean;
  message: string;
  partialResults?: unknown;
}

export function makeToolError(
  category: ToolErrorCategory,
  message: string,
  partialResults?: unknown,
): StructuredToolError {
  const error: StructuredToolError = {
    isError: true,
    errorCategory: category,
    isRetryable: category === 'transient',
    message,
  };
  if (partialResults !== undefined) {
    error.partialResults = partialResults;
  }
  return error;
}

export function isStructuredToolError(value: unknown): value is StructuredToolError {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { isError?: unknown }).isError === true &&
    typeof (value as { errorCategory?: unknown }).errorCategory === 'string'
  );
}

/** Tools that make network calls and benefit from a single retry */
const RETRYABLE_TOOLS = new Set([
  'search_educational_content',
]);

const RETRY_DELAY_MS = 1500;

/**
 * Execute un outil et retourne le résultat JSON.
 * Ne throw jamais — les erreurs sont encapsulées dans la réponse.
 * Les outils réseau (RAG) bénéficient d'1 retry automatique.
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<object> {
  const startTime = Date.now();

  logger.info('Executing tool', {
    operation: 'tool-executor:call',
    toolName,
    userId: context.userId,
  });

  try {
    return await executeToolOnce(toolName, args, context);
  } catch (error) {
    // Retry once for network-dependent tools
    if (RETRYABLE_TOOLS.has(toolName)) {
      logger.warn('Tool execution failed, retrying once', {
        operation: 'tool-executor:retry',
        toolName,
        userId: context.userId,
        _error: error instanceof Error ? error.message : String(error),
      });

      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));

      try {
        return await executeToolOnce(toolName, args, context);
      } catch (retryError) {
        logger.error('Tool execution failed after retry', {
          operation: 'tool-executor:retry-failed',
          toolName,
          userId: context.userId,
          _error: retryError instanceof Error ? retryError.message : String(retryError),
          durationMs: Date.now() - startTime,
          severity: 'high' as const,
        });
      }
    } else {
      logger.error('Tool execution failed', {
        operation: 'tool-executor:error',
        toolName,
        userId: context.userId,
        _error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
        severity: 'high' as const,
      });
    }

    // Network/runtime exception thrown by the tool itself = transient by default.
    // Permission and business errors are surfaced from inside the tool body via
    // makeToolError() with the right category before they ever reach this catch.
    return makeToolError(
      'transient',
      `Erreur lors de l'exécution de ${toolName}. Indique à l'élève que tu n'as pas pu vérifier dans les programmes officiels.`,
    );
  }
}

/** Single execution attempt for a tool */
async function executeToolOnce(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<object> {
  switch (toolName) {
    case 'search_educational_content':
      return await executeRagSearch(args);

    case 'generate_flashcards':
      return await executeGenerateFlashcards(args, context);

    case 'get_student_profile':
      return await executeGetProfile(context);

    case 'update_student_profile':
      return await executeUpdateProfile(args, context);

    case 'get_app_help':
      return executeGetAppHelp(args, context);

    default:
      return makeToolError('validation', `Outil inconnu: ${toolName}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TOOL IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════

async function executeRagSearch(args: Record<string, unknown>): Promise<object> {
  const startTime = Date.now();
  const query = typeof args.query === 'string' ? args.query : '';
  const niveau = (typeof args.niveau === 'string' ? args.niveau : '6eme') as EducationLevelType;
  const matiere = typeof args.matiere === 'string' ? args.matiere : 'general';
  const limit = typeof args.limit === 'number' ? args.limit : 5;

  const isAvailable = await ragService.isAvailable();
  if (!isAvailable) {
    // Service down vs zero results: distinct outcomes per CCA D5 §3.
    // We surface a transient error instead of pretending we got an empty
    // search result — the model otherwise believes the curriculum simply
    // does not cover the topic.
    return makeToolError(
      'transient',
      'Le service de recherche est temporairement indisponible. Indique à l\'élève que tu ne peux pas vérifier dans les programmes officiels actuellement.',
      { searchTimeMs: Date.now() - startTime },
    );
  }

  const result = await ragService.hybridSearch({
    query,
    niveau,
    matiere,
    limit,
  });

  return {
    found: result.semanticChunks.length > 0,
    context: result.context,
    resultsCount: result.semanticChunks.length,
    averageScore: result.averageSimilarity,
    bestMatchTitle: result.bestMatchTitle,
    bestMatchDomaine: result.bestMatchDomaine,
    chunks: result.semanticChunks,
    searchTimeMs: Date.now() - startTime,
  };
}

async function executeGenerateFlashcards(
  args: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<object> {
  const topic = typeof args.topic === 'string' ? args.topic : '';
  const subject = typeof args.subject === 'string' ? args.subject : '';

  // Adapt card count to school level (half of cardsPerSession, capped at 10 for chat)
  const levelConfig = getLevelConfig(context.schoolLevel);
  const maxChatCards = Math.min(Math.floor(levelConfig.cardsPerSession / 2), 10);
  const requestedCount = typeof args.cardCount === 'number' ? args.cardCount : 5;
  const cardCount = Math.min(Math.max(requestedCount, 3), maxChatCards);

  // Fetch RAG context for the flashcard topic
  let ragContext = '';
  const isAvailable = await ragService.isAvailable();
  if (isAvailable) {
    try {
      const ragResult = await ragService.hybridSearch({
        query: topic,
        niveau: context.schoolLevel,
        matiere: subject,
        limit: 3,
      });
      ragContext = ragResult.context;
    } catch (err) {
      logger.warn('RAG unavailable for flashcards, continuing without context', {
        operation: 'tool-executor:flashcards-rag',
        _error: err instanceof Error ? err.message : String(err),
        userId: context.userId,
      });
    }
  }

  const result = await generateCards({
    topic,
    subject,
    level: context.schoolLevel,
    ragContext,
    cardCount,
  });

  if ('success' in result && result.success === false) {
    // Card generator already classifies errors via its `code` field —
    // SERVICE_UNAVAILABLE / GENERATION_FAILED → transient (Mistral retryable),
    // INVALID_OUTPUT → validation (model produced bad JSON, retry won't help
    // without prompt feedback).
    const category: ToolErrorCategory = result.code === 'INVALID_OUTPUT'
      ? 'validation'
      : 'transient';
    return makeToolError(category, `Erreur lors de la génération des cartes: ${result.error}`);
  }

  const successResult = result as CardGenerationResult;

  // Persist deck + cards via the shared LearningService transaction
  // (same code path as POST /api/learning/generate).
  const { deck: newDeck, cards: insertedCards } = await learningService.createDeckWithCards({
    userId: context.userId,
    deck: {
      title: topic,
      description: `Cartes créées depuis la conversation`,
      subject,
      source: 'conversation',
      sourceId: context.sessionId,
      schoolLevel: context.schoolLevel,
    },
    cards: successResult.cards,
  });

  logger.info('Flashcards persisted from chat', {
    operation: 'tool-executor:flashcards-persisted',
    userId: context.userId,
    sessionId: context.sessionId,
    deckId: newDeck.id,
    cardCount: insertedCards.length,
  });

  const deckResult: DeckCreatedToolResult = {
    kind: 'deck_created',
    generated: true,
    deckId: newDeck.id,
    deckTitle: newDeck.title,
    cardCount: insertedCards.length,
    topic,
    subject,
    message: `${insertedCards.length} cartes de révision sur "${topic}" ont été créées et sauvegardées.`,
  };
  return deckResult;
}

function executeGetAppHelp(
  args: Record<string, unknown>,
  context: ToolExecutionContext
): object {
  const topic = typeof args.topic === 'string' ? args.topic : '';
  const content = getAppHelpContent(topic, context.userRole);

  if (!content) {
    return makeToolError(
      'validation',
      `Sujet "${topic}" non reconnu. Sujets disponibles : overview, navigation, chat, flashcards, pronote, files, subscription, profile.`,
    );
  }

  return {
    found: true,
    topic,
    role: context.userRole,
    guide: content,
  };
}

async function executeGetProfile(context: ToolExecutionContext): Promise<object> {
  const profile = await cognitiveProfileService.getProfile(context.userId);

  if (!profile) {
    return {
      exists: false,
      message: "Pas de profil cognitif pour cet élève. C'est peut-être sa première interaction.",
    };
  }

  return {
    exists: true,
    strengths: profile.strengths,
    weaknesses: profile.weaknesses,
    preferredStyle: profile.preferredStyle,
    observations: ((profile.observations as Array<{ observation: string }>) ?? [])
      .slice(-5)
      .map((o) => o.observation),
    lastUpdated: profile.lastUpdatedByAgent?.toISOString() ?? null,
  };
}

async function executeUpdateProfile(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<object> {
  const observation = typeof args.observation === 'string' ? args.observation.trim().slice(0, 250) : '';
  const subject = typeof args.subject === 'string' ? args.subject.trim() : '';

  // Observation + subject required: reject empty calls so the agent doesn't
  // silently burn a tool slot without writing anything.
  if (!observation || !subject) {
    return makeToolError(
      'validation',
      "Observation ou matière manquante — le profil n'a pas été mis à jour.",
    );
  }

  const strengthRaw = typeof args.strength === 'string' ? args.strength.trim().slice(0, 100) : undefined;
  const weaknessRaw = typeof args.weakness === 'string' ? args.weakness.trim().slice(0, 100) : undefined;
  const preferredStyle = typeof args.preferredStyle === 'string' ? args.preferredStyle : undefined;

  // Merge new strength/weakness into the existing lists (dedupe, keep most
  // recent 10 of each). Without the merge step, a single call would overwrite
  // everything the agent previously recorded.
  const existing = await cognitiveProfileService.getProfile(context.userId);
  const existingStrengths = (existing?.strengths as string[] | null) ?? [];
  const existingWeaknesses = (existing?.weaknesses as string[] | null) ?? [];

  const mergedStrengths = strengthRaw
    ? Array.from(new Set([...existingStrengths, strengthRaw])).slice(-10)
    : undefined;
  const mergedWeaknesses = weaknessRaw
    ? Array.from(new Set([...existingWeaknesses, weaknessRaw])).slice(-10)
    : undefined;

  await cognitiveProfileService.updateProfile(context.userId, {
    observation,
    subject,
    ...(mergedStrengths && { strengths: mergedStrengths }),
    ...(mergedWeaknesses && { weaknesses: mergedWeaknesses }),
    ...(preferredStyle && { preferredStyle }),
  });

  logger.info('Student profile updated by agent', {
    operation: 'tool-executor:profile-updated',
    userId: context.userId,
    sessionId: context.sessionId,
    subject,
    hasStrength: !!strengthRaw,
    hasWeakness: !!weaknessRaw,
    hasStyle: !!preferredStyle,
  });

  return {
    updated: true,
    message: "Profil mis à jour. Continue l'échange sans le mentionner à l'élève.",
  };
}
