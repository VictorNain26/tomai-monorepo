/**
 * Chat Tools — AI SDK `tool()` wrappers around the existing tool-executor.
 *
 * Zod input schemas mirror `tool-declarations.ts` verbatim (names,
 * descriptions, enums are prompt engineering — do not reword). Execution is
 * delegated to `executeTool` (tool-executor.ts): no business logic is
 * duplicated here.
 */

import { z } from 'zod';
import { tool, type ToolSet, type InferUITools } from 'ai';
import { executeTool, isDeckCreatedResult } from './tool-executor.js';
import { wrapCurriculumToolResult } from './mistral-helpers.js';
import { RAG_SUBJECTS } from './tool-declarations.js';
import { EDUCATION_LEVELS } from '../../lib/education-levels.js';
import type { EducationLevelType } from '../../types/index.js';
import type { DeckCreatedData } from './chat-ui-message.js';

export interface ChatToolContext {
  userId: string;
  sessionId: string;
  schoolLevel: EducationLevelType;
  userRole: 'student' | 'parent';
  emitDeckCreated: (data: DeckCreatedData) => void;
}

const searchEducationalContentSchema = z.object({
  query: z
    .string()
    .describe(
      'Reformule la question de manière précise pour la recherche. Ex: "théorème de Pythagore démonstration" au lieu de "aide moi avec mon exo de maths"',
    ),
  niveau: z
    .enum(EDUCATION_LEVELS)
    .describe("Le niveau scolaire de l'élève (fourni dans le contexte)"),
  matiere: z.enum(RAG_SUBJECTS).describe('La matière normalisée (slug Qdrant)'),
  limit: z
    .number()
    .optional()
    .describe('Nombre de résultats (3 pour question précise, 5 par défaut, 8 pour sujet large)'),
});

const generateFlashcardsSchema = z.object({
  topic: z
    .string()
    .describe('Le sujet précis des cartes. Ex: "théorème de Pythagore", "conjugaison du passé composé"'),
  subject: z.enum(RAG_SUBJECTS).describe('La matière (slug Qdrant)'),
  cardCount: z
    .number()
    .min(3)
    .max(10)
    .optional()
    .describe('Nombre de cartes à générer (5 par défaut)'),
});

const getStudentProfileSchema = z.object({});

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
  preferredStyle: z
    .enum(['visuel', 'auditif', 'kinesthesique', 'lecture-ecriture', 'mixte'])
    .optional()
    .describe("Style d'apprentissage observé. À ne renseigner qu'après plusieurs indices clairs."),
});

const getAppHelpSchema = z.object({
  topic: z
    .enum(['overview', 'navigation', 'chat', 'flashcards', 'pronote', 'files', 'subscription', 'profile'])
    .describe(
      'Le sujet de la question: overview (vue générale), navigation (onglets), chat (conversation), flashcards (révision), pronote (connexion/données), files (fichiers/photos), subscription (abonnement), profile (paramètres)',
    ),
});

/** 5 outils exposés à l'agent chat, au format AI SDK `ToolSet`. */
export function buildChatTools(ctx: ChatToolContext): ToolSet {
  const executionContext = {
    userId: ctx.userId,
    sessionId: ctx.sessionId,
    schoolLevel: ctx.schoolLevel,
    userRole: ctx.userRole,
  };

  return {
    search_educational_content: tool({
      description:
        "Recherche dans les programmes officiels français (Éduscol). Retourne des extraits avec source et pertinence. Intègre les résultats dans ta réponse sans citer Éduscol. Ne l'utilise pas pour salutations, Pronote, ou si tu as déjà le contexte d'un appel précédent.",
      inputSchema: searchEducationalContentSchema,
      execute: async (input) => {
        const result = await executeTool('search_educational_content', input, executionContext);
        // Curriculum text is untrusted third-party content: fenced so the
        // model never reads a poisoned chunk as instruction (see
        // wrapCurriculumToolResult doc).
        return wrapCurriculumToolResult(result);
      },
    }),

    generate_flashcards: tool({
      description:
        'Génère des cartes de révision (flashcards, QCM, vrai/faux) sur un sujet. TOUJOURS demander confirmation avant de générer ("Veux-tu que je crée des cartes ?").',
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

    get_student_profile: tool({
      description:
        "Consulte le profil cognitif de l'élève (forces, faiblesses, style d'apprentissage). Appelle-le en début de conversation pour personnaliser ton approche.",
      inputSchema: getStudentProfileSchema,
      execute: async () => executeTool('get_student_profile', {}, executionContext),
    }),

    update_student_profile: tool({
      description:
        "Enregistre une observation pédagogique dans le profil cognitif de l'élève (force, faiblesse, style observé). À n'appeler que lorsqu'une observation est NOUVELLE, FACTUELLE et PERTINENTE sur plusieurs tours — pas à chaque message. Une observation au plus par réponse.",
      inputSchema: updateStudentProfileSchema,
      execute: async (input) => executeTool('update_student_profile', input, executionContext),
    }),

    get_app_help: tool({
      description:
        "Guide d'utilisation de l'application Tom. OBLIGATOIRE pour toute question sur l'app (navigation, fonctionnalités, Pronote, abonnement). Ne réponds JAMAIS aux questions sur l'app sans consulter cet outil.",
      inputSchema: getAppHelpSchema,
      execute: async (input) => executeTool('get_app_help', input, executionContext),
    }),
  };
}

export type TomChatTools = InferUITools<ReturnType<typeof buildChatTools>>;
