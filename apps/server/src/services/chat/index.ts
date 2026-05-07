/**
 * Export central des services chat (stack Mistral).
 */

// File Context Service - Scaleway + PostgreSQL (RGPD France)
export {
  fileContextService,
  type AttachedFileInfo,
  type FileAnalysisResult,
  type FileAnalysisOptions,
  type MultimodalFile,
} from './file-context.service.js';

// Mistral Chat Service - agent multi-tool, exposé sous `streamingService` pour
// compat avec les routes existantes.
export {
  mistralChatService as streamingService,
  getLearningContext,
} from './mistral-chat.service.js';
export type {
  StreamGenerationParams,
  ChatStreamChunk,
  AttachedFile,
  HistoricalFileRef,
} from './mistral-types.js';

// Summarization Service - SummaryBuffer pattern (Mistral aux model)
export { summarizationService } from './summarization.service.js';

// Token Budget Service
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

// Auto-Title Service
export { autoTitleService } from './auto-title.service.js';

// Tool declarations (Mistral-formatted) + executor (provider-agnostic)
export { agentTools } from './mistral-tool-declarations.js';
export { executeTool, type ToolExecutionContext } from './tool-executor.js';
