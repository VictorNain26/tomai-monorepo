/**
 * Shared AI Types
 *
 * Types used across AI services, conversation utilities,
 * and prompt validation.
 */

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
