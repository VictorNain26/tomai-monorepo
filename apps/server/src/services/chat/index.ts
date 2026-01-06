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

// Streaming Service - TanStack AI Protocol
export {
  streamingService,
  type StreamGenerationParams,
  type TanStackStreamChunk,
  type AttachedFile,
  type HistoricalFileRef
} from './streaming.service.js';
