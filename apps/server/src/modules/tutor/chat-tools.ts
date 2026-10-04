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
import { SUBJECT_SLUGS } from '../../lib/subjects.js';

export interface ChatToolContext {
  userId: string;
  sessionId: string;
  schoolLevel: EducationLevelType;
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

const updateStudentProfileSchema = z.object({
  observation: z
    .string()
    .max(250)
    .describe(
      "Une phrase factuelle sur ce que l'élève sait faire ou sur sa difficulté. Ex: \"Confond les verbes du 1er et 2nd groupe au passé composé.\"",
    ),
  subject: z.string().describe('La matière concernée (mathematiques, francais, histoire, etc.)'),
  strength: z
    .string()
    .max(100)
    .optional()
    .describe(
      "Ajoute une force au profil si l'élève démontre une maîtrise claire sur un point (ex: \"Bonne compréhension du théorème de Pythagore\").",
    ),
  weakness: z
    .string()
    .max(100)
    .optional()
    .describe(
      "Ajoute une faiblesse au profil si l'élève bute de façon récurrente sur un point (ex: \"Oublie la retenue en addition posée\").",
    ),
});

/** Les outils exposés à l'agent chat, au format AI SDK `ToolSet`. */
export function buildChatTools(ctx: ChatToolContext): ToolSet {
  const executionContext = {
    userId: ctx.userId,
    sessionId: ctx.sessionId,
    schoolLevel: ctx.schoolLevel,
  };

  return {
    generate_flashcards: tool({
      strict: true,
      description:
        "Crée des cartes de révision (flashcards, QCM, vrai/faux) sur une notion. Si l'élève demande des cartes ou des fiches de révision, crée-les sans redemander son accord. Une fiche de devoir (fiche de lecture, fiche d'exercices) n'en est pas une demande. Dans le doute, propose et attends qu'il accepte.",
      inputSchema: generateFlashcardsSchema,
      execute: async (input) => {
        const result = await executeTool('generate_flashcards', input, executionContext);
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

    update_student_profile: tool({
      strict: true,
      description:
        "Enregistre une observation pédagogique dans le profil de l'élève (force ou difficulté). À n'appeler que lorsqu'une observation est NOUVELLE, FACTUELLE et PERTINENTE sur plusieurs tours — pas à chaque message. Une observation au plus par réponse.",
      inputSchema: updateStudentProfileSchema,
      execute: async (input) => executeTool('update_student_profile', input, executionContext),
    }),
  };
}

export type TomChatTools = InferUITools<ReturnType<typeof buildChatTools>>;
