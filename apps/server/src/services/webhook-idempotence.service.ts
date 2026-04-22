/**
 * Webhook Idempotence Service - PostgreSQL
 *
 * Déduplication des webhooks RevenueCat (source unique de facturation).
 * Stocke les event IDs en base pour éviter le double-traitement.
 */

import { db } from '../db/connection.js';
import { webhookEvents, type WebhookSource } from '../db/schema.js';
import { eq, lt } from 'drizzle-orm';
import { logger } from '../lib/observability.js';

// =============================================
// Configuration
// =============================================

const CONFIG = {
  EVENT_TTL_DAYS: 7, // Durée de rétention des événements
  CLEANUP_BATCH_SIZE: 1000, // Nombre d'événements à supprimer par batch
};

// =============================================
// Webhook Idempotence Service
// =============================================

class WebhookIdempotenceService {
  /**
   * Vérifie si un événement a déjà été traité
   */
  async isProcessed(eventId: string): Promise<boolean> {
    try {
      const existing = await db
        .select({ id: webhookEvents.id })
        .from(webhookEvents)
        .where(eq(webhookEvents.eventId, eventId))
        .limit(1);

      return existing.length > 0;
    } catch (error) {
      logger.error('Failed to check webhook idempotence', {
        operation: 'webhook:idempotence:check',
        eventId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'high' as const,
      });
      // En cas d'erreur, on autorise le traitement (fail-open)
      return false;
    }
  }

  /**
   * Marque un événement comme traité
   */
  async markProcessed(
    eventId: string,
    source: WebhookSource,
    eventType: string
  ): Promise<boolean> {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + CONFIG.EVENT_TTL_DAYS);

      await db.insert(webhookEvents).values({
        eventId,
        source,
        eventType,
        expiresAt,
      });

      logger.debug('Webhook event marked as processed', {
        operation: 'webhook:idempotence:mark',
        eventId,
        source,
        eventType,
      });

      return true;
    } catch (error) {
      // Ignore duplicate key errors (event already processed)
      if (error instanceof Error && error.message.includes('duplicate key')) {
        logger.debug('Webhook event already marked (duplicate)', {
          operation: 'webhook:idempotence:duplicate',
          eventId,
        });
        return false;
      }

      logger.error('Failed to mark webhook as processed', {
        operation: 'webhook:idempotence:mark',
        eventId,
        source,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      return false;
    }
  }

  /**
   * Nettoie les événements expirés (à appeler périodiquement ou via cron)
   */
  async cleanupExpired(): Promise<number> {
    try {
      const now = new Date();

      const result = await db
        .delete(webhookEvents)
        .where(lt(webhookEvents.expiresAt, now));

      const deleted = (result as unknown as { rowCount?: number })?.rowCount ?? 0;

      if (deleted > 0) {
        logger.info('Cleaned up expired webhook events', {
          operation: 'webhook:idempotence:cleanup',
          deleted,
        });
      }

      return deleted;
    } catch (error) {
      logger.error('Failed to cleanup expired webhook events', {
        operation: 'webhook:idempotence:cleanup',
        _error: error instanceof Error ? error.message : String(error),
        severity: 'low' as const,
      });
      return 0;
    }
  }
}

// =============================================
// Singleton Export
// =============================================

export const webhookIdempotenceService = new WebhookIdempotenceService();

// =============================================
// Helper Functions
// =============================================

/**
 * Vérifie si événement RevenueCat déjà traité
 */
export async function isRevenueCatEventProcessed(eventId: string): Promise<boolean> {
  return webhookIdempotenceService.isProcessed(eventId);
}

/**
 * Marque événement RevenueCat comme traité
 */
export async function markRevenueCatEventProcessed(eventId: string, eventType: string): Promise<void> {
  await webhookIdempotenceService.markProcessed(eventId, 'revenuecat', eventType);
}
