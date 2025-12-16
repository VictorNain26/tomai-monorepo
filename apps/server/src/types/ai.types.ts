/**
 * Shared AI Types
 *
 * Types used across AI services, conversation utilities,
 * and prompt validation.
 */

import type { EducationLevelType } from './index.js';

/**
 * Message format for AI conversations
 */
export interface IAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    educationalContext?: string;
    detectedConcepts?: string[];
  };
}

/**
 * Parameters for AI generation
 */
export interface GenerationParams {
  level: EducationLevelType;
  subject: string;
  firstName?: string;
  age?: number;
  userQuery: string;
  conversationHistory?: IAIMessage[];
  educationalContext?: string;
  /** Custom system prompt (overrides default socratic prompt) */
  systemPrompt?: string;
}

/**
 * Response from AI generation
 */
export interface AIResponse {
  content: string;
  provider: string;
  tokensUsed: number;
}

/**
 * Streaming response with token tracking
 */
export interface AIStreamResponseWithTokens {
  provider: string;
  stream: AsyncIterable<{ text: string; isLast: boolean; tokensUsed?: number }>;
}
