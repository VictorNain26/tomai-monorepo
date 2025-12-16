/**
 * Mistral AI Embeddings Service - PRODUCTION READY
 * Service robuste pour générer des embeddings 1024-dimensions avec Mistral AI
 *
 * Migration depuis Gemini (768D) vers Mistral (1024D) - Janvier 2025
 *
 * ✅ AVANTAGES MISTRAL:
 * - Entreprise française (Paris) - Souveraineté données
 * - 1024 dimensions - Meilleure représentation sémantique
 * - MTEB retrieval score: 55.26
 * - Prix: $0.10/1M tokens
 *
 * @see https://docs.mistral.ai/capabilities/embeddings/text_embeddings
 */

import { Mistral } from '@mistralai/mistralai';
import { logger } from '../lib/observability';

interface EmbeddingResult {
  embedding: number[];
  tokens?: number;
  success: boolean;
  error?: string;
  retries?: number;
  fallbackUsed?: boolean;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export class MistralEmbeddingsService {
  private client: Mistral;
  private readonly dimensions: number;
  private readonly model: string;
  private readonly retryConfig: RetryConfig;
  private readonly fallbackEmbedding: number[];
  private requestCount = 0;
  private lastRequestTime = 0;
  private readonly rateLimitDelay = 100; // 100ms between requests (Mistral has higher limits)

  constructor() {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      throw new Error('MISTRAL_API_KEY is required for embeddings');
    }

    // Mistral embed: 1024 dimensions fixes
    this.dimensions = 1024;
    this.model = 'mistral-embed';
    this.client = new Mistral({ apiKey });

    // Configuration retry production
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2
    };

    // Fallback embedding zéro pour cas critique
    this.fallbackEmbedding = new Array(this.dimensions).fill(0);
  }

  /**
   * Rate limiting intelligent
   */
  private async applyRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimitDelay) {
      await this.sleep(this.rateLimitDelay - timeSinceLastRequest);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Délai avec Promise
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry avec exponential backoff
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    attempt: number = 0
  ): Promise<T> {
    try {
      await this.applyRateLimit();
      return await operation();
    } catch (error) {
      if (attempt >= this.retryConfig.maxRetries) {
        throw error;
      }

      const delay = Math.min(
        this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt),
        this.retryConfig.maxDelay
      );

      logger.debug(`Mistral retry ${attempt + 1}/${this.retryConfig.maxRetries} in ${delay}ms`, { operation: 'mistral:retry', attempt: attempt + 1, maxRetries: this.retryConfig.maxRetries, delayMs: delay, _error: error instanceof Error ? error.message : String(error) });
      await this.sleep(delay);

      return this.executeWithRetry(operation, attempt + 1);
    }
  }

  /**
   * Normalise un vecteur (unit vector, magnitude = 1.0)
   * Important pour la similarité cosinus dans Qdrant
   */
  private normalizeVector(embedding: number[]): number[] {
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));

    if (magnitude === 0) {
      throw new Error('Cannot normalize zero-magnitude embedding vector');
    }

    return embedding.map(val => val / magnitude);
  }

  /**
   * Génère un embedding pour un texte unique - VERSION PRODUCTION
   * @param text Texte à encoder (contenu éducatif ou query)
   * @returns Embedding vectoriel 1024D pour RAG
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    this.requestCount++;

    // Validation input
    if (!text || text.trim().length === 0) {
      return {
        embedding: this.fallbackEmbedding,
        success: false,
        error: 'Text cannot be empty',
        fallbackUsed: true
      };
    }

    try {
      const result = await this.executeWithRetry(async () => {
        const response = await this.client.embeddings.create({
          model: this.model,
          inputs: [text]
        });

        if (!response.data || response.data.length === 0) {
          throw new Error('No embedding data received from Mistral API');
        }

        const embedding = response.data[0]?.embedding;

        if (!embedding || embedding.length !== this.dimensions) {
          throw new Error(`Invalid embedding dimensions: ${embedding?.length ?? 0} != ${this.dimensions}`);
        }

        // Normalisation pour optimiser cosine similarity
        const normalizedEmbedding = this.normalizeVector(embedding);

        return {
          embedding: normalizedEmbedding,
          tokens: response.usage?.totalTokens
        };
      });

      return {
        embedding: result.embedding,
        tokens: result.tokens,
        success: true,
        retries: 0
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Mistral embedding failed after retries', { operation: 'mistral:embed:fail', _error: errorMsg, requestCount: this.requestCount, severity: 'high' as const });

      // FALLBACK CRITIQUE: retourner embedding zéro pour éviter crash système
      return {
        embedding: this.fallbackEmbedding,
        success: false,
        error: errorMsg,
        retries: this.retryConfig.maxRetries,
        fallbackUsed: true
      };
    }
  }

  /**
   * Génère un embedding pour une requête de recherche
   * @param query Question de l'étudiant
   * @returns Embedding optimisé pour la recherche
   */
  async generateQueryEmbedding(query: string): Promise<EmbeddingResult> {
    return this.generateEmbedding(query);
  }

  /**
   * Génère un embedding pour du contenu éducatif
   * @param content Contenu éducatif (programme, ressource, etc.)
   * @returns Embedding optimisé pour le stockage
   */
  async generateDocumentEmbedding(content: string): Promise<EmbeddingResult> {
    return this.generateEmbedding(content);
  }

  /**
   * Génère des embeddings pour plusieurs textes en batch - OPTIMISÉ
   * Mistral supporte nativement les batch requests
   *
   * @param texts Array de textes à encoder (chunks)
   * @param batchSize Taille des lots (défaut: 50, max recommandé Mistral)
   * @returns Array d'embeddings dans le même ordre
   */
  async batchEmbedTexts(
    texts: string[],
    batchSize: number = 50
  ): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    const totalBatches = Math.ceil(texts.length / batchSize);

    logger.info('Mistral batch embedding started', { operation: 'mistral:batch:start', totalTexts: texts.length, totalBatches, batchSize });

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;

      logger.debug(`Processing batch ${batchNum}/${totalBatches}`, { operation: 'mistral:batch:process', batchNum, totalBatches, batchSize: batch.length });

      try {
        await this.applyRateLimit();

        const response = await this.executeWithRetry(async () => {
          return await this.client.embeddings.create({
            model: this.model,
            inputs: batch
          });
        });

        // Process batch response
        for (let j = 0; j < batch.length; j++) {
          const embeddingData = response.data[j];

          if (embeddingData?.embedding && embeddingData.embedding.length === this.dimensions) {
            const normalizedEmbedding = this.normalizeVector(embeddingData.embedding);
            results.push({
              embedding: normalizedEmbedding,
              success: true
            });
          } else {
            results.push({
              embedding: this.fallbackEmbedding,
              success: false,
              error: 'Invalid embedding in batch response',
              fallbackUsed: true
            });
          }
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Batch error';
        logger.error(`Batch ${batchNum} failed`, { operation: 'mistral:batch:fail', batchNum, _error: errorMsg, severity: 'high' as const });

        // Fallback pour tout le batch en erreur
        for (let j = 0; j < batch.length; j++) {
          results.push({
            embedding: this.fallbackEmbedding,
            success: false,
            error: errorMsg,
            fallbackUsed: true
          });
        }
      }

      // Pause entre lots pour respecter rate limits
      if (i + batchSize < texts.length) {
        await this.sleep(500); // 500ms entre lots
      }
    }

    const successCount = results.filter(r => r.success).length;
    const fallbackCount = results.filter(r => r.fallbackUsed).length;

    logger.info('Mistral batch embedding completed', { operation: 'mistral:batch:complete', successCount, totalCount: texts.length, fallbackCount });
    if (fallbackCount > 0) {
      logger.warn(`${fallbackCount} embeddings used fallback`, { operation: 'mistral:batch:fallback', fallbackCount });
    }

    return results;
  }

  /**
   * Métriques de monitoring
   */
  getMetrics() {
    return {
      totalRequests: this.requestCount,
      lastRequestTime: this.lastRequestTime,
      dimensions: this.dimensions,
      model: this.model,
      rateLimitDelay: this.rateLimitDelay,
      retryConfig: this.retryConfig
    };
  }

  /**
   * Health check pour production
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details: Record<string, unknown> }> {
    try {
      const testResult = await this.generateEmbedding('health check test');

      if (testResult.success && !testResult.fallbackUsed) {
        return {
          status: 'healthy',
          details: {
            dimensions: testResult.embedding.length,
            model: this.model,
            retries: testResult.retries
          }
        };
      } else if (testResult.fallbackUsed) {
        return {
          status: 'degraded',
          details: {
            error: testResult.error,
            fallbackUsed: true
          }
        };
      } else {
        return {
          status: 'unhealthy',
          details: {
            error: testResult.error
          }
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Health check failed'
        }
      };
    }
  }
}

// Singleton instance PRODUCTION READY
export const mistralEmbeddingsService = new MistralEmbeddingsService();
