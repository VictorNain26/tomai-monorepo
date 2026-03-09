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
  getLearningContext,
  type StreamGenerationParams,
  type GeminiStreamChunk,
  type AttachedFile,
  type HistoricalFileRef
} from './gemini-chat.service.js';

// Summarization Service - SummaryBuffer pattern
export { summarizationService } from './summarization.service.js';

// Token Budget Service - Estimation et allocation
export { estimateTokens, truncateToTokenBudget, calculateBudget, type TokenBudget, type TokenEstimate } from './token-budget.service.js';

// Chat Orchestration Service - Pipeline complet
export { chatOrchestrationService, ChatOrchestrationError, type ChatStreamRequest } from './chat-orchestration.service.js';

// Auto-Title Service - Generate conversation titles
export { autoTitleService } from './auto-title.service.js';

// Tool Declarations & Executor
export { agentToolDeclarations } from './tool-declarations.js';
export { executeTool, type ToolExecutionContext } from './tool-executor.js';
