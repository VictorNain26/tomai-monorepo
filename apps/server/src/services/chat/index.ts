/**
 * Export central des services chat (stack 100 % Mistral souveraine EU).
 */

// File Context Service - Scaleway + PostgreSQL (RGPD France)
export {
  fileContextService,
  type AttachedFileInfo,
  type FileAnalysisResult,
  type FileAnalysisOptions,
  type MultimodalFile,
} from './file-context.service.js';

// Mistral Chat Service - Agent multi-tool streaming
// Exposed as `streamingService` for compatibility with route imports.
export { mistralChatService as streamingService } from './mistral-chat.service.js';
export { getLearningContext } from './mistral-helpers.js';
export type {
  StreamGenerationParams,
  ChatStreamChunk,
  AttachedFile,
  HistoricalFileRef,
} from './chat-streaming-types.js';

// Summarization Service - SummaryBuffer pattern
export { summarizationService } from './summarization.service.js';

// Token Budget Service - Estimation et allocation
export {
  estimateTokens,
  truncateToTokenBudget,
  calculateBudget,
  type TokenBudget,
  type TokenEstimate,
} from './token-budget.service.js';

// Chat Orchestration Service - Pipeline complet
export {
  chatOrchestrationService,
  ChatOrchestrationError,
  type ChatStreamRequest,
} from './chat-orchestration.service.js';

// Auto-Title Service - Generate conversation titles
export { autoTitleService } from './auto-title.service.js';

// Tool Declarations & Executor
export { agentTools, type MistralTool } from './tool-declarations.js';
export { executeTool, type ToolExecutionContext } from './tool-executor.js';
