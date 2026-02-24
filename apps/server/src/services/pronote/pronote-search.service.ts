/**
 * Pronote Search Service - School geolocation search with cache
 */

import { logger } from '../../lib/observability.js';
import { cacheService } from '../memory-cache.service.js';
import {
  PRONOTE_USER_AGENT,
  PRONOTE_CACHE,
  type IndexEducationSchool,
  type PronoteSchoolResult,
} from './pronote-shared.js';

// =============================================
// SERVICE CLASS
// =============================================

class PronoteSearchService {
  /**
   * Recherche des établissements Pronote par géolocalisation (cache 24h)
   * Arrondi coords à 3 décimales pour clé cache stable (~111m de précision)
   */
  async searchSchoolsByLocation(
    latitude: number,
    longitude: number
  ): Promise<PronoteSchoolResult[]> {
    const roundedLat = Math.round(latitude * 1000) / 1000;
    const roundedLon = Math.round(longitude * 1000) / 1000;
    const cacheKey = `schools:${roundedLat}:${roundedLon}`;

    const cached = cacheService.get<PronoteSchoolResult[]>(PRONOTE_CACHE.PREFIX, cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch('https://www.index-education.com/swie/geoloc.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': PRONOTE_USER_AGENT,
        },
        body: `data=${JSON.stringify({
          nomFonction: 'geoLoc',
          lat: String(latitude),
          long: String(longitude),
        })}`,
      });

      const text = await response.text();

      if (text === '{}' || !text.trim()) {
        return [];
      }

      const data = JSON.parse(text) as IndexEducationSchool[];

      if (!Array.isArray(data)) {
        return [];
      }

      const results = data
        .map((school) => ({
          name: school.nomEtab,
          url: school.url,
          postalCode: school.cp,
          distance: haversineDistance(
            latitude,
            longitude,
            parseFloat(school.lat),
            parseFloat(school.long)
          ),
        }))
        .sort((a, b) => a.distance - b.distance);

      cacheService.set(PRONOTE_CACHE.PREFIX, cacheKey, results, PRONOTE_CACHE.TTL.SCHOOLS);

      return results;
    } catch (error) {
      logger.error('Index Education geolocation API error', {
        operation: 'pronote:search:geoloc-error',
        latitude,
        longitude,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      return [];
    }
  }
}

// =============================================
// HAVERSINE
// =============================================

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export const pronoteSearchService = new PronoteSearchService();
