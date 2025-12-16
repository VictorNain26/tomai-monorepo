/**
 * API Routes - Routes REST pour l'API TomAI
 * Architecture modulaire avec séparation des responsabilités
 */

import { Elysia } from 'elysia';
import { handleAuthWithCookies, handleParentAuthWithCookies } from '../middleware/auth.middleware';
import {
  validateSchema,
  isValidationError,
  createChildSchema,
  updateChildSchema
} from '../schemas/validation';

// Services
import { chatService } from '../services/chat.service';
import { parentService } from '../services/parent.service';
import { progressService } from '../services/progress.service';

// Database & Redis
import { db } from '../db/connection';
import { sql } from 'drizzle-orm';
import { redisService } from '../lib/redis.service';
import { env } from '../config/environment.config';

// Types
import type { EducationLevelType } from '../types/education.types';
import { logger } from '../lib/observability';

/**
 * Routes API REST pour TomAI
 */
export const apiRoutes = new Elysia({ name: 'api-routes' })

  // ✅ Route d'initialisation Qdrant - Crée la collection si nécessaire
  .post('/init-qdrant', async () => {
    try {
      const { createCollection, checkQdrantHealth, getCollectionStats } = await import('../services/qdrant/index.js');

      // 1. Health check
      const isHealthy = await checkQdrantHealth();
      if (!isHealthy) {
        return { success: false, error: 'Qdrant connection failed' };
      }

      // 2. Créer la collection
      await createCollection();

      // 3. Stats de la collection
      const stats = await getCollectionStats();

      return {
        success: true,
        message: 'Qdrant collection ready',
        stats
      };
    } catch (error) {
      logger.error('Init Qdrant failed', {
        operation: 'init-qdrant',
        _error: error instanceof Error ? error.message : String(error),
        severity: 'high' as const
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Init Qdrant failed'
      };
    }
  })

  // ✅ Route de test RAG - 3-Level Hybrid Semantic Chunking
  .post('/test-rag', async ({ body }) => {
    const bodyData = body as { query?: string; subject?: string; niveau?: string };
    const query = bodyData.query ?? "Bonjour";
    const niveau = (bodyData.niveau ?? "cm1") as EducationLevelType;
    const matiere = bodyData.subject ?? "mathématiques";

    try {
      // 1. Récupération contexte RAG hybrid search (Qdrant Cloud)
      const { ragSemanticService } = await import('../services/rag.service.js');

      const ragResult = await ragSemanticService.hybridSearch({
        query,
        niveau,
        matiere,
        limit: 5,
        minSimilarity: 0.7
      });

      // 2. Génération réponse Gemini avec contexte RAG (TanStack AI)
      const { generateSimpleResponse } = await import('../lib/ai/index');
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
          strategy: ragResult.strategy,
          semanticChunks: ragResult.semanticChunks.length,
          microChunks: ragResult.microChunks.length,
          averageSimilarity: ragResult.averageSimilarity,
          searchTime: ragResult.searchTime,
          method: 'qdrant-hybrid-rrf'
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
  })

  // Body parser JSON pour nos routes API uniquement (pas Better Auth)
  .onParse(async ({ request }, contentType) => {
    if (contentType === 'application/json') {
      return JSON.parse(await request.text());
    }
  })
  .group('/api', (app) => app

    // HEALTH - Endpoint de santé via API
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

    // CHAT SESSIONS - Gestion des sessions de chat
    .get('/chat/sessions', async ({ request: { headers }, set }) => {
      const authContext = await handleAuthWithCookies(headers, set);
      if (!authContext.success) {
        return authContext.error;
      }

      try {
        const sessions = await chatService.getUserSessions(authContext.user.id);
        return {
          success: true,
          sessions: sessions.map(s => ({
            id: s.id,
            subject: s.subject,
            startedAt: s.startedAt.toISOString(),
            endedAt: s.endedAt?.toISOString() ?? null,
            messagesCount: s.messagesCount
          })),
          count: sessions.length
        };
      } catch (_error) {
        logger.error('Sessions retrieval failed', {
          operation: 'api:chat:sessions',
          userId: authContext.user.id,
          _error: _error instanceof Error ? _error.message : String(_error),
          severity: 'medium' as const
        });
        set.status = 500;
        return { _error: 'Sessions retrieval failed' };
      }
    })

    // CHAT SESSIONS - Dernière session (optimisé pour dashboard)
    .get('/chat/sessions/latest', async ({ request: { headers }, set }) => {
      const authContext = await handleAuthWithCookies(headers, set);
      if (!authContext.success) {
        return authContext.error;
      }

      try {
        const sessions = await chatService.getUserSessions(authContext.user.id, 1);
        const latestSession = sessions[0] ?? null;

        return {
          success: true,
          session: latestSession ? {
            id: latestSession.id,
            subject: latestSession.subject,
            startedAt: latestSession.startedAt.toISOString(),
            endedAt: latestSession.endedAt?.toISOString() ?? null,
            messagesCount: latestSession.messagesCount
          } : null
        };
      } catch (_error) {
        logger.error('Latest session retrieval failed', {
          operation: 'api:chat:sessions:latest',
          userId: authContext.user.id,
          _error: _error instanceof Error ? _error.message : String(_error),
          severity: 'medium' as const
        });
        set.status = 500;
        return { _error: 'Latest session retrieval failed' };
      }
    })

    // CHAT SESSIONS - Créer une nouvelle session
    .post('/chat/session', async ({ body, request: { headers }, set }) => {
      const authContext = await handleAuthWithCookies(headers, set);
      if (!authContext.success) {
        return authContext.error;
      }

      try {
        const { subject } = body as { subject: string };
        if (!subject || typeof subject !== 'string') {
          set.status = 400;
          return { _error: 'Subject is required' };
        }

        const sessionId = await chatService.createSession(authContext.user.id, subject);

        return {
          success: true,
          sessionId,
          message: 'Session created successfully'
        };
      } catch (_error) {
        logger.error('Session creation failed', {
          operation: 'api:chat:session:create',
          userId: authContext.user.id,
          _error: _error instanceof Error ? _error.message : String(_error),
          severity: 'medium' as const
        });
        set.status = 500;
        return { _error: 'Session creation failed' };
      }
    })

    // CHAT SESSIONS - Supprimer une session
    .delete('/chat/session/:id', async ({ params, request: { headers }, set }) => {
      const authContext = await handleAuthWithCookies(headers, set);
      if (!authContext.success) {
        return authContext.error;
      }

      try {
        await chatService.deleteSession(params.id, authContext.user.id);
        return {
          success: true,
          message: 'Session deleted successfully'
        };
      } catch (_error) {
        logger.error('Session deletion failed', {
          operation: 'api:chat:session:delete',
          userId: authContext.user.id,
          _error: _error instanceof Error ? _error.message : String(_error),
          severity: 'medium' as const
        });
        set.status = 500;
        return { _error: 'Session deletion failed' };
      }
    })

    // CHAT SESSIONS - Historique des messages d'une session
    .get('/chat/session/:id/history', async ({ params, request: { headers }, set }) => {
      const authContext = await handleAuthWithCookies(headers, set);
      if (!authContext.success) {
        return authContext.error;
      }

      try {
        const messages = await chatService.getSessionHistory(params.id);
        return {
          success: true,
          messages: messages.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.createdAt.toISOString(),
            aiModel: m.aiModel ?? null,
            attachedFile: m.attachedFile ?? null
          }))
        };
      } catch (_error) {
        logger.error('Session history retrieval failed', {
          operation: 'api:chat:session:history',
          userId: authContext.user.id,
          _error: _error instanceof Error ? _error.message : String(_error),
          severity: 'medium' as const
        });
        set.status = 500;
        return { _error: 'Session history retrieval failed' };
      }
    })

    // MESSAGES - Récupérer un message individuel par ID
    .get('/chat/message/:id', async ({ params, request: { headers }, set }) => {
      const authContext = await handleAuthWithCookies(headers, set);
      if (!authContext.success) {
        return authContext.error;
      }

      try {
        const message = await chatService.getMessageById(params.id, authContext.user.id);

        if (!message) {
          set.status = 404;
          return { _error: 'Message not found' };
        }

        return {
          success: true,
          id: message.id,
          role: message.role,
          content: message.content,
          timestamp: message.timestamp.toISOString(),
          sessionId: message.sessionId,
          aiModel: message.aiModel ?? null,
          attachedFile: message.attachedFile ?? null
        };
      } catch (_error) {
        logger.error('Message retrieval failed', {
          operation: 'api:chat:message',
          userId: authContext.user.id,
          _error: _error instanceof Error ? _error.message : String(_error),
          severity: 'medium' as const
        });
        set.status = 500;
        return { _error: 'Message retrieval failed' };
      }
    })

    // PARENT DASHBOARD - Dashboard parental
    .get('/parent/dashboard', async ({ request: { headers }, set }) => {
      const authContext = await handleParentAuthWithCookies(headers, set);
      if (!authContext.success) {
        return authContext.error;
      }

      try {
        const [children, metrics] = await Promise.all([
          parentService.getParentChildren(authContext.user.id),
          parentService.getParentDashboardMetrics(authContext.user.id)
        ]);

        return {
          success: true,
          parent: {
            id: authContext.user.id,
            name: authContext.user.firstName ?? 'Parent'
          },
          children,
          metrics
        };
      } catch (_error) {
        logger.error('Parent dashboard retrieval failed', {
          operation: 'api:parent:dashboard',
          userId: authContext.user.id,
          _error: _error instanceof Error ? _error.message : String(_error),
          severity: 'medium' as const
        });
        set.status = 500;
        return { _error: 'Dashboard retrieval failed' };
      }
    })

    // PARENT CHILDREN - Liste des enfants
    .get('/parent/children', async ({ request: { headers }, set }) => {
      const authContext = await handleParentAuthWithCookies(headers, set);
      if (!authContext.success) {
        return authContext.error;
      }

      try {
        const children = await parentService.getParentChildren(authContext.user.id);
        return children;
      } catch (_error) {
        logger.error('Parent children retrieval failed', {
          operation: 'api:parent:children',
          userId: authContext.user.id,
          _error: _error instanceof Error ? _error.message : String(_error),
          severity: 'medium' as const
        });
        set.status = 500;
        return { _error: 'Children retrieval failed' };
      }
    })

    // PARENT CHILDREN - Créer enfant
    .post('/parent/children', async ({ body, request: { headers }, set }) => {
      const authContext = await handleParentAuthWithCookies(headers, set);
      if (!authContext.success) {
        return authContext.error;
      }

      // Debug: Log de la requête (sanitisé - pas de password)
      logger.info('Child creation request received', {
        operation: 'api:parent:child:request',
        userId: authContext.user.id,
        bodyType: typeof body,
        bodyKeys: body ? Object.keys(body as object) : [],
        contentLength: JSON.stringify(body).length,
        severity: 'low' as const
      });

      const validation = validateSchema(createChildSchema, body);
      if (isValidationError(validation)) {
        // Logging détaillé pour debug production (sanitisé)
        logger.error('Child creation validation failed', {
          _error: validation._error,
          operation: 'api:parent:child:validation',
          userId: authContext.user.id,
          bodyType: typeof body,
          bodyKeys: body ? Object.keys(body as object) : [],
          validationDetails: validation._error,
          severity: 'medium' as const
        });
        set.status = 400;
        return { _error: 'Validation Error', message: validation._error, details: 'Check request body format' };
      }

      try {
        const child = await parentService.createChild(authContext.user.id, validation.data);
        return { success: true, child, message: 'Child created successfully' };
      } catch (_error) {
        logger.error('Child creation failed', {
          operation: 'api:parent:child:create',
          userId: authContext.user.id,
          _error: _error instanceof Error ? _error.message : String(_error),
          severity: 'high' as const
        });
        set.status = 400;
        return { _error: 'Creation failed', message: _error instanceof Error ? _error.message : 'Failed to create child' };
      }
    })

    // PARENT CHILDREN - Modifier enfant
    .patch('/parent/children/:id', async ({ params, body, request: { headers }, set }) => {
      const authContext = await handleParentAuthWithCookies(headers, set);
      if (!authContext.success) {
        return authContext.error;
      }

      const validation = validateSchema(updateChildSchema, body);
      if (isValidationError(validation)) {
        set.status = 400;
        return { _error: 'Validation Error', message: validation._error };
      }

      try {
        const updateData = {
          ...validation.data,
          dateOfBirth: validation.data.dateOfBirth ? new Date(validation.data.dateOfBirth) : undefined
        };
        const child = await parentService.updateChild(authContext.user.id, params.id, updateData);
        return { success: true, child };
      } catch (_error) {
        logger.error('Child update failed', {
          operation: 'api:parent:child:update',
          userId: authContext.user.id,
          _error: _error instanceof Error ? _error.message : String(_error),
          severity: 'medium' as const
        });
        set.status = 400;
        return { _error: 'Update failed', message: _error instanceof Error ? _error.message : 'Failed to update child' };
      }
    })

    // PARENT CHILDREN - Supprimer enfant
    .delete('/parent/children/:id', async ({ params, request: { headers }, set }) => {
      const authContext = await handleParentAuthWithCookies(headers, set);
      if (!authContext.success) {
        return authContext.error;
      }

      try {
        await parentService.deleteChild(authContext.user.id, params.id);
        return { success: true, message: 'Child deleted successfully' };
      } catch (_error) {
        logger.error('Child deletion failed', {
          operation: 'api:parent:child:delete',
          userId: authContext.user.id,
          _error: _error instanceof Error ? _error.message : String(_error),
          severity: 'medium' as const
        });
        set.status = 400;
        return { _error: 'Deletion failed', message: _error instanceof Error ? _error.message : 'Failed to delete child' };
      }
    })

    // EDUCATION - Niveaux scolaires disponibles (depuis Qdrant)
    .get('/education/levels', async ({ set }) => {
      try {
        const { educationQdrantService } = await import('../services/education-qdrant.service.js');
        const levels = await educationQdrantService.getAvailableLevels();

        logger.info('Education levels retrieved', {
          operation: 'api:education:levels:success',
          total: levels.length,
          ragAvailable: levels.filter(l => l.ragAvailable).length,
          severity: 'low' as const
        });

        return {
          success: true,
          levels,
          total: levels.length,
          ragAvailableCount: levels.filter(l => l.ragAvailable).length
        };
      } catch (_error) {
        logger.error('Education levels retrieval failed', {
          operation: 'api:education:levels:error',
          _error: _error instanceof Error ? _error.message : String(_error),
          severity: 'high' as const
        });
        set.status = 500;
        return { _error: 'Failed to retrieve education levels' };
      }
    })

    // LV2 OPTIONS - Options de langue vivante 2 disponibles
    .get('/education/lv2-options', async () => {
      const { educationQdrantService } = await import('../services/education-qdrant.service.js');
      const options = educationQdrantService.getLv2Options();

      return {
        success: true,
        options,
        count: options.length,
        description: 'LV2 disponible à partir de la 5ème. Un seul choix possible.'
      };
    })

    // LV2 CHECK - Vérifie si un niveau permet la LV2
    .get('/education/lv2-eligible/:level', async ({ params }) => {
      const level = params.level as EducationLevelType;
      const { educationQdrantService } = await import('../services/education-qdrant.service.js');
      const isEligible = educationQdrantService.isLv2EligibleLevel(level);

      return {
        success: true,
        level,
        lv2Eligible: isEligible,
        message: isEligible
          ? 'Ce niveau permet de choisir une LV2'
          : 'La LV2 commence en 5ème'
      };
    })

    // SUBJECTS - Matières par niveau scolaire (depuis Qdrant)
    // LV2 fournie via query param ?selectedLv2=espagnol|allemand|italien
    // Le frontend DOIT toujours passer selectedLv2 depuis useUser() pour éviter les problèmes de cache
    .get('/subjects/:level', async ({ params, query, set }) => {
      try {
        const level = params.level as EducationLevelType;
        const selectedLv2 = (query as Record<string, string>).selectedLv2 as 'espagnol' | 'allemand' | 'italien' | undefined;

        if (!level) {
          set.status = 400;
          return { _error: 'School level is required' };
        }

        // 🔍 Récupération depuis Qdrant avec filtrage LV2 (source de vérité RAG)
        const { educationQdrantService } = await import('../services/education-qdrant.service.js');

        // Utiliser getSubjectsForLevelWithLv2 pour appliquer la logique LV2
        const subjects = await educationQdrantService.getSubjectsForLevelWithLv2(level, selectedLv2 ?? null);

        if (subjects.length === 0) {
          logger.warn('No subjects found for level in Qdrant', {
            operation: 'api:subjects:empty',
            level,
            selectedLv2: selectedLv2 ?? 'none',
            severity: 'medium' as const
          });

          // Retourner 200 avec tableau vide (pas une erreur, juste pas de contenu RAG)
          return {
            success: true,
            subjects: [],
            level,
            selectedLv2: selectedLv2 ?? null,
            message: 'No RAG content available for this level yet'
          };
        }

        logger.info('Subjects retrieved from Qdrant', {
          operation: 'api:subjects:success',
          level,
          selectedLv2: selectedLv2 ?? 'none',
          count: subjects.length,
          severity: 'low' as const
        });

        return {
          success: true,
          subjects,
          level,
          selectedLv2: selectedLv2 ?? null
        };
      } catch (_error) {
        logger.error('Subjects retrieval failed', {
          operation: 'api:subjects:error',
          level: params.level,
          _error: _error instanceof Error ? _error.message : String(_error),
          severity: 'high' as const
        });
        set.status = 500;
        return { _error: 'Failed to retrieve subjects from Qdrant' };
      }
    })

    // PROGRESS - Dashboard étudiant
    .get('/progress/dashboard', async ({ request: { headers }, set }) => {
      const authContext = await handleAuthWithCookies(headers, set);
      if (!authContext.success) {
        return authContext.error;
      }

      try {
        const stats = await progressService.getStudentStats(authContext.user.id);
        return {
          success: true,
          student: {
            id: authContext.user.id,
            firstName: authContext.user.firstName,
            level: authContext.user.schoolLevel
          },
          stats: {
            totalSessions: stats.totalSessions,
            totalStudyTime: stats.totalStudyTime,
            conceptsLearned: stats.conceptsLearned,
            averageFrustration: stats.averageFrustration
          }
        };
      } catch (_error) {
        logger.error('Progress dashboard retrieval failed', {
          operation: 'api:progress:dashboard',
          userId: authContext.user.id,
          _error: _error instanceof Error ? _error.message : String(_error),
          severity: 'medium' as const
        });
        set.status = 500;
        return { _error: 'Progress retrieval failed' };
      }
    })

    // RAG STATS - Statistiques Qdrant collection
    .get('/rag/stats', async () => {
      try {
        const { getCollectionStats, checkQdrantHealth } = await import('../services/qdrant/index.js');

        const isHealthy = await checkQdrantHealth();
        if (!isHealthy) {
          return {
            success: false,
            error: 'Qdrant connection failed',
            healthy: false
          };
        }

        const stats = await getCollectionStats();

        return {
          success: true,
          healthy: true,
          collection: stats
        };
      } catch (_error) {
        logger.error('RAG stats retrieval failed', {
          operation: 'api:rag:stats',
          _error: _error instanceof Error ? _error.message : String(_error),
          severity: 'medium' as const
        });
        return {
          success: false,
          error: 'Failed to retrieve RAG stats'
        };
      }
    })
  );