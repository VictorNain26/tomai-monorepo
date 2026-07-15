import { Elysia } from 'elysia';
import { db } from '../../db/connection';
import { sql } from 'drizzle-orm';
import { env, isDevelopment } from '../../config/env';
import { cacheService } from '../../services/memory-cache.service';
import { logger } from '../../lib/observability';
import type { EducationLevelType } from '../../types/education.types';

export const healthApiRoutes = new Elysia({ name: 'api-health' })

  .get('/curriculum-health', async ({ status }) => {
    // Diagnostic endpoint - development only
    if (!isDevelopment()) {
      return status(404, { error: 'Not found' });
    }
    try {
      const { qdrantService } = await import('../../services/qdrant.service.js');
      const { aiServiceClient } = await import('../../services/ai-service.client.js');

      const [qdrantOk, aiOk] = await Promise.all([
        qdrantService.isAvailable(),
        aiServiceClient.isAvailable(),
      ]);
      const stats = await qdrantService.getStats();

      return {
        success: true,
        status: qdrantOk && aiOk ? 'healthy' : 'degraded',
        qdrant: qdrantOk,
        aiService: aiOk,
        collection: env.QDRANT_COLLECTION,
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

  .post('/test-rag', async ({ body, status }) => {
    // Diagnostic endpoint - development only
    if (!isDevelopment()) {
      return status(404, { error: 'Not found' });
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

      // Diagnostic dev-only : on retourne juste le contexte RAG (chunks)
      // sans appeler de LLM. La génération de réponse appartient au flow
      // chat normal (chat-orchestration) et n'a pas sa place dans /test-rag.
      return {
        success: true,
        rag: {
          resultsCount: ragResult.semanticChunks.length,
          strategy: ragResult.strategy,
          method: 'direct-rrf',
          context: ragResult.context.slice(0, 2000), // tronqué pour réponse JSON raisonnable
        },
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

  .get('/health', async ({ status }) => {
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

    if (env.AI_SERVICE_URL) {
      try {
        const start = Date.now();
        const res = await fetch(`${env.AI_SERVICE_URL}/health`, {
          signal: AbortSignal.timeout(2000),
          headers: env.AI_SERVICE_TOKEN ? { Authorization: `Bearer ${env.AI_SERVICE_TOKEN}` } : {},
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        checks.aiService = { status: 'healthy', latency: Date.now() - start };
      } catch (error) {
        checks.aiService = {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'unreachable',
        };
        if (overallStatus === 'healthy') overallStatus = 'degraded';
      }
    } else {
      checks.aiService = { status: 'not_configured' };
    }

    if (env.QDRANT_ENABLED === 'true' && env.QDRANT_URL) {
      try {
        const start = Date.now();
        const res = await fetch(`${env.QDRANT_URL}/healthz`, {
          signal: AbortSignal.timeout(2000),
          headers: env.QDRANT_API_KEY ? { 'api-key': env.QDRANT_API_KEY } : {},
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        checks.qdrant = { status: 'healthy', latency: Date.now() - start };
      } catch (error) {
        checks.qdrant = {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'unreachable',
        };
        if (overallStatus === 'healthy') overallStatus = 'degraded';
      }
    } else {
      checks.qdrant = { status: 'not_configured' };
    }

    const body = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: env.APP_VERSION,
      commit: env.GIT_COMMIT_SHA,
      environment: env.NODE_ENV,
      deployment: env.DEPLOYMENT_ID ?? 'local',
      checks,
    };

    return overallStatus === 'unhealthy' ? status(503, body) : body;
  });
