import {
  HarmBlockThreshold,
  HarmCategory,
  ThinkingLevel,
  type SafetySetting,
} from '@google/genai';
import { sql, eq, and } from 'drizzle-orm';
import { db } from '../../db/connection.js';
import { learningCards, learningDecks } from '../../db/schema.js';
import { logger } from '../../lib/observability.js';

export const MAX_TOOL_ITERATIONS = 5;

/**
 * Timeouts for Gemini streaming. The setup timeout guards the initial API
 * handshake; the chunk timeout catches streams that stall mid-response.
 */
export const GEMINI_STREAM_SETUP_TIMEOUT_MS = 90_000;
export const GEMINI_STREAM_CHUNK_TIMEOUT_MS = 60_000;

export const THINKING_LEVEL_MAP: Record<string, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

/**
 * Map the tenant-facing safety level to Gemini's threshold enum.
 *
 * For a CP-Terminale platform the default is 'medium' which blocks
 * medium-and-above harm scores across all four standard categories. Set the
 * env var GEMINI_SAFETY to override per-environment.
 */
const SAFETY_THRESHOLD_MAP: Record<'none' | 'low' | 'medium' | 'high', HarmBlockThreshold> = {
  none: HarmBlockThreshold.BLOCK_NONE,
  low: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  medium: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  high: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
};

const SAFETY_CATEGORIES: readonly HarmCategory[] = [
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
];

export function buildSafetySettings(level: 'none' | 'low' | 'medium' | 'high'): SafetySetting[] {
  const threshold = SAFETY_THRESHOLD_MAP[level];
  return SAFETY_CATEGORIES.map(category => ({ category, threshold }));
}

/**
 * Wrap a student message with structured delimiters so the model treats any
 * instruction-looking text inside as content to analyse, never as an order to
 * follow. Pairs with the INSTRUCTION_HIERARCHY block in the system prompt.
 */
export function wrapUserMessage(content: string): string {
  return `<student_message>\n${content}\n</student_message>`;
}

export function getToolStatusLabel(name: string): string {
  switch (name) {
    case 'search_educational_content': return 'Recherche dans les programmes...';
    case 'generate_flashcards': return 'Création de flashcards...';
    case 'get_student_profile': return 'Analyse du profil...';
    case 'update_student_profile': return 'Mémorisation...';
    case 'get_app_help': return "Consultation du guide...";
    default: return 'Traitement en cours...';
  }
}

export async function getLearningContext(userId: string): Promise<string | null> {
  try {
    const dueResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(learningCards)
      .innerJoin(learningDecks, eq(learningCards.deckId, learningDecks.id))
      .where(and(
        eq(learningDecks.userId, userId),
        sql`(${learningCards.fsrsData}->>'due')::timestamptz <= now()`
      ));

    const dueCount = dueResult[0]?.count ?? 0;

    const weakSubjects = await db
      .select({
        subject: learningDecks.subject,
        totalLapses: sql<number>`sum((${learningCards.fsrsData}->>'lapses')::int)::int`,
      })
      .from(learningCards)
      .innerJoin(learningDecks, eq(learningCards.deckId, learningDecks.id))
      .where(and(
        eq(learningDecks.userId, userId),
        sql`(${learningCards.fsrsData}->>'lapses')::int > 0`
      ))
      .groupBy(learningDecks.subject)
      .orderBy(sql`sum((${learningCards.fsrsData}->>'lapses')::int) desc`)
      .limit(3);

    if (dueCount === 0 && weakSubjects.length === 0) return null;

    let context = '## CONTEXTE RÉVISION\n';

    if (dueCount > 0) {
      context += `L'élève a ${dueCount} carte${dueCount > 1 ? 's' : ''} de révision en attente.\n`;
    }

    if (weakSubjects.length > 0) {
      const weakList = weakSubjects
        .map(s => `${s.subject} (${s.totalLapses} erreurs)`)
        .join(', ');
      context += `Sujets à renforcer : ${weakList}.\n`;
    }

    context += '→ Si le sujet de la conversation touche un de ces thèmes, propose des flashcards à la fin.';

    return context;
  } catch (err) {
    logger.warn('Failed to fetch learning context', {
      operation: 'gemini-chat:learning-context',
      _error: err instanceof Error ? err.message : String(err),
      userId,
    });
    return null;
  }
}
