/**
 * Export central des services chat
 * Architecture 100% TanStack AI Protocol 2025
 */

// File Context Service - Gestion fichiers attachés et contexte session
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
