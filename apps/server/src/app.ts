/**
 * TomAI Server - Architecture propre et modulaire
 * Backend Elysia.js avec Better Auth et AI Orchestration
 */

import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';

// Auth et configuration
import { auth } from './lib/auth.js';
import { appConfig } from './config/app.config.js';
import { env, envUtils } from './config/environment.config.js';

// Routes modulaires
import { apiRoutes } from './routes/api.routes.js';
import { chatMessageRoutes } from './routes/chat-message.routes.js';
import { fileUploadRoutes } from './routes/file-upload.routes.js';
import { establishmentRoutes } from './routes/establishment.routes.js';
import {
  checkoutRoutes,
  childrenRoutes,
  statusRoutes,
  lifecycleRoutes
} from './routes/subscription/index.js';
import { stripeWebhookRoutes } from './routes/stripe-webhook.routes.js';
import { ttsRoutes } from './routes/tts.routes.js';
import { deckRoutes, cardRoutes, fsrsRoutes } from './routes/learning/index.js';
import { adminRoutes } from './routes/admin.routes.js';

// Services
import { logger } from './lib/observability.js';
import { memoryMonitor } from './middleware/memory-monitor.middleware.js';
import { createRateLimitMiddleware, RateLimitPresets } from './middleware/rate-limit.middleware.js';
import { tokenQuotaService } from './services/token-quota.service.js';

// Database & Redis (pour health checks)
import { db } from './db/connection.js';
import { sql } from 'drizzle-orm';
import { redisService } from './lib/redis.service.js';
import { runMigrations } from './db/migrate.js';

const isDev = envUtils.isDevelopment;

// Application Elysia avec architecture modulaire
const app = new Elysia({ name: 'tomai-server' })


  // CORS Configuration DÉFINITIVE - Cross-Origin pour frontend/backend séparés
  .use(cors({
    // PRODUCTION: www.tomia.fr + koyeb.app domains autorisés
    origin: appConfig.security.corsOrigins,
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
      'Set-Cookie' // PRODUCTION: Expose Set-Cookie pour debug
    ],
    maxAge: 86400 // 24h pour les preflight requests (optimisation)
  }))

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
          establishments: '/api/establishments',
          subscriptions: '/api/subscriptions',
          webhooks: '/webhooks/stripe',
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

    // 2. Redis Check (NON critique → degraded si échoue)
    try {
      const start = Date.now();
      const testKey = 'health_check_test';
      await redisService.set(testKey, 'ping', 60);
      await redisService.get(testKey);
      await redisService.del(testKey);

      checks.redis = {
        status: 'healthy',
        latency: Date.now() - start
      };
    } catch (error) {
      checks.redis = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Redis operation failed'
      };
      // Redis non critique → degraded (pas unhealthy)
      if (overallStatus === 'healthy') {
        overallStatus = 'degraded';
      }
    }

    // 3. AI Service Check (assume healthy - pas de dépendance directe)
    checks.ai = {
      status: 'healthy',
      provider: 'gemini-2.5-flash'
    };

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

  // Routes modulaires
  .use(apiRoutes)
  .use(chatMessageRoutes)   // Messages chat HTTP simple
  .use(fileUploadRoutes)    // Upload et analyse de fichiers
  .use(establishmentRoutes) // Recherche établissements scolaires
  .use(checkoutRoutes)      // Subscription checkout
  .use(childrenRoutes)      // Children management
  .use(statusRoutes)        // Subscription status, portal, usage
  .use(lifecycleRoutes)     // Cancel, resume, preview
  .use(stripeWebhookRoutes) // Webhooks Stripe (raw body)
  .use(ttsRoutes)           // Text-to-Speech Gemini 2.5 Flash TTS
  .use(deckRoutes)          // Outils de révision - decks, subjects, topics
  .use(cardRoutes)          // Outils de révision - cards CRUD, AI generation
  .use(fsrsRoutes)          // FSRS: révision espacée adaptative par niveau
  .use(adminRoutes)         // Admin panel - user management (role: admin uniquement)


// Export pour utilisation dans index.ts
export { app };

// Eden Treaty type export - Type-safety end-to-end frontend/backend
export type App = typeof app;

/**
 * Token quota reset cron job
 * Runs every hour and checks if it's 10:00 AM Paris time
 * If so, resets all users' daily token quotas
 */
let tokenResetInterval: ReturnType<typeof setInterval> | null = null;

function startTokenResetCron(): void {
  // Run every hour
  const ONE_HOUR = 60 * 60 * 1000;

  // Clear any existing interval
  if (tokenResetInterval) {
    clearInterval(tokenResetInterval);
  }

  tokenResetInterval = setInterval(async () => {
    try {
      // Check if it's 10:00 AM Paris time (between 10:00 and 10:59)
      const now = new Date();
      const parisFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Paris',
        hour: '2-digit',
        hour12: false,
      });
      const parisHour = parseInt(parisFormatter.format(now));

      if (parisHour === 10) {
        logger.info('Token reset cron triggered at 10:00 AM Paris', {
          operation: 'token-reset-cron',
          parisTime: now.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })
        });

        const result = await tokenQuotaService.resetAllDailyTokens();

        logger.info('Token reset cron completed', {
          operation: 'token-reset-cron:complete',
          resetCount: result.resetCount
        });
      }
    } catch (error) {
      logger.error('Token reset cron failed', {
        _error: error instanceof Error ? error.message : String(error),
        severity: 'high' as const,
        operation: 'token-reset-cron:error'
      });
    }
  }, ONE_HOUR);

  // Also run immediately on startup to catch any missed resets
  void (async () => {
    try {
      const result = await tokenQuotaService.resetAllDailyTokens();
      if (result.resetCount > 0) {
        logger.info('Token reset on startup', {
          operation: 'token-reset-startup',
          resetCount: result.resetCount
        });
      }
    } catch (error) {
      logger.error('Token reset on startup failed', {
        _error: error instanceof Error ? error.message : String(error),
        severity: 'high' as const,
        operation: 'token-reset-startup:error'
      });
    }
  })();

  logger.info('Token reset cron started', {
    operation: 'token-reset-cron:init',
    schedule: 'Every hour, resets at 10:00 AM Paris time'
  });
}

/**
 * Fonction d'initialisation des services
 * Phase 1.1: Explicit initialization pour éviter race conditions
 * Initialise Redis (lazy→eager) et vérifie PostgreSQL (import-time)
 */
export async function initializeServices(): Promise<void> {
  try {
    logger.info('Initializing TomAI services...', {
      operation: 'services:init',
      environment: env.NODE_ENV
    });

    // 1. Initialize Redis first (lazy → eager)
    // Force connection pour éviter race conditions au premier health check
    try {
      const redisStart = Date.now();
      await redisService.ping();
      const redisLatency = Date.now() - redisStart;

      logger.info('Redis initialized successfully', {
        operation: 'services:init:redis',
        latency_ms: redisLatency,
        provider: 'upstash-rest'
      });
    } catch (redisError) {
      const environment = Bun.env['NODE_ENV'] ?? 'development';
      const errorMessage = redisError instanceof Error ? redisError.message : String(redisError);

      logger.error('Redis initialization failed - CRITICAL', {
        operation: 'services:init:redis:failed',
        _error: errorMessage,
        environment,
        severity: 'critical' as const,
        impact: 'Cache and rate limiting unavailable'
      });

      // ✅ FAIL FAST: Redis requis en production
      if (environment === 'production') {
        throw new Error(`Redis required in production - cannot start: ${errorMessage}`);
      }

      // ⚠️ DEVELOPMENT ONLY: Mode dégradé accepté en dev
      logger.warn('Redis degraded mode enabled (development only)', {
        operation: 'services:init:redis:degraded',
        severity: 'medium' as const,
        note: 'This degraded mode is NOT allowed in production'
      });
    }

    // 2. Run database migrations at startup (Drizzle best practice)
    // This ensures schema is always up-to-date on deployment
    await runMigrations();

    // 3. Verify PostgreSQL connection after migrations
    const dbStart = Date.now();
    await db.execute(sql`SELECT 1 as health_check`);
    const dbLatency = Date.now() - dbStart;

    logger.info('PostgreSQL verified successfully', {
      operation: 'services:init:database',
      latency_ms: dbLatency,
      pool: 'ready'
    });

    // 4. Verify migrations were applied
    const migrations = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM drizzle.__drizzle_migrations
    `);

    logger.info('Database migrations verified', {
      operation: 'services:init:migrations',
      count: Number(migrations[0]?.count ?? 0)
    });

    // 5. PRODUCTION: Démarrer le monitoring mémoire
    memoryMonitor.startMonitoring(30000); // Check toutes les 30 secondes

    // 6. Start token quota reset cron job (every hour, resets at 10:00 AM Paris)
    startTokenResetCron();

    logger.info('All services initialized successfully', {
      operation: 'services:init:success',
      services: {
        database: 'ready',
        redis: 'ready',
        rag: 'qdrant-cloud-gemini',
        memory_monitor: 'active',
        token_reset_cron: 'active'
      },
      environment: env.NODE_ENV
    });

  } catch (_error) {
    logger.error('FATAL: Service initialization failed', {
      operation: 'services:init:error',
      _error: _error instanceof Error ? _error.message : String(_error),
      severity: 'critical' as const
    });
    throw _error;
  }
}
