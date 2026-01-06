/**
 * Service Gemini Files API - Stockage fichiers persistant (TTL 48h)
 *
 * Architecture 2025:
 * - Upload fichiers vers Gemini Files API (gratuit, TTL 48h)
 * - Retourne URI utilisable dans les messages multimodaux
 * - Polling état PROCESSING → ACTIVE
 * - Utilisé pour images/PDFs dans conversations multi-tours
 */

import { GoogleGenAI } from '@google/genai';
import { appConfig } from '../config/app.config.js';
import { logger } from '../lib/observability.js';

/** Résultat d'upload vers Gemini Files API */
export interface GeminiFileUploadResult {
  success: boolean;
  /** URI du fichier pour utilisation dans generateContent */
  fileUri?: string;
  /** Nom unique du fichier (pour suppression) */
  fileName?: string;
  /** MIME type du fichier */
  mimeType?: string;
  /** Date d'expiration (48h après upload) */
  expiresAt?: Date;
  /** Message d'erreur si échec */
  error?: string;
}

/** États possibles d'un fichier Gemini */
type GeminiFileState = 'PROCESSING' | 'ACTIVE' | 'FAILED';

/**
 * Service de gestion des fichiers via Gemini Files API
 */
class GeminiFilesService {
  private client: GoogleGenAI | null = null;
  private readonly MAX_POLLING_ATTEMPTS = 10;
  private readonly POLLING_INTERVAL_MS = 2000;

  constructor() {
    this.initializeClient();
  }

  /**
   * Initialise le client Gemini Files API
   */
  private initializeClient(): void {
    const apiKey = appConfig.ai.gemini.apiKey;
    if (!apiKey) {
      logger.warn('Gemini API key not configured - Files API disabled', {
        operation: 'gemini-files:init'
      });
      return;
    }

    this.client = new GoogleGenAI({ apiKey });
    logger.info('Gemini Files API client initialized', {
      operation: 'gemini-files:init'
    });
  }

  /**
   * Vérifie si le service est disponible
   */
  isAvailable(): boolean {
    return this.client !== null;
  }

  /**
   * Upload un fichier vers Gemini Files API
   *
   * @param buffer - Contenu du fichier (ArrayBuffer)
   * @param mimeType - Type MIME du fichier
   * @param displayName - Nom d'affichage du fichier
   * @returns Résultat avec URI utilisable dans les messages
   */
  async uploadFile(
    buffer: ArrayBuffer,
    mimeType: string,
    displayName: string
  ): Promise<GeminiFileUploadResult> {
    if (!this.client) {
      return {
        success: false,
        error: 'Gemini Files API not configured'
      };
    }

    const startTime = Date.now();

    try {
      // Créer un Blob depuis le buffer
      const blob = new Blob([buffer], { type: mimeType });

      logger.info('Uploading file to Gemini Files API', {
        displayName,
        mimeType,
        sizeBytes: buffer.byteLength,
        operation: 'gemini-files:upload-start'
      });

      // Upload vers Gemini Files API
      const uploadResult = await this.client.files.upload({
        file: blob,
        config: {
          displayName,
          mimeType
        }
      });

      if (!uploadResult.name) {
        throw new Error('Upload returned no file name');
      }

      // Attendre que le fichier soit prêt (polling)
      const file = await this.waitForProcessing(uploadResult.name);

      if (!file.uri) {
        throw new Error('File processing completed but no URI returned');
      }

      // Calculer l'expiration (48h)
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

      logger.info('File uploaded to Gemini Files API successfully', {
        fileName: file.name,
        fileUri: file.uri,
        mimeType: file.mimeType,
        expiresAt: expiresAt.toISOString(),
        durationMs: Date.now() - startTime,
        operation: 'gemini-files:upload-complete'
      });

      return {
        success: true,
        fileUri: file.uri,
        fileName: file.name ?? undefined,
        mimeType: file.mimeType ?? mimeType,
        expiresAt
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Failed to upload file to Gemini Files API', {
        _error: errorMessage,
        displayName,
        mimeType,
        sizeBytes: buffer.byteLength,
        durationMs: Date.now() - startTime,
        operation: 'gemini-files:upload-error',
        severity: 'high' as const
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Attend que le fichier soit traité (état ACTIVE)
   */
  private async waitForProcessing(fileName: string): Promise<{
    name?: string | null;
    uri?: string | null;
    mimeType?: string | null;
    state?: string | null;
  }> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    for (let attempt = 0; attempt < this.MAX_POLLING_ATTEMPTS; attempt++) {
      const file = await this.client.files.get({ name: fileName });
      const state = file.state as GeminiFileState | null;

      if (state === 'ACTIVE') {
        return file;
      }

      if (state === 'FAILED') {
        throw new Error(`File processing failed for ${fileName}`);
      }

      // Encore en PROCESSING, attendre
      logger.debug('File still processing, waiting...', {
        fileName,
        state,
        attempt: attempt + 1,
        maxAttempts: this.MAX_POLLING_ATTEMPTS,
        operation: 'gemini-files:polling'
      });

      await this.sleep(this.POLLING_INTERVAL_MS);
    }

    throw new Error(`File processing timeout for ${fileName}`);
  }

  /**
   * Supprime un fichier de Gemini Files API
   */
  async deleteFile(fileName: string): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      await this.client.files.delete({ name: fileName });

      logger.info('File deleted from Gemini Files API', {
        fileName,
        operation: 'gemini-files:delete'
      });

      return true;

    } catch (error) {
      logger.warn('Failed to delete file from Gemini Files API', {
        error: error instanceof Error ? error.message : String(error),
        fileName,
        operation: 'gemini-files:delete-error'
      });

      return false;
    }
  }

  /**
   * Récupère les informations d'un fichier
   */
  async getFile(fileName: string): Promise<{
    exists: boolean;
    uri?: string;
    mimeType?: string;
    state?: string;
  }> {
    if (!this.client) {
      return { exists: false };
    }

    try {
      const file = await this.client.files.get({ name: fileName });

      return {
        exists: true,
        uri: file.uri ?? undefined,
        mimeType: file.mimeType ?? undefined,
        state: file.state ?? undefined
      };

    } catch {
      return { exists: false };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Instance singleton
export const geminiFilesService = new GeminiFilesService();
