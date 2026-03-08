import { Elysia, t } from 'elysia';
import { pronoteService } from '../../services/pronote.service.js';
import {
  createRateLimitMiddleware,
  RateLimitPresets,
} from '../../middleware/rate-limit.middleware.js';

export const pronotePublicRoutes = new Elysia({ prefix: '/api/pronote' })
  .post(
    '/schools/search',
    async ({ body, set }) => {
      const { latitude, longitude } = body;

      if (latitude < 41 || latitude > 51 || longitude < -5 || longitude > 10) {
        set.status = 400;
        return {
          success: false,
          error: 'Coordonnées hors de France métropolitaine',
          schools: [],
        };
      }

      const schools = await pronoteService.searchSchoolsByLocation(latitude, longitude);

      return {
        success: true,
        schools,
        count: schools.length,
      };
    },
    {
      beforeHandle: createRateLimitMiddleware(RateLimitPresets.public),
      body: t.Object({
        latitude: t.Number({ minimum: -90, maximum: 90, description: 'Latitude GPS' }),
        longitude: t.Number({ minimum: -180, maximum: 180, description: 'Longitude GPS' }),
      }),
      detail: {
        tags: ['Pronote'],
        summary: 'Search schools by location',
        description: 'Search for Pronote-enabled schools near GPS coordinates. Rate limited.',
      },
    }
  );
