/**
 * Simple Chat Service - @google/genai Non-Streaming
 *
 * Provides a simple interface for generating single responses
 * without streaming. Used for test routes and simple generation tasks.
 */

import { GoogleGenAI } from '@google/genai';
import { appConfig } from '../../config/app.config.js';
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

// Singleton GoogleGenAI instance
const ai = new GoogleGenAI({ apiKey: appConfig.ai.gemini.apiKey ?? '' });

/**
 * Generate a simple non-streaming response using @google/genai
 */
export async function generateSimpleResponse(
  params: SimpleChatParams
): Promise<SimpleChatResult> {
  const provider = '@google/genai';
  const levelText = getLevelText(params.level);

  // Build system prompt (LearnLM v3 architecture)
  const systemPrompt = buildSystemPrompt({
    level: params.level,
    levelText,
    subject: params.subject,
    ragContext: params.educationalContext,
  });

  // Generate with @google/genai
  const response = await ai.models.generateContent({
    model: appConfig.ai.gemini.model,
    contents: params.userQuery,
    config: {
      systemInstruction: systemPrompt,
      topK: 40
    }
  });

  const tokensUsed = response.usageMetadata
    ? (response.usageMetadata.promptTokenCount ?? 0) + (response.usageMetadata.candidatesTokenCount ?? 0)
    : 0;

  return {
    content: response.text ?? '',
    provider,
    tokensUsed
  };
}
