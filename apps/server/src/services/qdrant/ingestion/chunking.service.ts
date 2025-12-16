/**
 * Chunking Service - Découpage sémantique intelligent
 *
 * Implémente les best practices RAG 2025:
 * 1. Chunking sémantique respectant les phrases
 * 2. Overlap 15% pour continuité contextuelle
 * 3. Token counting précis (approximation efficace)
 * 4. Enrichissement contextuel (Anthropic-style)
 *
 * @see https://arxiv.org/abs/2407.01219 (NVIDIA RAG benchmark)
 * @see https://www.anthropic.com/news/contextual-retrieval
 */

import type {
  RawDocument,
  ContentChunk,
  ChunkingOptions,
  ChunkingResult,
  ChunkMetadata,
} from '../curriculum/types.js';
import { CHUNKING_OPTIONS } from '../curriculum/config-5eme.js';

/**
 * Approximation du nombre de tokens
 * Ratio moyen français: ~4 caractères = 1 token
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Découpe un texte en phrases
 * Gère les abréviations françaises courantes
 */
function splitIntoSentences(text: string): string[] {
  // Protège les abréviations courantes
  const protectedText = text
    .replace(/M\./g, 'M⟨DOT⟩')
    .replace(/Mme\./g, 'Mme⟨DOT⟩')
    .replace(/Dr\./g, 'Dr⟨DOT⟩')
    .replace(/ex\./g, 'ex⟨DOT⟩')
    .replace(/cf\./g, 'cf⟨DOT⟩')
    .replace(/etc\./g, 'etc⟨DOT⟩')
    .replace(/(\d)\./g, '$1⟨DOT⟩');

  // Découpe aux points, points d'interrogation, points d'exclamation
  const sentences = protectedText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/⟨DOT⟩/g, '.').trim())
    .filter((s) => s.length > 0);

  return sentences;
}

/**
 * Regroupe les phrases en chunks respectant la limite de tokens
 */
function groupSentencesIntoChunks(
  sentences: string[],
  options: ChunkingOptions
): string[] {
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence);

    // Si la phrase seule dépasse le max, on la garde quand même
    if (sentenceTokens > options.maxTokens) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
        currentChunk = [];
        currentTokens = 0;
      }
      chunks.push(sentence);
      continue;
    }

    // Si ajouter cette phrase dépasse le max, finalise le chunk actuel
    if (currentTokens + sentenceTokens > options.maxTokens && currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));

      // Calcule l'overlap: reprend les dernières phrases
      const overlapTokens = Math.floor(options.maxTokens * (options.overlapPercent / 100));
      const overlapChunk: string[] = [];
      let overlapCount = 0;

      for (let i = currentChunk.length - 1; i >= 0; i--) {
        const tokens = estimateTokens(currentChunk[i]!);
        if (overlapCount + tokens <= overlapTokens) {
          overlapChunk.unshift(currentChunk[i]!);
          overlapCount += tokens;
        } else {
          break;
        }
      }

      currentChunk = overlapChunk;
      currentTokens = overlapCount;
    }

    currentChunk.push(sentence);
    currentTokens += sentenceTokens;
  }

  // Ajoute le dernier chunk s'il a du contenu
  if (currentChunk.length > 0) {
    const finalChunk = currentChunk.join(' ');
    // Évite les chunks trop petits sauf si c'est le seul
    if (estimateTokens(finalChunk) >= options.minTokens || chunks.length === 0) {
      chunks.push(finalChunk);
    } else if (chunks.length > 0) {
      // Fusionne avec le chunk précédent si trop petit
      chunks[chunks.length - 1] += ' ' + finalChunk;
    }
  }

  return chunks;
}

/**
 * Génère un résumé court pour le contexte
 */
function generateShortSummary(text: string, maxLength: number = 100): string {
  const sentences = splitIntoSentences(text);
  if (sentences.length === 0) return '';

  let summary = sentences[0]!;
  if (summary.length > maxLength) {
    summary = summary.slice(0, maxLength - 3) + '...';
  }
  return summary;
}

/**
 * Enrichit un chunk avec le contexte du document (Anthropic-style)
 *
 * Format: "Ce chunk fait partie de [titre]. Il traite de [résumé contexte].
 *          [Contenu du chunk]"
 */
function enrichChunkWithContext(
  chunk: string,
  document: RawDocument,
  previousChunk?: string,
  nextChunk?: string
): string {
  const parts: string[] = [];

  // Contexte du document
  parts.push(`📄 Document: "${document.title}" (${document.matiere}, ${document.niveau})`);

  // Domaine si disponible
  if (document.domaine) {
    parts.push(`📌 Domaine: ${document.domaine}`);
  }

  // Contexte précédent
  if (previousChunk) {
    const prevSummary = generateShortSummary(previousChunk, 80);
    parts.push(`⬆️ Précédent: ${prevSummary}`);
  }

  // Contenu principal
  parts.push('');
  parts.push(chunk);

  // Contexte suivant
  if (nextChunk) {
    const nextSummary = generateShortSummary(nextChunk, 80);
    parts.push('');
    parts.push(`⬇️ Suite: ${nextSummary}`);
  }

  return parts.join('\n');
}

/**
 * Découpe un document en chunks
 */
export function chunkDocument(
  document: RawDocument,
  options: ChunkingOptions = CHUNKING_OPTIONS
): ChunkingResult {
  const sentences = splitIntoSentences(document.content);
  const rawChunks = groupSentencesIntoChunks(sentences, options);

  const chunks: ContentChunk[] = [];
  let charOffset = 0;

  for (let i = 0; i < rawChunks.length; i++) {
    const content = rawChunks[i]!;
    const charStart = document.content.indexOf(content, charOffset);
    const charEnd = charStart + content.length;

    // Récupère chunks adjacents pour contexte
    const prevChunk = i > 0 ? rawChunks[i - 1] : undefined;
    const nextChunk = i < rawChunks.length - 1 ? rawChunks[i + 1] : undefined;

    const contextualizedContent = enrichChunkWithContext(
      content,
      document,
      prevChunk,
      nextChunk
    );

    const metadata: ChunkMetadata = {
      niveau: document.niveau,
      matiere: document.matiere,
      cycle: document.cycle,
      domaine: document.domaine,
      sousdomaine: document.sousdomaine,
      contentType: document.contentType,
      title: document.title,
      source: document.source,
      sourceUrl: document.sourceUrl,
      chunkOf: rawChunks.length,
      previousChunkSummary: prevChunk ? generateShortSummary(prevChunk, 80) : undefined,
      nextChunkSummary: nextChunk ? generateShortSummary(nextChunk, 80) : undefined,
    };

    chunks.push({
      id: crypto.randomUUID(), // UUID valide pour Qdrant
      documentId: document.id,
      chunkIndex: i,
      content,
      contextualizedContent,
      charStart: charStart >= 0 ? charStart : charOffset,
      charEnd: charStart >= 0 ? charEnd : charOffset + content.length,
      tokenCount: estimateTokens(content),
      metadata,
    });

    charOffset = charStart >= 0 ? charEnd : charOffset + content.length;
  }

  // Calcule les statistiques
  const tokenCounts = chunks.map((c) => c.tokenCount);
  const stats = {
    totalChunks: chunks.length,
    avgTokensPerChunk: tokenCounts.length > 0
      ? Math.round(tokenCounts.reduce((a, b) => a + b, 0) / tokenCounts.length)
      : 0,
    minTokens: tokenCounts.length > 0 ? Math.min(...tokenCounts) : 0,
    maxTokens: tokenCounts.length > 0 ? Math.max(...tokenCounts) : 0,
  };

  return { chunks, stats };
}

/**
 * Découpe plusieurs documents en parallèle
 */
export async function chunkDocuments(
  documents: RawDocument[],
  options: ChunkingOptions = CHUNKING_OPTIONS
): Promise<{
  allChunks: ContentChunk[];
  totalStats: {
    documentsProcessed: number;
    totalChunks: number;
    totalTokens: number;
    avgChunksPerDocument: number;
    avgTokensPerChunk: number;
  };
}> {
  const allChunks: ContentChunk[] = [];
  let totalTokens = 0;

  for (const doc of documents) {
    const result = chunkDocument(doc, options);
    allChunks.push(...result.chunks);
    totalTokens += result.chunks.reduce((sum, c) => sum + c.tokenCount, 0);
  }

  return {
    allChunks,
    totalStats: {
      documentsProcessed: documents.length,
      totalChunks: allChunks.length,
      totalTokens,
      avgChunksPerDocument: documents.length > 0
        ? Math.round(allChunks.length / documents.length)
        : 0,
      avgTokensPerChunk: allChunks.length > 0
        ? Math.round(totalTokens / allChunks.length)
        : 0,
    },
  };
}

/**
 * Convertit les chunks en documents indexables pour Qdrant
 */
export function chunksToIndexableDocuments(
  chunks: ContentChunk[],
  useContextualized: boolean = true
): Array<{
  id: string;
  content: string;
  payload: ContentChunk['metadata'] & {
    content: string;
    chunkIndex: number;
    documentId: string;
    tokenCount: number;
  };
}> {
  return chunks.map((chunk) => ({
    id: chunk.id,
    content: useContextualized && chunk.contextualizedContent
      ? chunk.contextualizedContent
      : chunk.content,
    payload: {
      ...chunk.metadata,
      content: chunk.content, // Toujours le contenu original dans payload
      chunkIndex: chunk.chunkIndex,
      documentId: chunk.documentId,
      tokenCount: chunk.tokenCount,
    },
  }));
}

/**
 * Crée un ID unique pour un document (UUID v4 valide pour Qdrant)
 * Le contenu est encodé dans le payload, pas dans l'ID
 * @deprecated Utiliser crypto.randomUUID() directement dans les scripts
 */
export function generateDocumentId(): string {
  return crypto.randomUUID();
}
