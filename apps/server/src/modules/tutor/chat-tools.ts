/**
 * Chat Tools — AI SDK `tool()` wrappers around the existing tool-executor.
 *
 * Names, descriptions and enums of the Zod input schemas are prompt
 * engineering — do not reword. Execution is delegated to `executeTool` (tool-executor.ts): no business logic is
 * duplicated here.
 */

import { z } from 'zod';
import { tool, type ToolSet, type InferUITools } from 'ai';
import { executeTool, isDeckCreatedResult } from './tool-executor.js';
import type { EducationLevelType } from '../../types/index.js';
import type { DeckCreatedData } from './chat-ui-message.js';
import type { OutputCheckContext } from './output-check.js';
import { SUBJECT_SLUGS } from '../../lib/subjects.js';

export interface ChatToolContext {
  userId: string;
  sessionId: string;
  schoolLevel: EducationLevelType;
  /** What the cards are checked against before they are stored. */
  check: OutputCheckContext;
  emitDeckCreated: (data: DeckCreatedData) => void;
}

const generateFlashcardsSchema = z.object({
  topic: z
    .string()
    .describe('Le sujet précis des cartes. Ex: "théorème de Pythagore", "conjugaison du passé composé"'),
  subject: z.enum(SUBJECT_SLUGS).describe('La matière'),
  cardCount: z
    .number()
    .min(3)
    .max(10)
    .optional()
    .describe('Nombre de cartes à générer (5 par défaut)'),
});


/** Les outils exposés à l'agent chat, au format AI SDK `ToolSet`. */
export function buildChatTools(ctx: ChatToolContext): ToolSet {
  const executionContext = {
    userId: ctx.userId,
    sessionId: ctx.sessionId,
    schoolLevel: ctx.schoolLevel,
    check: ctx.check,
  };

  return {
    generate_flashcards: tool({
      strict: true,
      description:
        "Crée des cartes de révision (flashcards, QCM, vrai/faux) sur une notion, quand l'élève en demande ou accepte celles que tu proposes.",
      inputSchema: generateFlashcardsSchema,
      execute: async (input, { abortSignal }) => {
        const result = await executeTool('generate_flashcards', input, executionContext, abortSignal);
        if (isDeckCreatedResult(result)) {
          ctx.emitDeckCreated({
            deckId: result.deckId,
            title: result.deckTitle,
            cardCount: result.cardCount,
            subject: result.subject,
          });
        }
        return result;
      },
    }),
  };
}

export type TomChatTools = InferUITools<ReturnType<typeof buildChatTools>>;
