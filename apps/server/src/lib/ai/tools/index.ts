/**
 * TanStack AI Tools - Exports centralisés
 *
 * Server Tools disponibles pour l'AI:
 * - ragSearchTool: Recherche programmes officiels français
 *
 * Usage:
 * ```typescript
 * import { ragSearchTool } from '@/lib/ai/tools';
 *
 * const stream = chat({
 *   adapter: geminiAdapter,
 *   model: 'gemini-2.5-flash',
 *   messages,
 *   tools: [ragSearchTool]
 * });
 * ```
 */

export {
  ragSearchTool,
  ragSearchToolDef,
  type RAGSearchInput,
  type RAGSearchOutput
} from './rag-search.tool.js';
