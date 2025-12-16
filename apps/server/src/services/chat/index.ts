/**
 * Export central des services chat
 * Architecture 100% TanStack AI Protocol 2025
 */

// File Context Service - Gestion fichiers attachés et contexte session
export {
  fileContextService,
  type AttachedFileInfo,
  type FileAnalysisResult,
  type FileAnalysisOptions
} from './file-context.service.js';

// Streaming Service - TanStack AI Protocol
export {
  streamingService,
  type StreamGenerationParams,
  type TanStackStreamChunk
} from './streaming.service.js';
