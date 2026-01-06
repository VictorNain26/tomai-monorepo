/**
 * Export central des services chat
 */

// File Context Service - Scaleway + PostgreSQL (RGPD France)
export {
  fileContextService,
  type AttachedFileInfo,
  type FileAnalysisResult,
  type FileAnalysisOptions,
  type MultimodalFile
} from './file-context.service.js';

// Gemini Chat Service - @google/genai direct
// Export sous le nom 'streamingService' pour compatibilité routes
export {
  geminiChatService as streamingService,
  type StreamGenerationParams,
  type GeminiStreamChunk,
  type AttachedFile,
  type HistoricalFileRef
} from './gemini-chat.service.js';
