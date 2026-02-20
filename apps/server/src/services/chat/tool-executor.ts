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
import { logger } from '../../lib/observability.js';
import type { EducationLevelType } from '../../types/index.js';

export interface ToolExecutionContext {
  userId: string;
  schoolLevel: EducationLevelType;
}

/**
 * Execute un outil et retourne le résultat JSON
 * Ne throw jamais - les erreurs sont encapsulées dans la réponse
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

      default:
        return { error: true, message: `Outil inconnu: ${toolName}` };
    }
  } catch (error) {
    logger.error('Tool execution failed', {
      operation: 'tool-executor:error',
      toolName,
      userId: context.userId,
      _error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
      severity: 'high' as const,
    });
    return {
      error: true,
      message: `Erreur lors de l'exécution de ${toolName}. Réponds avec tes connaissances.`,
    };
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
      message: 'Le service de recherche est temporairement indisponible. Réponds avec tes connaissances générales.',
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
  const cardCount = Math.min(Math.max((args.cardCount as number) ?? 5, 3), 10);

  // Fetch RAG context for the flashcard topic
  let ragContext = '';
  try {
    const isAvailable = await ragService.isAvailable();
    if (isAvailable) {
      const ragResult = await ragService.hybridSearch({
        query: topic,
        niveau: context.schoolLevel,
        matiere: subject,
        limit: 3,
      });
      ragContext = ragResult.context;
    }
  } catch {
    // RAG context is optional for flashcards
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

  return {
    generated: true,
    cardCount: successResult.count,
    topic,
    subject,
    message: `${successResult.count} cartes de révision ont été générées sur "${topic}".`,
    cards: successResult.cards.map((c) => ({
      cardType: c.cardType,
      preview: JSON.stringify(c.content).substring(0, 200),
    })),
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
