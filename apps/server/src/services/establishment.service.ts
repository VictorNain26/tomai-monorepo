/**
 * Service Établissements - Version Simplifiée
 * Service principal pour la recherche d'établissements scolaires français
 */

import { establishmentRepository, type EstablishmentSearchQuery, type EstablishmentGeoSearchQuery } from '../db/repositories/establishment.repository.js';
import { logger } from '../lib/observability.js';
import type { EstablishmentType } from '../db/schema.js';

export interface EstablishmentSearchParams {
  query: string;
  type?: EstablishmentType;
  department?: string;
  limit?: number;
}

export interface EstablishmentGeoSearchParams {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  type?: EstablishmentType;
  limit?: number;
}

export interface EstablishmentValidationResult {
  isValid: boolean;
  establishment?: {
    rne: string;
    name: string;
    type: EstablishmentType;
    city: string;
    department: string;
  } | null;
  pronoteUrl?: string;
  _error?: string;
}

class EstablishmentService {
  
  /**
   * Recherche d'établissements par texte
   */
  async searchEstablishments(params: EstablishmentSearchParams) {
    try {
      logger.info('Searching establishments', {
        operation: 'establishment:search',
        query: params.query,
        type: params.type,
        department: params.department
      });

      const searchQuery: EstablishmentSearchQuery = {
        query: params.query,
        types: params.type ? [params.type] : undefined,
        departments: params.department ? [params.department] : undefined,
        statuses: ['ouvert'],
        limit: params.limit ?? 10,
        offset: 0
      };

      const result = await establishmentRepository.searchEstablishments(searchQuery);
      
      return {
        success: true,
        establishments: result.establishments,
        total: result.total,
        query: params.query
      };

    } catch (_error) {
      logger.error('Establishment search failed', {
        operation: 'establishment:search_error',
        _error: _error instanceof Error ? _error.message : String(_error),
        params,
        severity: 'medium' as const
      });

      return {
        success: false,
        _error: 'Erreur lors de la recherche d\'établissements',
        establishments: [],
        total: 0
      };
    }
  }

  /**
   * Recherche géographique d'établissements
   */
  async searchNearbyEstablishments(params: EstablishmentGeoSearchParams) {
    try {
      logger.info('Geographic establishment search', {
        operation: 'establishment:geo_search',
        coordinates: { lat: params.latitude, lng: params.longitude },
        radius: params.radiusKm ?? 10
      });

      const geoQuery: EstablishmentGeoSearchQuery = {
        latitude: params.latitude,
        longitude: params.longitude,
        radiusKm: params.radiusKm ?? 10,
        types: params.type ? [params.type] : undefined,
        limit: params.limit ?? 10
      };

      const establishments = await establishmentRepository.searchNearbyEstablishments(geoQuery);
      
      return {
        success: true,
        establishments,
        total: establishments.length,
        center: { latitude: params.latitude, longitude: params.longitude },
        radius: params.radiusKm ?? 10
      };

    } catch (_error) {
      logger.error('Geographic establishment search failed', {
        operation: 'establishment:geo_search_error',
        _error: _error instanceof Error ? _error.message : String(_error),
        params,
        severity: 'medium' as const
      });

      return {
        success: false,
        _error: 'Erreur lors de la recherche géographique',
        establishments: [],
        total: 0
      };
    }
  }

  /**
   * Suggestions de recherche
   */
  async getSearchSuggestions(query: string, limit: number = 5): Promise<string[]> {
    try {
      if (query.length < 2) return [];

      // Recherche limitée pour suggestions
      const searchQuery: EstablishmentSearchQuery = {
        query,
        statuses: ['ouvert'],
        limit: limit * 2, // Plus de résultats pour diversité
        offset: 0
      };

      const result = await establishmentRepository.searchEstablishments(searchQuery);
      
      // Extraire noms uniques pour suggestions
      const suggestions = new Set<string>();
      
      for (const est of result.establishments) {
        if (suggestions.size >= limit) break;
        
        // Ajouter le nom de l'établissement
        if (est.name && est.name.toLowerCase().includes(query.toLowerCase())) {
          suggestions.add(est.name);
        }
        
        // Ajouter la ville si différente
        if (est.city && est.city.toLowerCase().includes(query.toLowerCase())) {
          suggestions.add(est.city);
        }
      }

      return Array.from(suggestions).slice(0, limit);

    } catch (_error) {
      logger.warn('Search suggestions failed', {
        operation: 'establishment:suggestions_error',
        _error: _error instanceof Error ? _error.message : String(_error),
        query
      });
      
      return [];
    }
  }

  /**
   * Valider un code RNE et générer URL Pronote
   */
  async validateAndGeneratePronoteUrl(rne: string): Promise<EstablishmentValidationResult> {
    try {
      // Validation format RNE (7 chiffres + 1 lettre)
      const rnePattern = /^[0-9]{7}[A-Z]$/;
      if (!rnePattern.test(rne.toUpperCase())) {
        return {
          isValid: false,
          _error: 'Format RNE invalide (attendu: 7 chiffres + 1 lettre majuscule)'
        };
      }

      // Recherche en base
      const establishment = await establishmentRepository.findByRNE(rne.toUpperCase());
      
      if (establishment) {
        const pronoteUrl = `https://${rne.toLowerCase()}.index-education.net/pronote/eleve.html`;
        
        return {
          isValid: true,
          establishment: {
            rne: establishment.rne,
            name: establishment.name,
            type: establishment.type,
            city: establishment.city,
            department: establishment.department
          },
          pronoteUrl
        };
      }

      // RNE valide en format mais pas en base - générer URL quand même
      const pronoteUrl = `https://${rne.toLowerCase()}.index-education.net/pronote/eleve.html`;
      
      return {
        isValid: true,
        pronoteUrl,
        establishment: null
      };

    } catch (_error) {
      logger.error('RNE validation failed', {
        operation: 'establishment:rne_validation_error',
        _error: _error instanceof Error ? _error.message : String(_error),
        rne,
        severity: 'medium' as const
      });

      return {
        isValid: false,
        _error: 'Erreur lors de la validation du RNE'
      };
    }
  }

  /**
   * Statistiques du service
   */
  async getStats() {
    try {
      const stats = await establishmentRepository.getSyncStats();
      
      return {
        success: true,
        stats: {
          totalEstablishments: stats.totalEstablishments,
          lastSyncAt: stats.lastSyncAt,
          dataQualityAvg: Math.round(stats.dataQualityAvg * 100) / 100,
          typeDistribution: stats.typeDistribution
        }
      };

    } catch (_error) {
      logger.error('Failed to get establishment stats', {
        operation: 'establishment:stats_error',
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });

      return {
        success: false,
        _error: 'Erreur lors de la récupération des statistiques'
      };
    }
  }
}

export const establishmentService = new EstablishmentService();