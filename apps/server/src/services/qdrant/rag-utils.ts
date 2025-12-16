/**
 * RAG Utilities - Fonctions utilitaires pour le RAG
 */

import { appConfig } from '../../config/app.config.js';
import { QDRANT_CONFIG } from './config.js';

/**
 * Vérifie si le RAG Qdrant est disponible et configuré
 */
export function isQdrantRAGEnabled(): boolean {
  return (
    appConfig.qdrant.enabled &&
    QDRANT_CONFIG.connection.url.length > 0 &&
    QDRANT_CONFIG.connection.apiKey.length > 0
  );
}
