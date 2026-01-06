/**
 * Pronote Service - Parent Account Integration
 *
 * Architecture: Un compte parent Pronote par famille TomAI.
 * Le parent se connecte UNE FOIS, puis peut mapper ses enfants Pronote
 * aux comptes TomAI de ses enfants.
 *
 * Flow:
 * 1. Parent scan QR code avec PIN → connexion parent
 * 2. On récupère session.user.resources[] (liste des enfants Pronote)
 * 3. Parent mappe chaque enfant Pronote → enfant TomAI
 * 4. Étudiant accède à SES données via le mapping
 */

import {
  createSessionHandle,
  loginQrCode,
  loginToken,
  assignmentsFromIntervals,
  gradesOverview,
  timetableFromIntervals,
  AccountKind,
  use,
  type SessionHandle,
  type RefreshInformation,
  type Assignment,
} from 'pawnote';
import type { Fetcher } from '@literate.ink/utilities';
import { db } from '../db/connection.js';
import {
  pronoteConnections,
  pronoteChildMappings,
  user,
  type PronoteResource,
} from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { encrypt, decrypt } from '../lib/encryption.js';
import { logger } from '../lib/observability.js';

// =============================================
// CONSTANTS
// =============================================

/**
 * User-Agent requis pour Pronote Mobile
 * Source: Papillon app (github.com/PapillonApp/Papillon)
 */
const PRONOTE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ' +
  'PRONOTE Mobile APP Version/2.0.11';

/** Token expires in 5 minutes, refresh 30 seconds before */
const TOKEN_EXPIRY_MS = 5 * 60 * 1000;
const TOKEN_REFRESH_BUFFER_MS = 30 * 1000;

/**
 * SECURITY: Pronote URL allowlist - SSRF Protection
 * Only official Pronote domains are allowed
 */
const PRONOTE_ALLOWED_DOMAINS = [
  'index-education.net',
  'pronote.toutatice.fr',
  'mon.lyceeconnecte.fr',
  'ent.iledefrance.fr',
  'enthdf.fr',
  'monbureaunumerique.fr',
  'e-lyco.fr',
  'l-educdenormandie.fr',
  'laclasse.com',
];

function isAllowedPronoteUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return false;
    }
    const hostname = url.hostname.toLowerCase();
    return PRONOTE_ALLOWED_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

// =============================================
// TYPES
// =============================================

export interface QrCodeData {
  jeton: string;
  login: string;
  url: string;
}

export interface PronoteConnectionResult {
  success: boolean;
  error?: string;
  establishmentName?: string;
  resources?: PronoteResource[];
}

// Types pour API Index Education (recherche d'établissements)
export interface IndexEducationSchool {
  url: string;
  nomEtab: string;
  lat: string;
  long: string;
  cp: string;
}

export interface PronoteSchoolResult {
  name: string;
  url: string;
  distance: number;
  postalCode: string;
}

export interface PronoteHomework {
  id: string;
  subject: string;
  description: string;
  dueDate: Date;
  done: boolean;
  difficulty: number;
  estimatedMinutes?: number;
}

export interface PronoteGrade {
  id: string;
  subject: string;
  value: number | null;
  outOf: number;
  coefficient: number;
  date: Date;
  description: string;
  average?: number;
  max?: number;
  min?: number;
}

export interface PronoteTimetableEntry {
  id: string;
  subject?: string;
  teacherNames: string[];
  classrooms: string[];
  startDate: Date;
  endDate: Date;
  canceled: boolean;
  status?: string;
}

export interface ChildMappingInput {
  childId: string;
  resourceIndex: number;
  pronoteChildName: string;
  pronoteClassName?: string;
}

// =============================================
// CUSTOM FETCHER
// =============================================

const pronoteFetcher: Fetcher = async (options) => {
  const response = await fetch(options.url, {
    method: options.method,
    headers: {
      ...options.headers,
      'User-Agent': PRONOTE_USER_AGENT,
    },
    body: options.method !== 'GET' ? options.content : undefined,
    redirect: options.redirect,
  });

  return {
    content: await response.text(),
    status: response.status,
    headers: response.headers,
  };
};

// =============================================
// SERVICE CLASS
// =============================================

class PronoteService {
  /**
   * Connecte un PARENT à Pronote via QR Code
   * Retourne la liste des enfants disponibles pour le mapping
   *
   * @param parentId - ID du parent TomAI
   * @param establishmentName - Nom de l'établissement (affiché, pas de validation)
   * @param qrCodeJson - JSON du QR code Pronote
   * @param pin - Code PIN 4 chiffres
   */
  async connectParentWithQrCode(
    parentId: string,
    establishmentName: string,
    qrCodeJson: string,
    pin: string
  ): Promise<PronoteConnectionResult> {
    try {
      // 1. Valider le nom de l'établissement (juste présent)
      if (!establishmentName?.trim()) {
        return { success: false, error: "Nom de l'établissement requis" };
      }

      // 2. Valider que c'est bien un parent
      const parentUser = await db.query.user.findFirst({
        where: eq(user.id, parentId),
      });

      if (!parentUser || parentUser.role !== 'parent') {
        return { success: false, error: 'Seuls les parents peuvent connecter Pronote' };
      }

      // 3. Parser le QR code
      let qrData: QrCodeData;
      try {
        qrData = JSON.parse(qrCodeJson);
        if (!qrData.jeton || !qrData.login || !qrData.url) {
          return { success: false, error: 'QR code invalide: données manquantes' };
        }
      } catch {
        return { success: false, error: 'QR code invalide: format JSON incorrect' };
      }

      // 4. SECURITY: SSRF protection
      if (!isAllowedPronoteUrl(qrData.url)) {
        logger.warn('Pronote SSRF attempt blocked', {
          operation: 'pronote:connect:ssrf-blocked',
          parentId,
          establishmentName,
          blockedUrl: qrData.url.substring(0, 100),
        });
        return { success: false, error: 'URL Pronote non autorisée' };
      }

      // 5. Valider le PIN
      if (!/^\d{4}$/.test(pin)) {
        return { success: false, error: 'Code PIN invalide (4 chiffres requis)' };
      }

      // 6. Générer un deviceUUID unique
      const deviceUuid = crypto.randomUUID();

      // 7. Authentifier avec Pawnote (PARENT account)
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
        // Network connectivity issue - server can't reach Pronote
        if (errorMessage.includes('Unable to connect') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ETIMEDOUT')) {
          return {
            success: false,
            error: 'Impossible de contacter le serveur Pronote de cet établissement. ' +
                   'Le serveur peut être temporairement indisponible ou bloquer les connexions externes. ' +
                   'Réessayez plus tard ou contactez l\'établissement.'
          };
        }
        return { success: false, error: 'Échec de connexion Pronote' };
      }

      // 8. Vérifier que c'est bien un compte parent
      if (refreshInfo.kind !== AccountKind.PARENT) {
        return {
          success: false,
          error: 'Veuillez scanner le QR code de votre espace PARENT Pronote',
        };
      }

      // 9. Extraire la liste des enfants (resources)
      const resources: PronoteResource[] = session.user.resources.map((r, index) => ({
        name: r.name,
        id: r.id || `resource_${index}`,
        className: r.className,
      }));

      if (resources.length === 0) {
        return { success: false, error: 'Aucun enfant trouvé sur ce compte Pronote' };
      }

      // 10. Chiffrer le token
      const encryptedToken = await encrypt(refreshInfo.token);
      const tokenExpiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

      // 11. Supprimer connexion et mappings existants
      const existingConnection = await db.query.pronoteConnections.findFirst({
        where: eq(pronoteConnections.parentId, parentId),
      });

      if (existingConnection) {
        await db
          .delete(pronoteChildMappings)
          .where(eq(pronoteChildMappings.connectionId, existingConnection.id));
        await db.delete(pronoteConnections).where(eq(pronoteConnections.parentId, parentId));
      }

      // 12. Créer la nouvelle connexion
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

      // Supprimer les anciens mappings
      await db
        .delete(pronoteChildMappings)
        .where(eq(pronoteChildMappings.connectionId, connection.id));

      // Créer les nouveaux mappings
      for (const mapping of mappings) {
        // Vérifier que l'enfant existe et appartient au parent
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
   * Déconnecte un parent de Pronote (supprime aussi les mappings)
   */
  async disconnectParent(parentId: string): Promise<boolean> {
    try {
      const connection = await db.query.pronoteConnections.findFirst({
        where: eq(pronoteConnections.parentId, parentId),
      });

      if (connection) {
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
  private async getActiveParentSession(parentId: string): Promise<SessionHandle | null> {
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
  private async getActiveSessionForChild(
    childId: string
  ): Promise<{ session: SessionHandle; resourceIndex: number } | null> {
    // Trouver le mapping de l'enfant
    const mapping = await db.query.pronoteChildMappings.findFirst({
      where: eq(pronoteChildMappings.childId, childId),
      with: { connection: true },
    });

    if (!mapping || !mapping.connection || mapping.connection.status !== 'active') {
      return null;
    }

    const session = await this.createSessionFromConnection(mapping.connection);
    if (!session) return null;

    // Switcher vers l'enfant dans la session
    use(session, mapping.resourceIndex);

    return { session, resourceIndex: mapping.resourceIndex };
  }

  /**
   * Crée une session Pawnote à partir d'une connexion DB
   */
  private async createSessionFromConnection(
    connection: typeof pronoteConnections.$inferSelect
  ): Promise<SessionHandle | null> {
    const now = new Date();
    const shouldRefresh =
      connection.tokenExpiresAt.getTime() - now.getTime() < TOKEN_REFRESH_BUFFER_MS;

    let token: string;
    try {
      token = await decrypt(connection.encryptedToken);
    } catch {
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

  // =============================================
  // DATA FETCHING - FOR CHILD (via mapping)
  // =============================================

  /**
   * Récupère les devoirs pour un enfant
   */
  async getHomeworkForChild(childId: string, weekOffset = 0): Promise<PronoteHomework[] | null> {
    const result = await this.getActiveSessionForChild(childId);
    if (!result) return null;

    const { session } = result;

    try {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + 1 + weekOffset * 7);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const assignments = await assignmentsFromIntervals(session, startOfWeek, endOfWeek);

      // Update sync timestamp
      await db
        .update(pronoteChildMappings)
        .set({ lastHomeworkSync: new Date(), updatedAt: new Date() })
        .where(eq(pronoteChildMappings.childId, childId));

      return assignments.map((a: Assignment) => ({
        id: a.id,
        subject: a.subject.name,
        description: a.description,
        dueDate: a.deadline,
        done: a.done,
        difficulty: a.difficulty,
        estimatedMinutes: a.length,
      }));
    } catch (error) {
      logger.error('Pronote homework fetch error', {
        operation: 'pronote:homework:error',
        childId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      return null;
    }
  }

  /**
   * Récupère les notes pour un enfant
   */
  async getGradesForChild(childId: string): Promise<PronoteGrade[] | null> {
    const result = await this.getActiveSessionForChild(childId);
    if (!result) return null;

    const { session } = result;

    try {
      const defaultPeriod = session.userResource.tabs.get(198)?.defaultPeriod;
      if (!defaultPeriod) {
        logger.warn('No default period for grades', { childId });
        return [];
      }

      const overview = await gradesOverview(session, defaultPeriod);

      await db
        .update(pronoteChildMappings)
        .set({ lastGradesSync: new Date(), updatedAt: new Date() })
        .where(eq(pronoteChildMappings.childId, childId));

      return overview.grades.map((g) => ({
        id: g.id,
        subject: g.subject.name,
        value: g.value.kind === 0 ? g.value.points : null,
        outOf: g.outOf.points,
        coefficient: g.coefficient,
        date: g.date,
        description: g.comment,
        average: g.average?.points,
        max: g.max?.points,
        min: g.min?.points,
      }));
    } catch (error) {
      logger.error('Pronote grades fetch error', {
        operation: 'pronote:grades:error',
        childId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      return null;
    }
  }

  /**
   * Récupère l'emploi du temps pour un enfant
   */
  async getTimetableForChild(
    childId: string,
    weekOffset = 0
  ): Promise<PronoteTimetableEntry[] | null> {
    const result = await this.getActiveSessionForChild(childId);
    if (!result) return null;

    const { session } = result;

    try {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + 1 + weekOffset * 7);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const timetable = await timetableFromIntervals(session, startOfWeek, endOfWeek);

      await db
        .update(pronoteChildMappings)
        .set({ lastTimetableSync: new Date(), updatedAt: new Date() })
        .where(eq(pronoteChildMappings.childId, childId));

      return timetable.classes
        .filter((c): c is typeof c & { is: 'lesson' } => c.is === 'lesson')
        .map((lesson) => ({
          id: lesson.id,
          subject: lesson.subject?.name,
          teacherNames: lesson.teacherNames,
          classrooms: lesson.classrooms,
          startDate: lesson.startDate,
          endDate: lesson.endDate,
          canceled: lesson.canceled,
          status: lesson.status,
        }));
    } catch (error) {
      logger.error('Pronote timetable fetch error', {
        operation: 'pronote:timetable:error',
        childId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      return null;
    }
  }

  // =============================================
  // STATUS & INFO
  // =============================================

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

  // =============================================
  // RECHERCHE D'ÉTABLISSEMENTS (API Index Education)
  // =============================================

  /**
   * Recherche des établissements Pronote par géolocalisation
   * Utilise l'API officielle Index Education (comme Papillon)
   *
   * @param latitude - Latitude GPS
   * @param longitude - Longitude GPS
   * @returns Liste des établissements triés par distance
   */
  async searchSchoolsByLocation(
    latitude: number,
    longitude: number
  ): Promise<PronoteSchoolResult[]> {
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

      // Réponse vide = pas d'établissements
      if (text === '{}' || !text.trim()) {
        return [];
      }

      const data = JSON.parse(text) as IndexEducationSchool[];

      if (!Array.isArray(data)) {
        return [];
      }

      // Calcul distance avec Haversine et tri
      return data
        .map((school) => ({
          name: school.nomEtab,
          url: school.url,
          postalCode: school.cp,
          distance: this.haversineDistance(
            latitude,
            longitude,
            parseFloat(school.lat),
            parseFloat(school.long)
          ),
        }))
        .sort((a, b) => a.distance - b.distance);
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

  /**
   * Calcul de distance Haversine entre deux points GPS
   */
  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Rayon de la Terre en km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10; // Distance en km, arrondie à 1 décimale
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

export const pronoteService = new PronoteService();
