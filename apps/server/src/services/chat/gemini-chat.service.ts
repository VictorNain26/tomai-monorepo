/**
 * Service de chat Gemini 3 Flash - Agent multi-tool
 *
 * Architecture agent avec boucle d'exécution:
 * - 7 outils: RAG, Pronote (devoirs/notes/EDT), flashcards, profil cognitif, guide app
 * - Boucle while max 5 itérations (sécurité anti-boucle infinie)
 * - Support multi-tool par itération
 * - SSE streaming avec content/done/error chunks
 */

import { GoogleGenAI, ThinkingLevel, type Part, type Content } from '@google/genai';
import { eq, and, sql } from 'drizzle-orm';
import { appConfig } from '../../config/app.config.js';
import { buildSystemPrompt, generateToolInstructions } from '../../config/prompts/index.js';
import { getLevelText } from '../../config/education/index.js';
import { optimizeConversationHistory, type OptimizationContext } from '../../utils/conversation/index.js';
import { agentToolDeclarations } from './tool-declarations.js';
import { executeTool } from './tool-executor.js';
import { db } from '../../db/connection.js';
import { learningCards, learningDecks } from '../../db/schema.js';
import { logger } from '../../lib/observability.js';
import type { EducationLevelType } from '../../types/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const MAX_TOOL_ITERATIONS = 5;

/** Map config string values to SDK ThinkingLevel enum */
const THINKING_LEVEL_MAP: Record<string, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

/** Human-readable label for tool status SSE events */
function getToolStatusLabel(name: string): string {
  switch (name) {
    case 'search_educational_content': return 'Recherche dans les programmes...';
    case 'get_student_homework': return 'Consultation des devoirs...';
    case 'get_student_grades': return 'Consultation des notes...';
    case 'get_student_timetable': return "Consultation de l'emploi du temps...";
    case 'generate_flashcards': return 'Création de flashcards...';
    case 'get_student_profile': return 'Analyse du profil...';
    case 'get_app_help': return "Consultation du guide...";
    default: return 'Traitement en cours...';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LEARNING CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetches learning context for the system prompt:
 * - Number of cards due today
 * - Subjects with most lapses (weak concepts)
 */
export async function getLearningContext(userId: string): Promise<string | null> {
  try {
    // Count due cards
    const dueResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(learningCards)
      .innerJoin(learningDecks, eq(learningCards.deckId, learningDecks.id))
      .where(and(
        eq(learningDecks.userId, userId),
        sql`(${learningCards.fsrsData}->>'due')::timestamptz <= now()`
      ));

    const dueCount = dueResult[0]?.count ?? 0;

    // Find subjects with most lapses (weak concepts)
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

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Fichier attaché au message (Gemini Files API ou fallback base64) */
export interface AttachedFile {
  /** URI Gemini Files API (préféré, TTL 48h) */
  fileUri?: string;
  /** Fallback: base64 inline */
  base64?: string;
  /** MIME type du fichier */
  mimeType: string;
  /** Type de contenu */
  contentType: 'image' | 'document';
}

/** Fichier attaché dans l'historique (référence Gemini Files API) */
export interface HistoricalFileRef {
  /** URI Gemini Files API (TTL 48h) */
  geminiFileId?: string;
  /** MIME type pour déterminer image vs document */
  mimeType?: string;
}

/** Paramètres pour génération streaming */
export interface StreamGenerationParams {
  userId: string;
  content: string;
  subject?: string;
  schoolLevel: EducationLevelType;
  firstName?: string;
  sessionId: string;
  /** Résumé du profil cognitif (injecté dans le system prompt) */
  cognitiveProfileSummary?: string | null;
  /** Contexte learning (cartes dues, sujets faibles) */
  learningContext?: string | null;
  /** Résumé conversationnel (SummaryBuffer pattern) */
  conversationSummary?: string | null;
  /** Role de l'utilisateur (eleve ou parent) */
  userRole: 'student' | 'parent';
  /** Fichiers attachés au message courant (images, PDFs) */
  files?: AttachedFile[];
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    /** Fichier attaché à ce message historique */
    attachedFile?: HistoricalFileRef | null;
  }>;
}

/** SSE StreamChunk types (frontend compatibility) */
export interface GeminiStreamChunk {
  type: 'content' | 'done' | 'error' | 'status' | 'deck_created';
  id: string;
  model: string;
  timestamp: number;
  // Content chunk fields
  delta?: string;
  content?: string;
  role?: 'assistant';
  // Done chunk fields
  finishReason?: 'stop' | 'length' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  // Error chunk fields
  error?: {
    message: string;
    code?: string;
  };
  // Status chunk fields (heartbeat during tool calls)
  status?: string;
  // Deck created event (from generate_flashcards tool)
  deck?: {
    deckId: string;
    title: string;
    cardCount: number;
    subject: string;
  };
  // TomAI custom metadata
  metadata?: {
    sessionId: string;
    usedRAG: boolean;
    toolsUsed: string[];
    toolCallsCount: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════

class GeminiChatService {
  private readonly ai: GoogleGenAI;
  private readonly model: string;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: appConfig.ai.gemini.apiKey ?? '' });
    this.model = appConfig.ai.gemini.model;
  }

  /**
   * Construit le system prompt pour le chat socratique avec instructions multi-tool
   */
  private buildSystemPromptForChat(params: {
    level: EducationLevelType;
    subject?: string;
    firstName?: string;
    cognitiveProfileSummary?: string | null;
    learningContext?: string | null;
  }): string {
    const levelText = getLevelText(params.level);
    const basePrompt = buildSystemPrompt({
      level: params.level,
      levelText,
      subject: params.subject,
      firstName: params.firstName
    });

    const toolSection = `\n\n${generateToolInstructions()}`;

    const profileSection = params.cognitiveProfileSummary
      ? `\n\n## PROFIL DE L'ÉLÈVE\n${params.cognitiveProfileSummary}`
      : '';

    const learningSection = params.learningContext
      ? `\n\n${params.learningContext}`
      : '';

    return basePrompt + toolSection + profileSection + learningSection;
  }

  /**
   * Convertit les fichiers en Parts Gemini
   */
  private buildFileParts(files?: AttachedFile[]): Part[] {
    if (!files || files.length === 0) return [];

    const parts: Part[] = [];
    for (const file of files) {
      if (file.fileUri) {
        parts.push({
          fileData: {
            fileUri: file.fileUri,
            mimeType: file.mimeType
          }
        });
      } else if (file.base64) {
        parts.push({
          inlineData: {
            data: file.base64,
            mimeType: file.mimeType
          }
        });
      }
    }
    return parts;
  }

  /**
   * Construit l'historique de conversation au format Gemini Content[]
   * Intègre le résumé conversationnel via SummaryBuffer si disponible
   */
  private buildConversationHistory(
    history: StreamGenerationParams['conversationHistory'],
    conversationSummary?: string | null
  ): Content[] {
    if (!history || history.length === 0) return [];

    const context: OptimizationContext = { conversationSummary };
    const optimized = optimizeConversationHistory(history, context);

    return optimized.map(msg => {
      const role = msg.role === 'assistant' ? 'model' : 'user';
      const parts: Part[] = [{ text: msg.content }];
      return { role, parts };
    });
  }

  /**
   * Génère un AsyncGenerator de chunks streaming - Agent multi-tool
   * Boucle d'exécution: stream → collect tool calls → execute → feed back → repeat
   */
  async *generateStreamChunks(params: StreamGenerationParams): AsyncGenerator<GeminiStreamChunk> {
    const startTime = Date.now();
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      // 1. Construire le system prompt
      const systemPrompt = this.buildSystemPromptForChat({
        level: params.schoolLevel,
        subject: params.subject,
        firstName: params.firstName,
        cognitiveProfileSummary: params.cognitiveProfileSummary,
        learningContext: params.learningContext
      });

      // 2. Construire l'historique (avec résumé SummaryBuffer si disponible)
      const history = this.buildConversationHistory(params.conversationHistory, params.conversationSummary);

      // 3. Construire les parts du message utilisateur (texte + fichiers)
      const userParts: Part[] = [{ text: params.content }];
      const fileParts = this.buildFileParts(params.files);
      userParts.push(...fileParts);

      logger.info('Starting Gemini agent streaming', {
        userId: params.userId,
        sessionId: params.sessionId,
        subject: params.subject,
        schoolLevel: params.schoolLevel,
        historyLength: history.length,
        filesCount: params.files?.length ?? 0,
        operation: 'gemini-chat:agent-start'
      });

      // 4. Créer la session chat avec tous les outils + thinkingConfig
      const chat = this.ai.chats.create({
        model: this.model,
        config: {
          systemInstruction: systemPrompt,
          tools: [{ functionDeclarations: agentToolDeclarations }],
          thinkingConfig: {
            thinkingLevel: THINKING_LEVEL_MAP[appConfig.ai.gemini.thinkingLevel] ?? ThinkingLevel.LOW,
          }
        },
        history
      });

      // 5. Agent loop
      let fullContent = '';
      let promptTokens = 0;
      let completionTokens = 0;
      const toolsUsed: string[] = [];
      let toolCallsCount = 0;
      let iteration = 0;

      // First message is the user's parts, subsequent messages are function responses
      let nextMessage: Part[] | Part[][] = userParts;

      while (iteration < MAX_TOOL_ITERATIONS) {
        const stream = await chat.sendMessageStream({ message: nextMessage });

        // Collect function calls from this iteration
        const pendingCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

        for await (const chunk of stream) {
          // Collect function calls
          if (chunk.functionCalls && chunk.functionCalls.length > 0) {
            for (const fc of chunk.functionCalls) {
              pendingCalls.push({
                name: fc.name ?? '',
                args: (fc.args as Record<string, unknown>) ?? {}
              });
            }
            continue;
          }

          // Stream text to client
          const text = chunk.text ?? '';
          if (text) {
            fullContent += text;
            yield {
              type: 'content' as const,
              id: messageId,
              model: this.model,
              timestamp: Date.now(),
              delta: text,
              content: fullContent,
              role: 'assistant' as const
            };
          }

          // Capture usage
          if (chunk.usageMetadata) {
            promptTokens = chunk.usageMetadata.promptTokenCount ?? promptTokens;
            completionTokens += chunk.usageMetadata.candidatesTokenCount ?? 0;
          }
        }

        // No tool calls = agent is done
        if (pendingCalls.length === 0) break;

        // Execute all tool calls in parallel
        toolCallsCount += pendingCalls.length;
        for (const call of pendingCalls) {
          if (!toolsUsed.includes(call.name)) {
            toolsUsed.push(call.name);
          }
        }

        logger.info('Agent tool calls', {
          userId: params.userId,
          sessionId: params.sessionId,
          iteration,
          toolNames: pendingCalls.map(c => c.name),
          operation: 'gemini-chat:tool-calls'
        });

        // Yield status event: heartbeat + user-facing feedback during tool execution
        yield {
          type: 'status' as const,
          id: messageId,
          model: this.model,
          timestamp: Date.now(),
          status: pendingCalls.map(c => getToolStatusLabel(c.name)).join(' · ')
        };

        const results = await Promise.all(
          pendingCalls.map(call =>
            executeTool(call.name, call.args, {
              userId: params.userId,
              schoolLevel: params.schoolLevel,
              sessionId: params.sessionId,
              userRole: params.userRole,
            })
          )
        );

        // Emit deck_created events for any generated decks
        for (const result of results) {
          const r = result as Record<string, unknown>;
          if (r.deckId && r.generated) {
            yield {
              type: 'deck_created' as const,
              id: messageId,
              model: this.model,
              timestamp: Date.now(),
              deck: {
                deckId: r.deckId as string,
                title: r.deckTitle as string,
                cardCount: r.cardCount as number,
                subject: r.subject as string,
              },
            };
          }
        }

        // Build function response parts for the next iteration
        nextMessage = results.map((result, i) => ({
          functionResponse: {
            name: pendingCalls[i].name,
            response: result as Record<string, unknown>
          }
        }));

        iteration++;
      }

      // 6. Yield done event
      const totalTokens = promptTokens + completionTokens;

      yield {
        type: 'done' as const,
        id: messageId,
        model: this.model,
        timestamp: Date.now(),
        finishReason: 'stop' as const,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens
        },
        metadata: {
          sessionId: params.sessionId,
          usedRAG: toolsUsed.includes('search_educational_content'),
          toolsUsed,
          toolCallsCount
        }
      };

      logger.info('Agent streaming completed', {
        userId: params.userId,
        sessionId: params.sessionId,
        messageId,
        contentLength: fullContent.length,
        promptTokens,
        completionTokens,
        totalTokens,
        toolCallsCount,
        toolsUsed,
        iterations: iteration,
        durationMs: Date.now() - startTime,
        operation: 'gemini-chat:agent-complete'
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      const isRateLimit = errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate limit');
      const isApiKey = errorMessage.toLowerCase().includes('api key') || errorMessage.includes('401');
      const isQuota = errorMessage.toLowerCase().includes('quota');

      logger.error('Agent streaming error', {
        _error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        userId: params.userId,
        sessionId: params.sessionId,
        durationMs: Date.now() - startTime,
        operation: 'gemini-chat:agent-error',
        severity: 'high' as const
      });

      let userMessage = 'Erreur lors de la génération de la réponse. Veuillez réessayer.';
      let errorCode = 'generation_error';

      if (isRateLimit) {
        userMessage = 'Le service est temporairement surchargé. Réessayez dans quelques secondes.';
        errorCode = 'rate_limit';
      } else if (isApiKey) {
        userMessage = 'Erreur de configuration du service AI. Contactez le support.';
        errorCode = 'api_configuration';
      } else if (isQuota) {
        userMessage = 'Quota API dépassé. Réessayez plus tard.';
        errorCode = 'quota_exceeded';
      }

      yield {
        type: 'error' as const,
        id: messageId,
        model: this.model,
        timestamp: Date.now(),
        error: {
          message: userMessage,
          code: errorCode
        }
      };
    }
  }
}

// Instance singleton
export const geminiChatService = new GeminiChatService();
