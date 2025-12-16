/**
 * Simple Chat Service - TanStack AI Non-Streaming
 *
 * Provides a simple interface for generating single responses
 * without streaming. Used for test routes and simple generation tasks.
 */

import { chat } from '@tanstack/ai';
import { geminiAdapter, AI_MODELS } from './adapter.js';
import { buildSystemPrompt } from '../../config/prompts/index.js';
import { getLevelText } from '../../config/education/index.js';
import type { EducationLevelType } from '../../types/index.js';

export interface SimpleChatParams {
  level: EducationLevelType;
  subject: string;
  userQuery: string;
  educationalContext?: string;
}

export interface SimpleChatResult {
  content: string;
  provider: string;
  tokensUsed: number;
}

/**
 * Generate a simple non-streaming response using TanStack AI
 */
export async function generateSimpleResponse(
  params: SimpleChatParams
): Promise<SimpleChatResult> {
  const provider = 'TanStack AI + Gemini';
  const levelText = getLevelText(params.level);

  // Build system prompt with correct parameters
  const systemPrompt = buildSystemPrompt({
    level: params.level,
    levelText,
    subject: params.subject,
    userQuery: params.userQuery,
    ragContext: params.educationalContext,
  });

  // Generate with TanStack AI (collect full response)
  const stream = chat({
    adapter: geminiAdapter,
    model: AI_MODELS.chat as 'gemini-2.5-flash',
    messages: [
      { role: 'user', content: params.userQuery }
    ],
    systemPrompts: [systemPrompt],
    providerOptions: {
      generationConfig: {
        topK: 40
      }
    }
  });

  // Collect the full response
  let fullContent = '';
  let tokensUsed = 0;

  for await (const chunk of stream) {
    if (chunk.type === 'content') {
      fullContent += chunk.delta ?? '';
    }
    if (chunk.type === 'done' && chunk.usage) {
      tokensUsed = chunk.usage.totalTokens ?? 0;
    }
    if (chunk.type === 'error') {
      throw new Error(chunk.error?.message ?? 'Chat error');
    }
  }

  return {
    content: fullContent,
    provider,
    tokensUsed
  };
}
