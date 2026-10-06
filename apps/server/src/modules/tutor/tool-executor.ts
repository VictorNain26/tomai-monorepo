/**
 * Tool Executor - Dispatch des appels d'outils Mistral
 *
 * Chaque outil retourne un objet JSON sérialisable avec un type structuré
 * (ToolResult<T> = success | error). Les erreurs sont catégorisées pour
 * permettre à l'agent de décider du retry. Jamais de throw.
 */

import { generateCards, learningService, getLevelConfig } from '../learning/index.js';
import { checkCards } from '../learning/index.js';
import { cardTextPasses, titlePasses, type OutputCheckContext } from './output-check.js';
import { makeToolError, type ToolResult } from './tool-errors.js';
import { logger } from '../../platform/observability/logger.js';
import type { EducationLevelType } from '../../types/index.js';
import { SUBJECT_SLUGS } from '../../lib/subjects.js';

interface ToolExecutionContext {
  userId: string;
  schoolLevel: EducationLevelType;
  sessionId: string;
  check: OutputCheckContext;
}

/**
 * Structured result returned when `generate_flashcards` successfully creates a
 * deck. Consumers (e.g. the chat stream emitter) should narrow on
 * `kind: 'deck_created'` rather than duck-typing `deckId && generated`.
 */
interface DeckCreatedToolResult {
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
 * Execute un outil et retourne le résultat structuré.
 * Ne throw jamais — les erreurs sont encapsulées dans ToolResult.
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolExecutionContext,
  signal?: AbortSignal,
): Promise<ToolResult | object> {
  const startTime = Date.now();

  logger.info('Executing tool', {
    operation: 'tool-executor:call',
    toolName,
    userId: context.userId,
  });

  try {
    return await executeToolOnce(toolName, args, context, signal);
  } catch (error) {
    logger.error('Tool execution failed', {
      operation: 'tool-executor:error',
      toolName,
      userId: context.userId,
      err: error,
      durationMs: Date.now() - startTime,
      severity: 'high' as const,
    });
    return makeToolError(
      'business',
      `Erreur lors de l'exécution de ${toolName}.`,
    );
  }
}

/** Single execution attempt for a tool */
async function executeToolOnce(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolExecutionContext,
  signal?: AbortSignal,
): Promise<object> {
  switch (toolName) {
    case 'generate_flashcards':
      return await executeGenerateFlashcards(args, context, signal);

    default:
      return makeToolError('validation', `Outil inconnu: ${toolName}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TOOL IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════

async function executeGenerateFlashcards(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
  signal?: AbortSignal,
): Promise<object> {
  const topic = typeof args['topic'] === 'string' ? args['topic'] : '';
  const subject = SUBJECT_SLUGS.find((slug) => slug === args['subject']);
  if (!subject) return makeToolError('validation', 'Matière inconnue.');

  // Adapt card count to school level (half of cardsPerSession, capped at 10 for chat)
  const levelConfig = getLevelConfig(context.schoolLevel);
  const maxChatCards = Math.min(Math.floor(levelConfig.cardsPerSession / 2), 10);
  const requestedCount = typeof args['cardCount'] === 'number' ? args['cardCount'] : 5;
  const cardCount = Math.min(Math.max(requestedCount, 3), maxChatCards);

  const result = await generateCards({
    topic,
    subject,
    level: context.schoolLevel,
    cardCount,
  });

  if ('success' in result) {
    return makeToolError(
      'business',
      `Erreur lors de la génération des cartes: ${result.error}`,
    );
  }

  // A turn cut while the cards were written leaves no deck the student would never hear of.
  const cut = () => makeToolError('transient', "Le tour a été interrompu : aucune carte n'a été enregistrée.");
  if (signal?.aborted) return cut();

  // The cards and the deck's title reach the student: checked before they are stored.
  const [{ kept: checkedCards, setAside, unmoderated }, titleOk] = await Promise.all([
    checkCards(result.cards, (text) => cardTextPasses(text, context.check)),
    titlePasses(topic, context.check),
  ]);
  if (setAside > 0) {
    logger.warn('Cards set aside by the check', { operation: 'tool-executor:cards-set-aside', sessionId: context.sessionId, setAside, kept: checkedCards.length });
  }
  if (unmoderated) return makeToolError('transient', "Les cartes n'ont pas pu être vérifiées : aucune n'a été enregistrée, propose de réessayer.");
  if (checkedCards.length === 0) {
    return makeToolError('business', "Aucune carte n'a passé le contrôle : n'en propose pas d'autres sur ce sujet à ce tour.");
  }
  if (signal?.aborted) return cut();
  const deckTitle = titleOk ? topic : 'Cartes de révision';

  // Persist deck + cards via the shared LearningService transaction
  // (same code path as POST /api/learning/generate).
  const { deck: newDeck, cards: insertedCards } = await learningService.createDeckWithCards({
    userId: context.userId,
    deck: {
      title: deckTitle,
      description: `Cartes créées depuis la conversation`,
      subject,
      source: 'conversation',
      sourceId: context.sessionId,
      schoolLevel: context.schoolLevel,
    },
    cards: checkedCards,
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
    message: `${insertedCards.length} cartes de révision « ${newDeck.title} » ont été créées et sauvegardées.`,
  };
  return deckResult;
}
