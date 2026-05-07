import { Elysia } from 'elysia';
import { db } from '../../db/connection';
import { sql } from 'drizzle-orm';
import { env, envUtils } from '../../config/environment.config';
import { cacheService } from '../../services/memory-cache.service';
import { logger } from '../../lib/observability';
import type { EducationLevelType } from '../../types/education.types';

export const healthApiRoutes = new Elysia({ name: 'api-health' })

  .get('/curriculum-health', async ({ set }) => {
    // Diagnostic endpoint - development only
    if (!envUtils.isDevelopment) {
      set.status = 404;
      return { error: 'Not found' };
    }
    try {
      const { qdrantService } = await import('../../services/qdrant.service.js');
      const { mistralEmbeddingsService } = await import('../../services/mistral-embeddings.service.js');

      const [qdrantOk, mistralOk] = await Promise.all([
        qdrantService.isAvailable(),
        mistralEmbeddingsService.isAvailable(),
      ]);
      const stats = await qdrantService.getStats();

      return {
        success: true,
        status: qdrantOk && mistralOk ? 'healthy' : 'degraded',
        qdrant: qdrantOk,
        mistral: mistralOk,
        collection: 'tomai_educational',
        pointsCount: stats.total_points
      };
    } catch (error) {
      logger.error('RAG health check failed', {
        operation: 'curriculum-health',
        _error: error instanceof Error ? error.message : String(error),
        severity: 'high' as const
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'RAG health check failed'
      };
    }
  })

  .post('/test-rag', async ({ body, set }) => {
    // Diagnostic endpoint - development only
    if (!envUtils.isDevelopment) {
      set.status = 404;
      return { error: 'Not found' };
    }

    const bodyData = body as { query?: string; subject?: string; niveau?: string };
    const query = bodyData.query ?? "Bonjour";
    const niveau = (bodyData.niveau ?? "cm1") as EducationLevelType;
    const matiere = bodyData.subject ?? "mathematiques";

    try {
      const { ragService } = await import('../../services/rag.service.js');

      const isAvailable = await ragService.isAvailable();
      if (!isAvailable) {
        return {
          success: false,
          error: 'RAG service unavailable'
        };
      }

      const ragResult = await ragService.hybridSearch({
        query,
        niveau,
        matiere,
        limit: 5,
      });

      const { generateSimpleResponse } = await import('../../lib/ai/index');
      const response = await generateSimpleResponse({
        level: niveau,
        subject: matiere,
        userQuery: query,
        educationalContext: ragResult.context
      });

      return {
        success: true,
        response: response.content,
        provider: response.provider,
        tokens: response.tokensUsed,
        rag: {
          resultsCount: ragResult.semanticChunks.length,
          strategy: ragResult.strategy,
          method: 'direct-rrf'
        }
      };
    } catch (error) {
      logger.error('Test RAG failed', {
        operation: 'test-rag',
        _error: error instanceof Error ? error.message : String(error),
        severity: 'high' as const
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Test RAG failed'
      };
    }
  });

export const apiHealthRoutes = new Elysia({ name: 'api-health-check' })

  .get('/health', async ({ set }) => {
    const checks: Record<string, { status: string; latency?: number; error?: string; provider?: string }> = {};
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    try {
      const start = Date.now();
      await db.execute(sql`SELECT 1`);
      checks.database = {
        status: 'healthy',
        latency: Date.now() - start
      };
    } catch (error) {
      checks.database = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Database connection failed'
      };
      overallStatus = 'unhealthy';
    }

    const cacheHealth = cacheService.healthCheck();
    checks.cache = {
      status: cacheHealth.status,
      latency: cacheHealth.latency,
    };

    checks.ai = {
      status: 'healthy',
      provider: 'mistral-small-latest',
    };

    if (overallStatus === 'unhealthy') {
      set.status = 503;
    } else {
      set.status = 200;
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: env.APP_VERSION,
      environment: env.NODE_ENV,
      deployment: env.DEPLOYMENT_ID ?? 'local',
      checks
    };
  });
