/**
 * Mistral chat service — Tom's primary tutoring stream.
 *
 * Backed by Mistral Small 4 (`mistral-small-latest`) with optional
 * `reasoning_effort: "high"` for problem-solving turns. The streaming surface
 * is provider-agnostic (`ChatStreamChunk`) so the orchestration layer doesn't
 * need to know we're talking to Mistral.
 *
 * The agent loop itself (per-iteration streaming + tool dispatch) lives in
 * `./mistral-agent-loop.ts` to keep this file under the 400-line cap. This
 * module is the thin orchestrator: it builds the system prompt + history +
 * user content, delegates to `runAgentLoop`, and translates SDK errors into
 * typed error chunks.
 */

import type { Mistral } from '@mistralai/mistralai';
import { appConfig } from '../../config/app.config.js';
import { getMistralClient } from '../../lib/mistral-client.js';
import { routeReasoningEffort } from '../../lib/mistral-reasoning.js';
import { buildSystemPrompt } from '../../config/prompts/index.js';
import { getLevelText } from '../../config/education/index.js';
import {
  optimizeConversationHistory,
  type OptimizationContext,
} from '../../utils/conversation/index.js';
import { logger } from '../../lib/observability.js';
import type { EducationLevelType } from '../../types/index.js';
import type {
  AttachedFile,
  ChatStreamChunk,
  PronoteContext,
  StreamGenerationParams,
} from './mistral-types.js';
import { wrapUserMessage } from './mistral-helpers.js';
import { runAgentLoop, type MistralMessage } from './mistral-agent-loop.js';

// Re-export types so callers can import either from this service or from
// mistral-types.ts directly.
export type {
  AttachedFile,
  HistoricalFileRef,
  StreamGenerationParams,
  ChatStreamChunk,
  PronoteContext,
} from './mistral-types.js';
export { getLearningContext } from './mistral-helpers.js';

interface MistralImagePart {
  type: 'image_url';
  imageUrl: string;
}

type MistralUserContent = MistralMessage['content'];

class MistralChatService {
  private readonly client: Mistral;
  private readonly model: string;

  constructor() {
    this.client = getMistralClient();
    this.model = appConfig.ai.mistral?.chatModel ?? 'mistral-small-latest';
  }

  private buildSystemPromptForChat(params: {
    level: EducationLevelType;
    subject?: string;
    firstName?: string;
    cognitiveProfileSummary?: string | null;
    learningContext?: string | null;
    pronoteContext?: PronoteContext;
    intentReinforcement?: string | null;
  }): string {
    const levelText = getLevelText(params.level);
    const basePrompt = buildSystemPrompt({
      level: params.level,
      levelText,
      subject: params.subject,
      firstName: params.firstName,
    });

    const profileSection = params.cognitiveProfileSummary
      ? `\n\n## PROFIL DE L'ÉLÈVE\n${params.cognitiveProfileSummary}`
      : '';
    const learningSection = params.learningContext ? `\n\n${params.learningContext}` : '';
    const pronoteSection = this.buildPronoteSection(params.pronoteContext);

    // Turn-specific reinforcement goes LAST so it takes precedence over the
    // more general safety guidance (recency bias in instruction-following).
    const intentSection = params.intentReinforcement ? `\n\n${params.intentReinforcement}` : '';

    return basePrompt + profileSection + learningSection + pronoteSection + intentSection;
  }

  private buildPronoteSection(pronoteContext?: PronoteContext): string {
    if (!pronoteContext) return '';

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

    if (parts.length === 0) return '';
    return `\n\n## DONNEES PRONOTE (contexte eleve)\n${parts.join('\n\n')}`;
  }

  private buildUserContentParts(
    text: string,
    files?: AttachedFile[],
  ): MistralUserContent {
    const wrapped = wrapUserMessage(text);
    const visionParts: MistralImagePart[] = [];

    if (files) {
      for (const f of files) {
        if (f.contentType !== 'image') continue;
        if (f.fileUrl) {
          visionParts.push({ type: 'image_url', imageUrl: f.fileUrl });
        } else if (f.base64) {
          // Mistral accepts data URIs in the imageUrl field per its docs.
          visionParts.push({
            type: 'image_url',
            imageUrl: `data:${f.mimeType};base64,${f.base64}`,
          });
        }
      }
    }

    if (visionParts.length === 0) {
      return wrapped;
    }
    return [{ type: 'text', text: wrapped }, ...visionParts];
  }

  private buildHistory(
    history: StreamGenerationParams['conversationHistory'],
    conversationSummary?: string | null,
  ): MistralMessage[] {
    if (!history || history.length === 0) return [];

    const context: OptimizationContext = { conversationSummary };
    const optimized = optimizeConversationHistory(history, context);

    return optimized.map<MistralMessage>((msg) => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    }));
  }

  async *generateStreamChunks(
    params: StreamGenerationParams,
  ): AsyncGenerator<ChatStreamChunk> {
    const startTime = Date.now();
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      const systemPrompt = this.buildSystemPromptForChat({
        level: params.schoolLevel,
        subject: params.subject,
        firstName: params.firstName,
        cognitiveProfileSummary: params.cognitiveProfileSummary,
        learningContext: params.learningContext,
        pronoteContext: params.pronoteContext,
        intentReinforcement: params.intentReinforcement,
      });

      const messages: MistralMessage[] = [{ role: 'system', content: systemPrompt }];

      messages.push(...this.buildHistory(params.conversationHistory, params.conversationSummary));

      messages.push({
        role: 'user',
        content: this.buildUserContentParts(params.content, params.files),
      });

      logger.info('Starting Mistral agent streaming', {
        userId: params.userId,
        sessionId: params.sessionId,
        subject: params.subject,
        schoolLevel: params.schoolLevel,
        historyLength: params.conversationHistory.length,
        filesCount: params.files?.length ?? 0,
        operation: 'mistral-chat:agent-start',
      });

      // Decide once at turn start: a turn that asks the tutor to actually
      // reason about a STEM problem in collège/lycée gets the heavier
      // thinking mode; everything else stays on `none` for conversational
      // latency. Recomputed per-turn (not per-iteration) since the routing
      // criteria don't change inside a single agent loop.
      const reasoningEffort = routeReasoningEffort({
        schoolLevel: params.schoolLevel,
        subject: params.subject,
        intent: params.classifiedIntent?.intent,
      });

      const outcome = yield* runAgentLoop({
        client: this.client,
        model: this.model,
        messages,
        messageId,
        reasoningEffort,
        classifiedIntent: params.classifiedIntent,
        userId: params.userId,
        sessionId: params.sessionId,
        schoolLevel: params.schoolLevel,
        userRole: params.userRole,
      });

      // The leak detector inside the loop already emitted the safety_block
      // chunk; suppress the terminal `done` so we don't double-up the SSE
      // stream.
      if (outcome.aborted) return;

      const totalTokens = outcome.promptTokens + outcome.completionTokens;

      yield {
        type: 'done' as const,
        id: messageId,
        model: this.model,
        timestamp: Date.now(),
        finishReason: 'stop' as const,
        usage: {
          promptTokens: outcome.promptTokens,
          completionTokens: outcome.completionTokens,
          totalTokens,
        },
        metadata: {
          sessionId: params.sessionId,
          usedRAG: outcome.toolsUsed.includes('search_educational_content'),
          toolsUsed: outcome.toolsUsed,
          toolCallsCount: outcome.toolCallsCount,
        },
      };

      logger.info('Agent streaming completed', {
        userId: params.userId,
        sessionId: params.sessionId,
        messageId,
        contentLength: outcome.fullContent.length,
        promptTokens: outcome.promptTokens,
        completionTokens: outcome.completionTokens,
        totalTokens,
        toolCallsCount: outcome.toolCallsCount,
        toolsUsed: outcome.toolsUsed,
        iterations: outcome.iterations,
        durationMs: Date.now() - startTime,
        operation: 'mistral-chat:agent-complete',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const lower = errorMessage.toLowerCase();

      const isRateLimit = errorMessage.includes('429') || lower.includes('rate limit');
      const isApiKey = lower.includes('api key') || errorMessage.includes('401');
      const isQuota = lower.includes('quota');
      const isTimeout = errorMessage.includes('timed out') || errorMessage.includes('TimeoutError');
      // Mistral guardrails block returns 403 with the violated categories
      // in the body. Distinct from a generic auth 403 by the presence of
      // moderation/guardrail keywords.
      const isGuardrailBlock =
        errorMessage.includes('403') &&
        (lower.includes('guardrail') || lower.includes('moderation') || lower.includes('blocked'));

      logger.error('Agent streaming error', {
        _error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        userId: params.userId,
        sessionId: params.sessionId,
        durationMs: Date.now() - startTime,
        operation: 'mistral-chat:agent-error',
        severity: 'high' as const,
      });

      let userMessage = 'Erreur lors de la génération de la réponse. Veuillez réessayer.';
      let errorCode = 'generation_error';

      if (isGuardrailBlock) {
        userMessage = "Je ne peux pas répondre à ce message. Reformule en restant sur ton travail scolaire.";
        errorCode = 'safety_block';
      } else if (isRateLimit) {
        userMessage = 'Le service est temporairement surchargé. Réessayez dans quelques secondes.';
        errorCode = 'rate_limit';
      } else if (isApiKey) {
        userMessage = 'Erreur de configuration du service AI. Contactez le support.';
        errorCode = 'api_configuration';
      } else if (isQuota) {
        userMessage = 'Quota API dépassé. Réessayez plus tard.';
        errorCode = 'quota_exceeded';
      } else if (isTimeout) {
        userMessage = 'Le service met trop de temps à répondre. Réessayez.';
        errorCode = 'stream_timeout';
      }

      yield {
        type: 'error' as const,
        id: messageId,
        model: this.model,
        timestamp: Date.now(),
        error: { message: userMessage, code: errorCode },
      };
    }
  }
}

export const mistralChatService = new MistralChatService();
