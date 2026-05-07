/**
 * Helpers for the Mistral chat service.
 *
 * Mistral exposes only a single `safePrompt` boolean (no per-request safety
 * threshold matrix). Pedagogical safety is enforced via the system prompt and
 * the intent classifier rather than provider-side filters.
 */

import { sql, eq, and } from 'drizzle-orm';
import { db } from '../../db/connection.js';
import { learningCards, learningDecks } from '../../db/schema.js';
import { logger } from '../../lib/observability.js';

export const MAX_TOOL_ITERATIONS = 5;

/** Initial connect + first-token timeout for the Mistral SSE stream. */
export const MISTRAL_STREAM_SETUP_TIMEOUT_MS = 90_000;

/**
 * Per-chunk timeout. If a single chunk takes longer, something is stuck on
 * the provider side.
 */
export const MISTRAL_STREAM_CHUNK_TIMEOUT_MS = 60_000;

/**
 * Wrap a student message with structured delimiters so the model treats any
 * instruction-looking text inside as content to analyse, never as an order to
 * follow. Pairs with the INSTRUCTION_HIERARCHY block in the system prompt.
 */
export function wrapUserMessage(content: string): string {
  return `<student_message>\n${content}\n</student_message>`;
}

/**
 * System-prompt leak detector — defense layer 3 (CCA D4 §10).
 *
 * The model is instructed never to reveal its system prompt. This detector
 * is the cheap structural check that runs alongside the streaming output:
 * any of the structural XML tags from our prompt template means the prompt
 * has leaked. Runs against the accumulated content (so a tag split across
 * chunks is still caught).
 *
 * Returns the matched marker (for logging) or null if clean. Cheap regex
 * over a reasonably small string — runs once per delta in the stream loop.
 */
const SYSTEM_PROMPT_LEAK_PATTERN =
  /<\/?(?:role|safety|rag_policy|pedagogy|student_message|student|past_sessions|critical_instruction|transparency|tone)>/i;

export function detectSystemPromptLeak(content: string): string | null {
  const m = content.match(SYSTEM_PROMPT_LEAK_PATTERN);
  return m ? m[0] : null;
}

export function getToolStatusLabel(name: string): string {
  switch (name) {
    case 'search_educational_content':
      return 'Recherche dans les programmes...';
    case 'generate_flashcards':
      return 'Création de flashcards...';
    case 'get_student_profile':
      return 'Analyse du profil...';
    case 'update_student_profile':
      return 'Mémorisation...';
    case 'get_app_help':
      return 'Consultation du guide...';
    default:
      return 'Traitement en cours...';
  }
}

export async function getLearningContext(userId: string): Promise<string | null> {
  try {
    const dueResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(learningCards)
      .innerJoin(learningDecks, eq(learningCards.deckId, learningDecks.id))
      .where(
        and(
          eq(learningDecks.userId, userId),
          sql`(${learningCards.fsrsData}->>'due')::timestamptz <= now()`,
        ),
      );

    const dueCount = dueResult[0]?.count ?? 0;

    const weakSubjects = await db
      .select({
        subject: learningDecks.subject,
        totalLapses: sql<number>`sum((${learningCards.fsrsData}->>'lapses')::int)::int`,
      })
      .from(learningCards)
      .innerJoin(learningDecks, eq(learningCards.deckId, learningDecks.id))
      .where(
        and(
          eq(learningDecks.userId, userId),
          sql`(${learningCards.fsrsData}->>'lapses')::int > 0`,
        ),
      )
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
        .map((s) => `${s.subject} (${s.totalLapses} erreurs)`)
        .join(', ');
      context += `Sujets à renforcer : ${weakList}.\n`;
    }

    context +=
      '→ Si le sujet de la conversation touche un de ces thèmes, propose des flashcards à la fin.';

    return context;
  } catch (err) {
    logger.warn('Failed to fetch learning context', {
      operation: 'mistral-chat:learning-context',
      _error: err instanceof Error ? err.message : String(err),
      userId,
    });
    return null;
  }
}
