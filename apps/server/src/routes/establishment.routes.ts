/**
 * Routes Établissements - Version Simplifiée
 * Endpoints essentiels pour la recherche d'établissements scolaires
 */

import { Elysia, t } from 'elysia';
import { establishmentService } from '../services/establishment.service.js';
import { logger } from '../lib/observability.js';
import type { EstablishmentType } from '../db/schema.js';

export const establishmentRoutes = new Elysia({ prefix: '/api/establishments' })

  /**
   * POST /api/establishments/search
   * Recherche textuelle d'établissements
   */
  .post('/search', async ({ body, set }) => {
    try {
      const { query, type, department, limit } = body as {
        query?: string;
        type?: string;
        department?: string;
        limit?: number;
      };

      if (!query || query.trim().length < 3) {
        set.status = 400;
        return {
          success: false,
          _error: 'La requête doit contenir au moins 3 caractères',
          message: 'Query must contain at least 3 characters'
        };
      }

      const result = await establishmentService.searchEstablishments({
        query: query.trim(),
        type: type as EstablishmentType | undefined,
        department,
        limit: limit ?? 10
      });

      // Format compatible avec le frontend
      return {
        success: result.success,
        data: result.success ? {
          establishments: result.establishments,
          total: result.total,
          query: result.query
        } : undefined,
        _error: result.success ? undefined : result._error,
        message: result.success ? undefined : 'Search failed'
      };

    } catch (_error) {
      logger.error('Establishment search route failed', {
        operation: 'establishment_routes:search',
        _error: _error instanceof Error ? _error.message : String(_error),
        body,
        severity: 'medium' as const
      });

      set.status = 500;
      return {
        success: false,
        _error: 'Erreur interne lors de la recherche',
        message: 'Internal server _error during search'
      };
    }
  }, {
    body: t.Object({
      query: t.String({ minLength: 3, maxLength: 100 }),
      type: t.Optional(t.String()),
      department: t.Optional(t.String()),
      limit: t.Optional(t.Number({ minimum: 1, maximum: 50 }))
    })
  })

  /**
   * POST /api/establishments/search/geographic
   * Recherche géographique d'établissements
   */
  .post('/search/geographic', async ({ body, set }) => {
    try {
      const { latitude, longitude, radiusKm, type, limit } = body as {
        latitude?: number;
        longitude?: number;
        radiusKm?: number;
        type?: string;
        limit?: number;
      };

      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        set.status = 400;
        return {
          success: false,
          _error: 'Latitude et longitude sont requis',
          establishments: [],
          total: 0
        };
      }

      // Validation coordonnées France métropolitaine approximatives
      if (latitude < 41 || latitude > 51 || longitude < -5 || longitude > 10) {
        set.status = 400;
        return {
          success: false,
          _error: 'Coordonnées hors de France métropolitaine',
          establishments: [],
          total: 0
        };
      }

      const result = await establishmentService.searchNearbyEstablishments({
        latitude: latitude as number,
        longitude: longitude as number,
        radiusKm: radiusKm ?? 10,
        type: type as EstablishmentType | undefined,
        limit: limit ?? 10
      });

      return result;

    } catch (_error) {
      logger.error('Geographic establishment search route failed', {
        operation: 'establishment_routes:geo_search',
        _error: _error instanceof Error ? _error.message : String(_error),
        body,
        severity: 'medium' as const
      });

      set.status = 500;
      return {
        success: false,
        _error: 'Erreur interne lors de la recherche géographique',
        establishments: [],
        total: 0
      };
    }
  }, {
    body: t.Object({
      latitude: t.Number({ minimum: -90, maximum: 90 }),
      longitude: t.Number({ minimum: -180, maximum: 180 }),
      radiusKm: t.Optional(t.Number({ minimum: 0.1, maximum: 50 })),
      type: t.Optional(t.String()),
      limit: t.Optional(t.Number({ minimum: 1, maximum: 50 }))
    })
  })

  /**
   * GET /api/establishments/suggest
   * Auto-suggestions pour la recherche
   */
  .get('/suggest', async ({ query, set }) => {
    try {
      const searchQuery = query.query as string;
      const limit = parseInt(query.limit as string) ?? 5;

      if (!searchQuery || searchQuery.trim().length < 2) {
        return {
          success: true,
          suggestions: [],
          query: searchQuery || ''
        };
      }

      const suggestions = await establishmentService.getSearchSuggestions(
        searchQuery.trim(),
        Math.min(limit, 10)
      );

      return {
        success: true,
        suggestions,
        query: searchQuery
      };

    } catch (_error) {
      logger.error('Establishment suggestions route failed', {
        operation: 'establishment_routes:suggestions',
        _error: _error instanceof Error ? _error.message : String(_error),
        query,
        severity: 'medium' as const
      });

      set.status = 500;
      return {
        success: false,
        _error: 'Erreur lors de la génération des suggestions',
        suggestions: []
      };
    }
  }, {
    query: t.Object({
      query: t.String({ minLength: 2, maxLength: 50 }),
      limit: t.Optional(t.String())
    })
  })

  /**
   * POST /api/establishments/validate
   * Validation RNE et génération URL Pronote
   */
  .post('/validate', async ({ body, set }) => {
    try {
      const { rne } = body as { rne?: string };

      if (!rne || typeof rne !== 'string') {
        set.status = 400;
        return {
          success: false,
          _error: 'Code RNE requis'
        };
      }

      const result = await establishmentService.validateAndGeneratePronoteUrl(rne);

      if (!result.isValid) {
        set.status = 400;
        return {
          success: false,
          _error: result._error ?? 'RNE invalide'
        };
      }

      return {
        success: true,
        rne: rne.toUpperCase(),
        isValid: result.isValid,
        pronoteUrl: result.pronoteUrl,
        establishment: result.establishment
      };

    } catch (_error) {
      logger.error('RNE validation route failed', {
        operation: 'establishment_routes:validate',
        _error: _error instanceof Error ? _error.message : String(_error),
        body,
        severity: 'medium' as const
      });

      set.status = 500;
      return {
        success: false,
        _error: 'Erreur lors de la validation du RNE'
      };
    }
  }, {
    body: t.Object({
      rne: t.String({ minLength: 8, maxLength: 8, pattern: '^[0-9]{7}[A-Za-z]$' })
    })
  })

  /**
   * GET /api/establishments/stats
   * Statistiques du système d'établissements
   */
  .get('/stats', async ({ set }) => {
    try {
      const result = await establishmentService.getStats();

      if (!result.success) {
        set.status = 500;
        return {
          success: false,
          _error: result._error ?? 'Erreur lors de la récupération des statistiques'
        };
      }

      return {
        success: true,
        stats: result.stats
      };

    } catch (_error) {
      logger.error('Establishment stats route failed', {
        operation: 'establishment_routes:stats',
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });

      set.status = 500;
      return {
        success: false,
        _error: 'Erreur interne lors de la récupération des statistiques'
      };
    }
  })

  /**
   * POST /api/establishments/seed-test
   * DÉVELOPPEMENT UNIQUEMENT : Créer quelques établissements de test
   */
  .post('/seed-test', async ({ set }) => {
    try {
      const { establishmentRepository } = await import('../db/repositories/establishment.repository.js');
      
      const testEstablishments = [
        {
          rne: '0750655E',
          name: 'Lycée Louis-le-Grand',
          normalizedName: 'lycee louis le grand',
          type: 'lycee' as const,
          status: 'ouvert' as const,
          fullAddress: '123 rue Saint-Jacques 75005 Paris',
          city: 'Paris',
          postalCode: '75005',
          department: 'Paris',
          departmentCode: '75',
          academy: 'Paris',
          pronoteUrl: 'https://0750655e.index-education.net/pronote/eleve.html',
          hasPronote: true,
          searchTerms: 'lycee louis le grand paris 5eme',
          dataQuality: 95, // Score 0-100 (integer)
          sourceApi: 'test',
          isValidated: true
        },
        {
          rne: '0131923V',
          name: 'Collège Marseilleveyre',
          normalizedName: 'college marseilleveyre',
          type: 'college' as const,
          status: 'ouvert' as const,
          fullAddress: '83 traverse Parangon 13008 Marseille',
          city: 'Marseille',
          postalCode: '13008',
          department: 'Bouches-du-Rhône',
          departmentCode: '13',
          academy: 'Aix-Marseille',
          pronoteUrl: 'https://0131923v.index-education.net/pronote/eleve.html',
          hasPronote: true,
          searchTerms: 'college marseilleveyre marseille',
          dataQuality: 90, // Score 0-100 (integer)
          sourceApi: 'test',
          isValidated: true
        }
      ];

      const result = await establishmentRepository.upsertMicroBatch(testEstablishments);
      
      return {
        success: true,
        message: 'Test establishments created',
        result: {
          recordsProcessed: result.recordsProcessed,
          recordsInserted: result.recordsInserted,
          recordsUpdated: result.recordsUpdated
        }
      };

    } catch (_error) {
      logger.error('Seed test establishments failed', {
        operation: 'establishment_routes:seed_test',
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });

      set.status = 500;
      return {
        success: false,
        _error: 'Failed to seed test establishments',
        message: _error instanceof Error ? _error.message : 'Unknown _error'
      };
    }
  })

  /**
   * GET /api/establishments/health
   * Santé du service établissements
   */
  .get('/health', async () => {
    try {
      const stats = await establishmentService.getStats();

      return {
        success: true,
        service: 'establishment-search',
        status: stats.success ? 'operational' : 'degraded',
        version: '2.0.0-simplified',
        features: {
          textSearch: 'enabled',
          geographicSearch: 'enabled',
          autoSuggestions: 'enabled',
          rneValidation: 'enabled',
          statistics: 'enabled'
        },
        components: {
          database: stats.success ? 'connected' : '_error',
          repository: 'active',
          cache: 'local'
        },
        lastCheck: new Date().toISOString()
      };

    } catch (_error) {
      logger.error('Establishment health check failed', {
        operation: 'establishment_routes:health',
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });

      return {
        success: false,
        service: 'establishment-search',
        status: '_error',
        _error: 'Health check failed'
      };
    }
  })
;