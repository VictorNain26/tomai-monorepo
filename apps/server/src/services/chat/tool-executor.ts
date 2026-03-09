/**
 * Tool Executor - Dispatch des appels d'outils Gemini
 *
 * Chaque outil retourne un objet JSON sérialisable pour functionResponse.
 * Les erreurs sont encapsulées (jamais throw).
 */

import { ragService } from '../rag.service.js';
import { pronoteService } from '../pronote.service.js';
import { generateCards, type CardGenerationResult } from '../learning/card-generator.service.js';
import { cognitiveProfileService } from '../cognitive-profile.service.js';
import { fsrsService } from '../fsrs.service.js';
import { db } from '../../db/connection.js';
import { learningDecks, learningCards } from '../../db/schema.js';
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

/** Tools that make network calls and benefit from a single retry */
const RETRYABLE_TOOLS = new Set([
  'search_educational_content',
  'get_student_homework',
  'get_student_grades',
  'get_student_timetable',
]);

const RETRY_DELAY_MS = 1500;

/**
 * Execute un outil et retourne le résultat JSON.
 * Ne throw jamais — les erreurs sont encapsulées dans la réponse.
 * Les outils réseau (RAG, Pronote) bénéficient d'1 retry automatique.
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

    return {
      error: true,
      message: `Erreur lors de l'exécution de ${toolName}. Indique à l'élève que tu n'as pas pu vérifier dans les programmes officiels.`,
    };
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

    case 'get_student_homework':
      return await executeGetHomework(args, context);

    case 'get_student_grades':
      return await executeGetGrades(context);

    case 'get_student_timetable':
      return await executeGetTimetable(args, context);

    case 'generate_flashcards':
      return await executeGenerateFlashcards(args, context);

    case 'get_student_profile':
      return await executeGetProfile(context);

    case 'get_app_help':
      return executeGetAppHelp(args, context);

    default:
      return { error: true, message: `Outil inconnu: ${toolName}` };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TOOL IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════

async function executeRagSearch(args: Record<string, unknown>): Promise<object> {
  const startTime = Date.now();
  const query = args.query as string;
  const niveau = args.niveau as EducationLevelType;
  const matiere = args.matiere as string;
  const limit = (args.limit as number) ?? 5;

  const isAvailable = await ragService.isAvailable();
  if (!isAvailable) {
    return {
      found: false,
      context: '',
      resultsCount: 0,
      averageScore: 0,
      chunks: [],
      searchTimeMs: Date.now() - startTime,
      serviceUnavailable: true,
      message: 'Le service de recherche est temporairement indisponible. Indique à l\'élève que tu ne peux pas vérifier dans les programmes officiels actuellement.',
    };
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

async function executeGetHomework(
  args: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<object> {
  const weekOffset = (args.weekOffset as number) ?? 0;

  const homework = await pronoteService.getHomeworkForChild(context.userId, weekOffset);

  if (homework === null) {
    return {
      error: true,
      connected: false,
      message: "L'élève n'a pas Pronote connecté. Tu ne peux pas accéder à ses devoirs.",
    };
  }

  return {
    homework,
    count: homework.length,
    weekOffset,
  };
}

async function executeGetGrades(context: ToolExecutionContext): Promise<object> {
  const grades = await pronoteService.getGradesForChild(context.userId);

  if (grades === null) {
    return {
      error: true,
      connected: false,
      message: "L'élève n'a pas Pronote connecté. Tu ne peux pas accéder à ses notes.",
    };
  }

  return {
    grades,
    count: grades.length,
  };
}

async function executeGetTimetable(
  args: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<object> {
  const weekOffset = (args.weekOffset as number) ?? 0;

  const timetable = await pronoteService.getTimetableForChild(context.userId, weekOffset);

  if (timetable === null) {
    return {
      error: true,
      connected: false,
      message: "L'élève n'a pas Pronote connecté. Tu ne peux pas accéder à son emploi du temps.",
    };
  }

  return {
    timetable,
    count: timetable.length,
    weekOffset,
  };
}

async function executeGenerateFlashcards(
  args: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<object> {
  const topic = args.topic as string;
  const subject = args.subject as string;

  // Adapt card count to school level (half of cardsPerSession, capped at 10 for chat)
  const levelConfig = getLevelConfig(context.schoolLevel);
  const maxChatCards = Math.min(Math.floor(levelConfig.cardsPerSession / 2), 10);
  const requestedCount = (args.cardCount as number) ?? 5;
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
    return {
      error: true,
      message: `Erreur lors de la génération des cartes: ${result.error}`,
    };
  }

  const successResult = result as CardGenerationResult;

  // Persist deck + cards in DB via atomic transaction
  const { newDeck, insertedCards } = await db.transaction(async (tx) => {
    const [createdDeck] = await tx
      .insert(learningDecks)
      .values({
        userId: context.userId,
        title: topic,
        description: `Cartes créées depuis la conversation`,
        subject,
        source: 'conversation',
        sourceId: context.sessionId,
        schoolLevel: context.schoolLevel,
        cardCount: successResult.count,
      })
      .returning();

    if (!createdDeck) {
      throw new Error('Échec de la création du deck');
    }

    const cardsToInsert = successResult.cards.map((card, index) => ({
      deckId: createdDeck.id,
      cardType: card.cardType,
      content: card.content,
      position: index,
      fsrsData: fsrsService.initializeCardFsrsData(),
    }));

    const createdCards = await tx
      .insert(learningCards)
      .values(cardsToInsert)
      .returning();

    if (createdCards.length === 0) {
      throw new Error("Échec de l'insertion des cartes");
    }

    return { newDeck: createdDeck, insertedCards: createdCards };
  });

  logger.info('Flashcards persisted from chat', {
    operation: 'tool-executor:flashcards-persisted',
    userId: context.userId,
    sessionId: context.sessionId,
    deckId: newDeck.id,
    cardCount: insertedCards.length,
  });

  return {
    generated: true,
    deckId: newDeck.id,
    deckTitle: newDeck.title,
    cardCount: insertedCards.length,
    topic,
    subject,
    message: `${insertedCards.length} cartes de révision sur "${topic}" ont été créées et sauvegardées.`,
  };
}

function executeGetAppHelp(
  args: Record<string, unknown>,
  context: ToolExecutionContext
): object {
  const topic = args.topic as string;
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
