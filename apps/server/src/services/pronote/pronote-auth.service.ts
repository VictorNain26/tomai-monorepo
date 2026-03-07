/**
 * Pronote Auth Service - Authentication, sessions, mappings
 *
 * Handles QR code login, token refresh, session pooling,
 * child mappings, and connection status.
 */

import {
  createSessionHandle,
  loginQrCode,
  loginToken,
  use,
  AccountKind,
  type SessionHandle,
  type RefreshInformation,
} from 'pawnote';
import { db } from '../../db/connection.js';
import {
  pronoteConnections,
  pronoteChildMappings,
  user,
} from '../../db/schema.js';
import type { PronoteResource } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { encrypt, decrypt } from '../../lib/encryption.js';
import { logger } from '../../lib/observability.js';
import { cacheService } from '../memory-cache.service.js';
import {
  TOKEN_EXPIRY_MS,
  TOKEN_REFRESH_BUFFER_MS,
  SESSION_POOL_TTL_MS,
  PRONOTE_CACHE,
  isAllowedPronoteUrl,
  pronoteFetcher,
  type QrCodeData,
  type PronoteConnectionResult,
  type ChildMappingInput,
  type SessionPoolEntry,
} from './pronote-shared.js';

// =============================================
// SESSION POOL
// =============================================

const sessionPool = new Map<string, SessionPoolEntry>();

function getPooledSession(connectionId: string): SessionHandle | null {
  const entry = sessionPool.get(connectionId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    sessionPool.delete(connectionId);
    return null;
  }
  return entry.session;
}

function setPooledSession(connectionId: string, session: SessionHandle): void {
  sessionPool.set(connectionId, {
    session,
    expiresAt: Date.now() + SESSION_POOL_TTL_MS,
  });
}

// =============================================
// SERVICE CLASS
// =============================================

class PronoteAuthService {
  /**
   * Connecte un PARENT à Pronote via QR Code
   */
  async connectParentWithQrCode(
    parentId: string,
    establishmentName: string,
    qrCodeJson: string,
    pin: string
  ): Promise<PronoteConnectionResult> {
    try {
      if (!establishmentName?.trim()) {
        return { success: false, error: "Nom de l'établissement requis" };
      }

      const parentUser = await db.query.user.findFirst({
        where: eq(user.id, parentId),
      });

      if (!parentUser || parentUser.role !== 'parent') {
        return { success: false, error: 'Seuls les parents peuvent connecter Pronote' };
      }

      let qrData: QrCodeData;
      try {
        qrData = JSON.parse(qrCodeJson);
        if (!qrData.jeton || !qrData.login || !qrData.url) {
          return { success: false, error: 'QR code invalide: données manquantes' };
        }
      } catch {
        return { success: false, error: 'QR code invalide: format JSON incorrect' };
      }

      if (!isAllowedPronoteUrl(qrData.url)) {
        logger.warn('Pronote SSRF attempt blocked', {
          operation: 'pronote:connect:ssrf-blocked',
          parentId,
          establishmentName,
          blockedUrl: qrData.url.substring(0, 100),
        });
        return { success: false, error: 'URL Pronote non autorisée' };
      }

      if (!/^\d{4}$/.test(pin)) {
        return { success: false, error: 'Code PIN invalide (4 chiffres requis)' };
      }

      const deviceUuid = crypto.randomUUID();
      const session = createSessionHandle(pronoteFetcher);
      let refreshInfo: RefreshInformation;

      try {
        refreshInfo = await loginQrCode(session, {
          deviceUUID: deviceUuid,
          pin,
          qr: qrData,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
        logger.warn('Pronote QR auth failed', {
          operation: 'pronote:connect:auth-failed',
          parentId,
          establishmentName,
          error: errorMessage,
        });

        if (errorMessage.includes('BadCredentials')) {
          return { success: false, error: 'Code PIN incorrect' };
        }
        if (errorMessage.includes('SessionExpired')) {
          return { success: false, error: 'QR code expiré, veuillez en scanner un nouveau' };
        }
        if (
          errorMessage.includes('Unable to connect') ||
          errorMessage.includes('ECONNREFUSED') ||
          errorMessage.includes('ETIMEDOUT')
        ) {
          return {
            success: false,
            error:
              'Impossible de contacter le serveur Pronote de cet établissement. ' +
              'Le serveur peut être temporairement indisponible ou bloquer les connexions externes. ' +
              "Réessayez plus tard ou contactez l'établissement.",
          };
        }
        return { success: false, error: 'Échec de connexion Pronote' };
      }

      if (refreshInfo.kind !== AccountKind.PARENT) {
        return {
          success: false,
          error: 'Veuillez scanner le QR code de votre espace PARENT Pronote',
        };
      }

      const resources: PronoteResource[] = session.user.resources.map((r, index) => ({
        name: r.name,
        id: r.id || `resource_${index}`,
        className: r.className,
      }));

      if (resources.length === 0) {
        return { success: false, error: 'Aucun enfant trouvé sur ce compte Pronote' };
      }

      const encryptedToken = await encrypt(refreshInfo.token);
      const tokenExpiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

      const existingConnection = await db.query.pronoteConnections.findFirst({
        where: eq(pronoteConnections.parentId, parentId),
      });

      if (existingConnection) {
        await db
          .delete(pronoteChildMappings)
          .where(eq(pronoteChildMappings.connectionId, existingConnection.id));
        await db.delete(pronoteConnections).where(eq(pronoteConnections.parentId, parentId));
      }

      await db.insert(pronoteConnections).values({
        parentId,
        establishmentName: establishmentName.trim(),
        encryptedToken,
        instanceUrl: refreshInfo.url,
        pronoteUsername: refreshInfo.username,
        deviceUuid,
        accountKind: AccountKind.PARENT,
        pronoteResources: resources,
        status: 'active',
        tokenExpiresAt,
        lastRefreshAt: new Date(),
      });

      logger.info('Pronote parent connection successful', {
        operation: 'pronote:connect:success',
        parentId,
        establishmentName,
        username: refreshInfo.username,
        childrenCount: resources.length,
      });

      return {
        success: true,
        establishmentName: establishmentName.trim(),
        resources,
      };
    } catch (error) {
      logger.error('Pronote connection error', {
        operation: 'pronote:connect:error',
        parentId,
        establishmentName,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'high' as const,
      });
      return { success: false, error: 'Erreur interne lors de la connexion' };
    }
  }

  /**
   * Crée les mappings entre enfants Pronote et enfants TomAI
   */
  async createChildMappings(
    parentId: string,
    mappings: ChildMappingInput[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const connection = await db.query.pronoteConnections.findFirst({
        where: eq(pronoteConnections.parentId, parentId),
      });

      if (!connection) {
        return { success: false, error: 'Connexion Pronote non trouvée' };
      }

      await db
        .delete(pronoteChildMappings)
        .where(eq(pronoteChildMappings.connectionId, connection.id));

      for (const mapping of mappings) {
        const child = await db.query.user.findFirst({
          where: and(eq(user.id, mapping.childId), eq(user.parentId, parentId)),
        });

        if (!child) {
          logger.warn('Invalid child mapping attempt', {
            parentId,
            childId: mapping.childId,
          });
          continue;
        }

        await db.insert(pronoteChildMappings).values({
          connectionId: connection.id,
          childId: mapping.childId,
          resourceIndex: mapping.resourceIndex,
          pronoteChildName: mapping.pronoteChildName,
          pronoteClassName: mapping.pronoteClassName,
        });
      }

      logger.info('Child mappings created', {
        operation: 'pronote:mappings:created',
        parentId,
        mappingsCount: mappings.length,
      });

      return { success: true };
    } catch (error) {
      logger.error('Create child mappings error', {
        operation: 'pronote:mappings:error',
        parentId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      return { success: false, error: 'Erreur lors de la création des mappings' };
    }
  }

  /**
   * Déconnecte un parent de Pronote + invalidation cache
   */
  async disconnectParent(parentId: string): Promise<boolean> {
    try {
      const connection = await db.query.pronoteConnections.findFirst({
        where: eq(pronoteConnections.parentId, parentId),
        with: { childMappings: true },
      });

      if (connection) {
        // Invalidate cache for all children
        for (const mapping of connection.childMappings ?? []) {
          this.invalidateChildCache(mapping.childId);
        }

        // Remove pool entry
        sessionPool.delete(connection.id);

        await db
          .delete(pronoteChildMappings)
          .where(eq(pronoteChildMappings.connectionId, connection.id));
      }

      await db.delete(pronoteConnections).where(eq(pronoteConnections.parentId, parentId));

      logger.info('Pronote parent disconnected', {
        operation: 'pronote:disconnect',
        parentId,
      });

      return true;
    } catch (error) {
      logger.error('Pronote disconnect error', {
        operation: 'pronote:disconnect:error',
        parentId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      return false;
    }
  }

  /**
   * Obtient une session Pronote active pour le parent
   */
  async getActiveParentSession(parentId: string): Promise<SessionHandle | null> {
    const connection = await db.query.pronoteConnections.findFirst({
      where: eq(pronoteConnections.parentId, parentId),
    });

    if (!connection || connection.status !== 'active') {
      return null;
    }

    return this.createSessionFromConnection(connection);
  }

  /**
   * Obtient une session Pronote pour un enfant spécifique (via son mapping)
   */
  async getActiveSessionForChild(
    childId: string
  ): Promise<{ session: SessionHandle; resourceIndex: number } | null> {
    const mapping = await db.query.pronoteChildMappings.findFirst({
      where: eq(pronoteChildMappings.childId, childId),
      with: { connection: true },
    });

    if (!mapping || !mapping.connection || mapping.connection.status !== 'active') {
      return null;
    }

    const session = await this.createSessionFromConnection(mapping.connection);
    if (!session) return null;

    use(session, mapping.resourceIndex);

    return { session, resourceIndex: mapping.resourceIndex };
  }

  /**
   * Vérifie le statut de connexion d'un parent
   */
  async getParentConnectionStatus(parentId: string): Promise<{
    connected: boolean;
    status?: string;
    establishmentName?: string;
    resources?: PronoteResource[];
    lastSyncAt?: Date;
    error?: string;
  }> {
    const connection = await db.query.pronoteConnections.findFirst({
      where: eq(pronoteConnections.parentId, parentId),
      with: { childMappings: true },
    });

    if (!connection) {
      return { connected: false };
    }

    return {
      connected: connection.status === 'active',
      status: connection.status,
      establishmentName: connection.establishmentName,
      resources: (connection.pronoteResources as PronoteResource[]) ?? [],
      lastSyncAt: connection.lastSyncAt ?? undefined,
      error: connection.lastError ?? undefined,
    };
  }

  /**
   * Vérifie si un enfant a un mapping Pronote actif
   */
  async getChildPronoteStatus(childId: string): Promise<{
    isConnected: boolean;
    establishmentName?: string;
    pronoteChildName?: string;
    className?: string;
  }> {
    const mapping = await db.query.pronoteChildMappings.findFirst({
      where: eq(pronoteChildMappings.childId, childId),
      with: { connection: true },
    });

    if (!mapping || !mapping.connection || mapping.connection.status !== 'active') {
      return { isConnected: false };
    }

    return {
      isConnected: true,
      establishmentName: mapping.connection.establishmentName,
      pronoteChildName: mapping.pronoteChildName,
      className: mapping.pronoteClassName ?? undefined,
    };
  }

  /**
   * Récupère les mappings d'un parent
   */
  async getChildMappings(parentId: string): Promise<
    Array<{
      childId: string;
      childName: string;
      resourceIndex: number;
      pronoteChildName: string;
      pronoteClassName?: string;
    }>
  > {
    const connection = await db.query.pronoteConnections.findFirst({
      where: eq(pronoteConnections.parentId, parentId),
      with: {
        childMappings: {
          with: { child: true },
        },
      },
    });

    if (!connection) return [];

    return (connection.childMappings ?? []).map((m) => ({
      childId: m.childId,
      childName: m.child ? `${m.child.firstName} ${m.child.lastName}` : 'Inconnu',
      resourceIndex: m.resourceIndex,
      pronoteChildName: m.pronoteChildName,
      pronoteClassName: m.pronoteClassName ?? undefined,
    }));
  }

  /**
   * Invalidate all cache entries for a child
   */
  invalidateChildCache(childId: string): void {
    cacheService.invalidateByPattern(`${PRONOTE_CACHE.PREFIX}homework:${childId}`);
    cacheService.invalidateByPattern(`${PRONOTE_CACHE.PREFIX}grades:${childId}`);
    cacheService.invalidateByPattern(`${PRONOTE_CACHE.PREFIX}timetable:${childId}`);
  }

  // =============================================
  // PRIVATE
  // =============================================

  /**
   * Crée une session Pawnote à partir d'une connexion DB.
   * Utilise session pool pour éviter re-auth inutile.
   */
  private async createSessionFromConnection(
    connection: typeof pronoteConnections.$inferSelect
  ): Promise<SessionHandle | null> {
    // Check pool first
    const pooled = getPooledSession(connection.id);
    if (pooled) return pooled;

    const now = new Date();
    const shouldRefresh =
      connection.tokenExpiresAt.getTime() - now.getTime() < TOKEN_REFRESH_BUFFER_MS;

    let token: string;
    try {
      token = await decrypt(connection.encryptedToken);
    } catch (error) {
      logger.error('Pronote token decryption failed', {
        operation: 'pronote:decrypt:error',
        connectionId: connection.id,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'high' as const,
      });
      await db
        .update(pronoteConnections)
        .set({ status: 'error', lastError: 'Token déchiffrement échoué' })
        .where(eq(pronoteConnections.id, connection.id));
      return null;
    }

    const session = createSessionHandle(pronoteFetcher);

    try {
      if (shouldRefresh) {
        const refreshInfo = await loginToken(session, {
          url: connection.instanceUrl,
          kind: connection.accountKind as AccountKind,
          username: connection.pronoteUsername,
          token,
          deviceUUID: connection.deviceUuid,
        });

        const newEncryptedToken = await encrypt(refreshInfo.token);
        const newExpiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

        await db
          .update(pronoteConnections)
          .set({
            encryptedToken: newEncryptedToken,
            tokenExpiresAt: newExpiresAt,
            lastRefreshAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(pronoteConnections.id, connection.id));

        logger.debug('Pronote token refreshed', {
          operation: 'pronote:refresh',
          connectionId: connection.id,
        });
      } else {
        await loginToken(session, {
          url: connection.instanceUrl,
          kind: connection.accountKind as AccountKind,
          username: connection.pronoteUsername,
          token,
          deviceUUID: connection.deviceUuid,
        });
      }

      // Pool the session
      setPooledSession(connection.id, session);

      return session;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await db
        .update(pronoteConnections)
        .set({
          status: 'expired',
          lastError: errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(pronoteConnections.id, connection.id));

      logger.warn('Pronote session expired', {
        operation: 'pronote:session:expired',
        connectionId: connection.id,
        error: errorMessage,
      });

      return null;
    }
  }
}

export const pronoteAuthService = new PronoteAuthService();
