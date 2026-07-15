/**
 * Mistral chat helpers.
 *
 * The following Gemini-era knobs have no Mistral equivalent and were dropped:
 * - ThinkingLevel       : Magistral reasoning quality is controlled by model
 *                         choice, not a config flag.
 * - HarmCategory        : content moderation is built-in to Mistral models,
 *                         no per-category threshold API.
 *
 * Keeps the genuinely useful helpers:
 * - MAX_TOOL_ITERATIONS  : same agentic loop bound (5 iterations).
 * - wrapUserMessage      : prompt-injection defence (delimiter wrap), still
 *                          necessary regardless of provider.
 * - getLearningContext   : reads FSRS due-cards + weak subjects from pg.
 */

import { sql, eq, and } from 'drizzle-orm';
import { db } from '../../db/connection.js';
import { learningCards, learningDecks } from '../../db/schema.js';
import { logger } from '../../lib/observability.js';
import type { PronoteContext } from './ai-chat.service.js';

export const MAX_TOOL_ITERATIONS = 5;

/**
 * Every delimiter tag used by the prompt template (fences for untrusted content
 * AND system-prompt section tags). Stripped from any untrusted text so a forged
 * value cannot inject e.g. `</safety>` to escape its fence and have trailing
 * text read as a system instruction.
 */
const TEMPLATE_TAGS =
  /<\/?(?:student_message|pronote_data|student_context|attached_file|curriculum_excerpt|identity|tone|transparency|pedagogy|visualization|response_format|safety|rag_policy|level_adaptation|subject_specifics)\b[^>]*>/gi;

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

/**
 * Shape of the `search_educational_content` tool result that carries untrusted
 * curriculum text. The official-programme corpus is third-party data: a forged
 * or poisoned chunk must never be read as an instruction.
 */
interface RagToolResult {
  found?: boolean;
  context?: string;
  resultsCount?: number;
  bestMatchSection?: string;
  bestMatchMatiere?: string;
  chunks?: Array<{ section?: string; matiere?: string; text?: string }>;
}

/**
 * Build the `tool` message content for a RAG search result: the curriculum text
 * (untrusted) is tag-stripped and wrapped in a `<curriculum_excerpt>` fence the
 * system prompt treats as data, while the metadata (found, counts, sections)
 * stays as plain JSON outside the fence. Replaces a raw `JSON.stringify` that
 * would have let a poisoned chunk read as an instruction.
 *
 * RRF fusion scores are deliberately NOT serialized: they are rank artefacts
 * (~0.016), not similarities, so a model reading them could wrongly infer "low
 * confidence". Ranking is conveyed by chunk order alone.
 */
export function wrapCurriculumToolResult(result: unknown): string {
  if (typeof result !== 'object' || result === null) {
    return JSON.stringify(result);
  }
  const rag = result as RagToolResult;
  const metadata = {
    found: rag.found,
    resultsCount: rag.resultsCount,
    bestMatchSection: rag.bestMatchSection,
    bestMatchMatiere: rag.bestMatchMatiere,
    chunks: (rag.chunks ?? []).map((c) => ({
      section: c.section,
      matiere: c.matiere,
    })),
  };

  const excerpt = stripPromptTags(rag.context ?? '');
  const fence = excerpt
    ? `\n<curriculum_excerpt>\n${excerpt}\n</curriculum_excerpt>`
    : '';

  return `${JSON.stringify(metadata)}${fence}`;
}

/**
 * Wrap each attached file's analysis as its own `<attached_file>` block. The
 * analysis is third-party content (OCR of a student's document) so it is
 * tag-stripped and fenced — it must NEVER be concatenated into the
 * `<student_message>` (where stripPromptTags would remove the fence and let
 * the document body read as outside-the-block input). Returns '' when empty.
 */
export function wrapAttachedFiles(
  files: Array<{ fileName: string; analysis: string; documentType?: string; subject?: string }>,
): string {
  const blocks = files
    .filter((f) => f.analysis?.trim())
    .map((f) => {
      const type = f.documentType && f.subject ? `${f.documentType} - ${f.subject}` : 'document';
      const safeName = stripPromptTags(f.fileName).replace(/"/g, '');
      const safeType = stripPromptTags(type).replace(/"/g, '');
      return `<attached_file name="${safeName}" type="${safeType}">\n${stripPromptTags(f.analysis)}\n</attached_file>`;
    });

  return blocks.join('\n\n');
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
