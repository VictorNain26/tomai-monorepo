/**
 * TomAI Server - Architecture propre et modulaire
 * Backend Elysia.js avec Better Auth et AI Orchestration
 */

import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';

// Auth et configuration
import { auth } from './lib/auth.js';
import { env, isDevelopment, getCorsOrigins } from './config/env.js';

// Routes modulaires
import { apiRoutes } from './routes/api/index.js';
import { chatMessageRoutes } from './routes/chat-message.routes.js';
import { fileUploadRoutes } from './routes/file-upload.routes.js';
import { statusRoutes } from './routes/subscription/index.js';
import { revenuecatWebhookRoutes } from './routes/revenuecat-webhook.routes.js';
import { ttsRoutes } from './routes/tts.routes.js';
import { deckRoutes, cardRoutes, fsrsRoutes, fsrsExtraRoutes } from './routes/learning/index.js';
import { waitlistRoutes } from './routes/waitlist.routes.js';
import { pronoteSyncRoutes } from './routes/pronote-sync.routes.js';

// Middleware
import { logger } from './lib/observability.js';
import { requestIdMiddleware } from './middleware/request-id.middleware.js';
import { errorHandlerMiddleware } from './middleware/error-handler.middleware.js';
import { createRateLimitMiddleware, RateLimitPresets } from './middleware/rate-limit.middleware.js';

// Database (pour health checks)
import { db } from './db/connection.js';
import { sql } from 'drizzle-orm';
import { cacheService } from './services/memory-cache.service.js';

const isDev = isDevelopment();

// Application Elysia avec architecture modulaire
const app = new Elysia({ name: 'tomai-server' })

  // Request ID + Global Error Handler (avant tout le reste)
  .use(requestIdMiddleware)
  .use(errorHandlerMiddleware)

  // CORS Configuration DÉFINITIVE - Cross-Origin pour frontend/backend séparés
  .use(cors({
    // PRODUCTION: www.tomia.fr + koyeb.app domains autorisés
    origin: getCorsOrigins(),
    // CRITICAL: credentials=true pour cookies SameSite=none cross-origin
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'Cookie', // REQUIRED pour Better Auth sessions
      'Cache-Control',
      'Accept',
      'X-Requested-With'
    ],
    exposeHeaders: [
      'X-Response-Time',
      'X-Start-Time',
      'Content-Type',
      // Set-Cookie intentionally NOT exposed: JavaScript must not be able to read
      // session cookies cross-origin (mobile uses authClient.getCookie from SecureStore).
    ],
    maxAge: 86400 // 24h pour les preflight requests (optimisation)
  }))

  // Security headers — applied BEFORE the handler so SSE/streaming endpoints
  // include them in the initial response flush (onAfterHandle runs after the
  // response has already started for async generators).
  // HSTS is gated on production so local http://localhost dev keeps working.
  .onBeforeHandle(({ set }) => {
    set.headers['X-Content-Type-Options'] = 'nosniff';
    set.headers['X-Frame-Options'] = 'DENY';
    set.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
    set.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()';
    if (!isDev) {
      set.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
    }
  })

  // Swagger pour développement uniquement
  .use(isDev ? swagger({
    documentation: {
      info: {
        title: 'TomAI API - Architecture Clean',
        version: '1.0.0',
        description: 'API TomAI avec chatbot simple et efficace'
      }
    }
  }) : new Elysia())

  // Rate Limiting Global - Protection DDoS et brute-force
  .onBeforeHandle(createRateLimitMiddleware(RateLimitPresets.api))

  // Better Auth integration - Mount at root, Better Auth handles /api/auth basePath
  // IMPORTANT: .mount() at root lets Better Auth manage all /api/auth/* routes
  .mount(auth.handler)

  // Routes principales - Minimal info en production (sécurité)
  .get('/', () => {
    // En développement: afficher les détails pour debug
    if (isDev) {
      return {
        message: 'TomAI Server - Development Mode',
        version: '2.1.0',
        status: 'operational',
        environment: 'development',
        endpoints: {
          chatMessage: '/api/chat/message',
          chatStream: '/api/chat/stream',
          chatHistory: '/api/chat/session/:id/history',
          tts: '/api/tts/synthesize',
          health: '/health',
          api: '/api',
          auth: '/api/auth',
          subscriptions: '/api/subscriptions',
          webhooks: '/webhooks/revenuecat',
          swagger: '/swagger'
        }
      };
    }

    // En production: informations minimales
    return {
      name: 'TomAI API',
      status: 'operational'
    };
  })

  .get('/health', async ({ set }) => {
    const checks: Record<string, { status: string; latency?: number; error?: string; provider?: string }> = {};
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // 1. Database Check (CRITIQUE)
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
      overallStatus = 'unhealthy';  // Database critique → unhealthy
    }

    // 2. Cache Check (in-memory, always healthy)
    const cacheHealth = cacheService.healthCheck();
    checks.cache = {
      status: cacheHealth.status,
      latency: cacheHealth.latency,
    };

    // 3. AI Service Check — Mistral key presence only, no API roundtrip to
    // avoid rate-limit noise on the global health endpoint. The dedicated
    // /health/ai endpoint below probes the actual API with a tiny call.
    const mistralModel = env.MISTRAL_MODEL;
    const hasMistralKey = !!env.MISTRAL_API_KEY;

    if (!hasMistralKey) {
      checks.ai = {
        status: 'unhealthy',
        error: 'MISTRAL_API_KEY not configured',
        provider: mistralModel,
      };
      if (overallStatus === 'healthy') {
        overallStatus = 'degraded';
      }
    } else {
      checks.ai = {
        status: 'healthy',
        provider: mistralModel,
      };
    }

    // 4. Set HTTP Status Code
    if (overallStatus === 'unhealthy') {
      set.status = 503;  // Service Unavailable
    } else {
      set.status = 200;  // OK (healthy ou degraded)
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: env.APP_VERSION,
      environment: env.NODE_ENV,
      deployment: env.DEPLOYMENT_ID ?? 'local',
      checks
    };
  })

  // Diagnostic AI endpoint - probes the actual Mistral API with a tiny call.
  // Separated from /health so the main health response stays cheap and
  // immune to upstream rate-limit blips.
  .get('/health/ai', async ({ set }) => {
    const startTime = Date.now();
    const model = env.MISTRAL_MODEL;

    if (!env.MISTRAL_API_KEY) {
      set.status = 503;
      return {
        status: 'unhealthy',
        error: 'MISTRAL_API_KEY not configured',
        model,
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const { generateText } = await import('./lib/ai/mistral-client.js');
      const response = await generateText({
        model: 'ministral-3b-latest', // cheapest model for health-check
        messages: [{ role: 'user', content: 'Réponds uniquement "OK" sans rien ajouter.' }],
        maxTokens: 10,
        temperature: 0,
        timeoutMs: 8_000,
      });

      const latencyMs = Date.now() - startTime;

      logger.info('AI health check passed', {
        operation: 'health:ai:success',
        model,
        latencyMs,
        responsePreview: response.substring(0, 20),
      });

      return {
        status: 'healthy',
        model,
        latencyMs,
        responsePreview: response.substring(0, 50),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const latencyMs = Date.now() - startTime;

      let errorType = 'unknown';
      if (errorMessage.includes('429')) errorType = 'rate_limit';
      else if (errorMessage.includes('401') || errorMessage.toLowerCase().includes('api key')) errorType = 'api_key_invalid';
      else if (errorMessage.includes('404')) errorType = 'model_not_found';
      else if (errorMessage.toLowerCase().includes('quota')) errorType = 'quota_exceeded';
      else if (errorMessage.includes('503') || errorMessage.toLowerCase().includes('unavailable')) errorType = 'service_unavailable';

      logger.error('AI health check failed', {
        operation: 'health:ai:failed',
        model,
        _error: errorMessage,
        errorType,
        latencyMs,
        severity: 'high' as const,
      });

      set.status = 503;
      return {
        status: 'unhealthy',
        model,
        error: errorMessage,
        errorType,
        latencyMs,
        timestamp: new Date().toISOString(),
      };
    }
  })

  // Routes modulaires
  .use(apiRoutes)
  .use(chatMessageRoutes)   // Messages chat HTTP simple
  .use(fileUploadRoutes)  // Upload: Scaleway + PostgreSQL (RGPD France)
  .use(statusRoutes)        // Subscription status + token usage (DB-driven)
  .use(revenuecatWebhookRoutes) // Webhooks RevenueCat (single source of subscription truth)
  .use(ttsRoutes)           // Text-to-Speech (Gemini 2.5 Flash TTS - 3.0 pending)
  .use(deckRoutes)          // Outils de révision - decks, subjects, topics
  .use(cardRoutes)          // Outils de révision - cards CRUD, AI generation
  .use(fsrsRoutes)          // FSRS: révision espacée adaptative par niveau
  .use(fsrsExtraRoutes)     // FSRS: preview, reset, config
  .use(waitlistRoutes)      // Waitlist - Landing page email collection
  .use(pronoteSyncRoutes)   // Pronote credential sync (device-first)


// Export pour utilisation dans index.ts
export { app };

// Eden Treaty type export - Type-safety end-to-end frontend/backend
export type App = typeof app;

// Re-export initializeServices from server-lifecycle
export { initializeServices } from './services/server-lifecycle.js';
