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

// Gemini Chat Service - Agent multi-tool
// Export sous le nom 'streamingService' pour compatibilité routes
export {
  geminiChatService as streamingService,
  type StreamGenerationParams,
  type GeminiStreamChunk,
  type AttachedFile,
  type HistoricalFileRef
} from './gemini-chat.service.js';

// Tool Declarations & Executor
export { agentToolDeclarations } from './tool-declarations.js';
export { executeTool, type ToolExecutionContext } from './tool-executor.js';
