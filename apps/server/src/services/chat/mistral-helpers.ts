/**
 * Mistral chat helpers — replaces gemini-helpers.ts.
 *
 * Drops the Gemini-specific knobs that no longer apply:
 * - ThinkingLevel       : not exposed by Mistral. Magistral reasoning quality
 *                         is controlled by model choice, not a config flag.
 * - HarmCategory        : Mistral does not surface a per-category safety
 *                         threshold API. Content moderation is built-in.
 *
 * Keeps the genuinely useful helpers:
 * - MAX_TOOL_ITERATIONS  : same agentic loop bound (5 iterations).
 * - Streaming timeouts   : same setup + per-chunk guards, just renamed.
 * - wrapUserMessage      : prompt-injection defence (delimiter wrap), still
 *                          necessary regardless of provider.
 * - getToolStatusLabel   : UI status string for tool invocation.
 * - getLearningContext   : reads FSRS due-cards + weak subjects from pg.
 */

import { sql, eq, and } from 'drizzle-orm';
import { db } from '../../db/connection.js';
import { learningCards, learningDecks } from '../../db/schema.js';
import { logger } from '../../lib/observability.js';
import type { PronoteContext } from './chat-streaming-types.js';

export const MAX_TOOL_ITERATIONS = 5;

/**
 * Timeouts for Mistral chat streaming. The setup timeout guards the initial
 * API handshake; the chunk timeout catches streams that stall mid-response.
 */
export const CHAT_STREAM_SETUP_TIMEOUT_MS = 90_000;
export const CHAT_STREAM_CHUNK_TIMEOUT_MS = 60_000;

/**
 * Every delimiter tag used by the prompt template (fences for untrusted content
 * AND system-prompt section tags). Stripped from any untrusted text so a forged
 * value cannot inject e.g. `</safety>` to escape its fence and have trailing
 * text read as a system instruction.
 */
const TEMPLATE_TAGS =
  /<\/?(?:student_message|pronote_data|student_context|attached_file|curriculum_excerpt|identity|tone|transparency|pedagogy|safety|rag_policy|level_adaptation|subject_specifics)\b[^>]*>/gi;

/** Remove all template delimiter tags from untrusted content. */
export function stripPromptTags(content: string): string {
  return content.replace(TEMPLATE_TAGS, '');
}

/**
 * Wrap a student message with structured delimiters so the model treats any
 * instruction-looking text inside as content to analyse, never as an order to
 * follow. Pairs with the INSTRUCTION_HIERARCHY block in the system prompt.
 */
export function wrapUserMessage(content: string): string {
  return `<student_message>\n${stripPromptTags(content)}\n</student_message>`;
}

/**
 * Wrap ephemeral Pronote data (homework, grades, timetable) as a delimited
 * user-turn block. It is third-party data — a forged homework description
 * must never be read as an instruction — so it lives in a `<pronote_data>`
 * block the system prompt treats as data, NEVER inside the system prompt.
 * Returns null when there is nothing to inject.
 */
export function wrapPronoteData(pronoteContext?: PronoteContext): string | null {
  if (!pronoteContext) return null;

  const parts: string[] = [];
  if (pronoteContext.homework?.length) {
    parts.push(`DEVOIRS DE LA SEMAINE:\n${JSON.stringify(pronoteContext.homework)}`);
  }
  if (pronoteContext.recentGrades?.length) {
    parts.push(`DERNIERES NOTES:\n${JSON.stringify(pronoteContext.recentGrades)}`);
  }
  if (pronoteContext.todayTimetable?.length) {
    parts.push(`EDT DU JOUR:\n${JSON.stringify(pronoteContext.todayTimetable)}`);
  }

  if (parts.length === 0) return null;

  // pronoteContext is client-supplied; strip any literal delimiter tokens a
  // forged value could contain so it cannot break out of the fence and have
  // trailing text read as outside-the-block instructions.
  const body = stripPromptTags(parts.join('\n\n'));
  return `<pronote_data>\n${body}\n</pronote_data>`;
}

/**
 * Wrap the student's cognitive profile + revision context as a delimited
 * user-turn block. The cognitive profile contains free-text observations the
 * model extracted from the student's own past messages, so it is untrusted —
 * it must never sit in the system prompt where it could read as an
 * instruction. Returns null when there is nothing to inject.
 */
export function wrapStudentContext(
  cognitiveProfileSummary?: string | null,
  learningContext?: string | null,
): string | null {
  const parts: string[] = [];
  if (cognitiveProfileSummary) {
    parts.push(`## PROFIL DE L'ÉLÈVE\n${cognitiveProfileSummary}`);
  }
  if (learningContext) {
    parts.push(learningContext);
  }
  if (parts.length === 0) return null;

  // Strip any literal delimiter tokens so a forged observation cannot break
  // out of the fence and have trailing text read as outside-the-block input.
  const body = stripPromptTags(parts.join('\n\n'));
  return `<student_context>\n${body}\n</student_context>`;
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
      operation: 'chat:learning-context',
      _error: err instanceof Error ? err.message : String(err),
      userId,
    });
    return null;
  }
}
