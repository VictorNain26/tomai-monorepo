/**
 * Mistral Embeddings Service
 *
 * Génère des embeddings avec Mistral API (1024 dimensions).
 * Utilisé par la mémoire épisodique (recherche vectorielle pgvector).
 */

import { logger } from '../lib/observability.js';
import { getMistralSdk } from '../lib/ai/mistral-sdk.js';
import { env } from '../config/env.js';

// Configuration
const EMBEDDING_MODEL = env.MISTRAL_EMBED_MODEL;
const EMBEDDING_DIM = 1024;

// =============================================================================
// Service
// =============================================================================

class MistralEmbeddingsService {
  /**
   * Génère un embedding pour une query
   * Le vecteur est normalisé pour cosine similarity
   */
  async embed(text: string): Promise<number[]> {
    const startTime = Date.now();

    const response = await getMistralSdk().embeddings.create({
      model: EMBEDDING_MODEL,
      inputs: [text],
    });

    const embedding = response.data[0]?.embedding;
    if (!embedding) {
      throw new Error('No embedding returned from Mistral');
    }

    // Normaliser pour cosine similarity
    const normalized = this.normalize(embedding);

    logger.info('Mistral embedding generated', {
      operation: 'mistral:embed',
      textLength: text.length,
      dimensions: normalized.length,
      durationMs: Date.now() - startTime,
    });

    return normalized;
  }

  /**
   * Génère des embeddings en batch (plus efficace pour plusieurs textes)
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const firstText = texts[0];
    if (texts.length === 1 && firstText !== undefined) {
      return [await this.embed(firstText)];
    }

    const startTime = Date.now();

    const response = await getMistralSdk().embeddings.create({
      model: EMBEDDING_MODEL,
      inputs: texts,
    });

    const embeddings = response.data.map((item) => {
      if (!item.embedding) {
        throw new Error('Missing embedding in batch response');
      }
      return this.normalize(item.embedding);
    });

    logger.info('Mistral batch embeddings generated', {
      operation: 'mistral:embed-batch',
      count: texts.length,
      durationMs: Date.now() - startTime,
    });

    return embeddings;
  }

  /**
   * Normalise un vecteur pour cosine similarity
   */
  private normalize(embedding: number[]): number[] {
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    );

    if (magnitude === 0) {
      throw new Error('Cannot normalize zero-magnitude vector');
    }

    return embedding.map((val) => val / magnitude);
  }

  /**
   * Vérifie si Mistral est disponible
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Simple test avec un texte court
      await this.embed('test');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Retourne les infos du modèle
   */
  getModelInfo() {
    return {
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIM,
    };
  }
}

// Singleton
export const mistralEmbeddingsService = new MistralEmbeddingsService();
