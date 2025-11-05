/**
 * Service Pronote Simplifié - Focus sur l'authentification avec identifiants
 * Utilise l'endpoint /api/pronote-playwright/connect pour l'authentification Playwright
 */

import { apiClient, type ApiResponse } from '@/lib/api-client';

export interface PronoteAuthResponse {
  success: boolean;
  error?: string;
  userInfo?: {
    name: string;
    class?: string;
    establishment?: string;
    studentId?: string;
  };
  token?: string;
  canReconnect?: boolean;
  connectionId?: string;
  message?: string;
  duration?: number;
  phase: 'puppeteer_automation';
}

// Types pour les réponses API spécifiques à Pronote
interface PronoteApiUserInfo {
  name: string;
  class?: string;
  establishment?: string;
  studentId?: string;
}

interface PronoteApiAuthData {
  userInfo?: PronoteApiUserInfo;
  token?: string;
  canReconnect?: boolean;
  connectionId?: string;
  message?: string;
}

interface PronoteApiConnectionData {
  hasConnection: boolean;
  canReconnect: boolean;
  username?: string;
  establishmentUrl?: string;
}

class PronoteService {
  /**
   * Authentification avec identifiants via endpoint Playwright universel
   */
  async authenticateWithCredentials(request: {
    establishmentUrl: string;
    username: string;
    password: string;
    childId: string;
    parentId?: string;
  }): Promise<PronoteAuthResponse> {
    try {
      const response = await apiClient.post<ApiResponse<PronoteApiAuthData & { duration?: number }>>('/api/pronote-playwright/connect-universal', {
        establishmentUrl: request.establishmentUrl,
        username: request.username,
        password: request.password,
        childId: request.childId,
        parentId: request.parentId
      });

      const result: PronoteAuthResponse = {
        success: response.success,
        phase: 'puppeteer_automation'
      };

      if (response.error) result.error = response.error;
      if (response.data?.userInfo) result.userInfo = response.data.userInfo;
      if (response.data?.token) result.token = response.data.token;
      if (response.data?.canReconnect !== undefined) result.canReconnect = response.data.canReconnect;
      if (response.data?.connectionId) result.connectionId = response.data.connectionId;
      if (response.message) result.message = response.message;
      if (response.data?.duration !== undefined) result.duration = response.data.duration;

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur de connexion',
        phase: 'puppeteer_automation'
      };
    }
  }

  /**
   * Reconnexion automatique avec token stocké
   */
  async reconnectAutomatically(childId: string): Promise<PronoteAuthResponse> {
    try {
      const response = await apiClient.post<ApiResponse<PronoteApiAuthData>>('/api/pronote-playwright/reconnect', {
        childId
      });

      const result: PronoteAuthResponse = {
        success: response.success,
        phase: 'puppeteer_automation'
      };

      if (response.error) result.error = response.error;
      if (response.data?.userInfo) result.userInfo = response.data.userInfo;
      if (response.data?.token) result.token = response.data.token;
      if (response.data?.message) result.message = response.data.message;
      else if (response.message) result.message = response.message;

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur de reconnexion',
        phase: 'puppeteer_automation'
      };
    }
  }

  /**
   * Vérifier le statut de connexion d'un élève
   */
  async checkConnectionStatus(childId: string): Promise<{
    success: boolean;
    hasConnection: boolean;
    canReconnect: boolean;
    username?: string;
    establishmentUrl?: string;
    error?: string;
  }> {
    try {
      const response = await apiClient.get<ApiResponse<PronoteApiConnectionData>>(`/api/pronote-playwright/connection-status/${childId}`);

      const result = {
        success: response.success,
        hasConnection: response.data?.hasConnection ?? false,
        canReconnect: response.data?.canReconnect ?? false
      } as {
        success: boolean;
        hasConnection: boolean;
        canReconnect: boolean;
        username?: string;
        establishmentUrl?: string;
        error?: string;
      };

      if (response.data?.username) result.username = response.data.username;
      if (response.data?.establishmentUrl) result.establishmentUrl = response.data.establishmentUrl;
      if (response.error) result.error = response.error;

      return result;
    } catch (error) {
      return {
        success: false,
        hasConnection: false,
        canReconnect: false,
        error: error instanceof Error ? error.message : 'Erreur de vérification'
      };
    }
  }
}

export const pronoteService = new PronoteService();

