/**
 * Tool Executor - Dispatch des appels d'outils Mistral
 *
 * Chaque outil retourne un objet JSON sérialisable avec un type structuré
 * (ToolResult<T> = success | error). Les erreurs sont catégorisées pour
 * permettre à l'agent de décider du retry. Jamais de throw.
 * CCA Sprint 1 safety: structured tool errors.
 */

import { ragService } from '../rag.service.js';
import { generateCards, type CardGenerationResult } from '../learning/card-generator.service.js';
import { learningService } from '../learning/learning.service.js';
import { cognitiveProfileService } from '../cognitive-profile.service.js';
import { makeToolError, type ToolResult } from './tool-errors.js';
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
 * deck. Consumers (e.g. gemini-chat stream emitter) should narrow on
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

/** Tools that make network calls and benefit from a single retry */
const RETRYABLE_TOOLS = new Set([
  'search_educational_content',
]);

const RETRY_DELAY_MS = 1500;

/**
 * Execute un outil et retourne le résultat structuré.
 * Ne throw jamais — les erreurs sont encapsulées dans ToolResult.
 * Les outils réseau (RAG) bénéficient d'1 retry automatique.
 * CCA Sprint 1 safety: structured ToolResult<T> | ToolError.
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult | object> {
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
        // Transient error: rate limit, timeout, 5xx — safe to retry.
        return makeToolError(
          'transient',
          `${toolName} failed after retry. The AI can safely retry this request.`,
        );
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
      // Non-transient error: assume business logic failure.
      return makeToolError(
        'business',
        `Erreur lors de l'exécution de ${toolName}. Indique à l'élève que tu n'as pas pu vérifier dans les programmes officiels.`,
      );
    }
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
      return await executeRagSearch(args, context);

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

async function executeRagSearch(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<object> {
  const startTime = Date.now();
  const query = typeof args.query === 'string' ? args.query : '';
  const niveau = (typeof args.niveau === 'string' ? args.niveau : '6eme') as EducationLevelType;
  const matiere = typeof args.matiere === 'string' ? args.matiere : 'general';
  const limit = typeof args.limit === 'number' ? args.limit : 5;

  const isAvailable = await ragService.isAvailable();
  if (!isAvailable) {
    return makeToolError(
      'transient',
      'Le service de recherche est temporairement indisponible. Indique à l\'élève que tu ne peux pas vérifier dans les programmes officiels actuellement.',
    );
  }

  const result = await ragService.hybridSearch({
    query,
    niveau,
    matiere,
    limit,
    auditUserId: context.userId,
    auditSessionId: context.sessionId,
  });

  return {
    found: result.semanticChunks.length > 0,
    context: result.context,
    resultsCount: result.semanticChunks.length,
    averageScore: result.averageSimilarity,
    bestMatchSection: result.bestMatchSection,
    bestMatchMatiere: result.bestMatchMatiere,
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
        auditUserId: context.userId,
        auditSessionId: context.sessionId,
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
    return makeToolError(
      'business',
      `Erreur lors de la génération des cartes: ${result.error}`,
    );
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
    return {
      found: false,
      message: `Sujet "${topic}" non reconnu. Sujets disponibles : overview, navigation, chat, flashcards, pronote, files, subscription, profile.`,
    };
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
