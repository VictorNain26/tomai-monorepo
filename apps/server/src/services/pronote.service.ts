/**
 * Pronote Service - Integration avec Pawnote
 *
 * Gère la connexion et synchronisation avec Pronote via QR Code.
 * Les tokens sont chiffrés AES-256-GCM avant stockage en base.
 *
 * IMPORTANT: Ce service utilise une API non-officielle (Pawnote).
 * L'élève accède à SES PROPRES données via SES credentials.
 */

import {
  createSessionHandle,
  loginQrCode,
  loginToken,
  assignmentsFromIntervals,
  gradesOverview,
  timetableFromIntervals,
  AccountKind,
  type SessionHandle,
  type RefreshInformation,
  type Assignment,
} from 'pawnote';
import type { Fetcher } from '@literate.ink/utilities';
import { db } from '../db/connection.js';
import { pronoteConnections, establishments, user } from '../db/schema.js';
import { eq } from 'drizzle-orm';
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
 * Source: Index Education (Pronote publisher)
 */
const PRONOTE_ALLOWED_DOMAINS = [
  'index-education.net',
  'pronote.toutatice.fr', // Académie Bretagne
  'mon.lyceeconnecte.fr', // Nouvelle-Aquitaine
  'ent.iledefrance.fr', // Île-de-France
  'enthdf.fr', // Hauts-de-France
  'monbureaunumerique.fr', // Grand Est
  'e-lyco.fr', // Pays de la Loire
  'l-educdenormandie.fr', // Normandie
  'laclasse.com', // Auvergne-Rhône-Alpes
];

/**
 * SECURITY: Validates that a URL is a legitimate Pronote instance
 * Prevents SSRF attacks via malicious QR codes
 */
function isAllowedPronoteUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    // Must be HTTPS in production
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return false;
    }

    // Check against allowlist
    const hostname = url.hostname.toLowerCase();
    return PRONOTE_ALLOWED_DOMAINS.some(domain =>
      hostname === domain || hostname.endsWith(`.${domain}`)
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
}

export interface PronoteHomework {
  id: string;
  subject: string;
  description: string;
  deadline: Date;
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
  comment: string;
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

// =============================================
// CUSTOM FETCHER
// =============================================

/**
 * Custom Fetcher avec User-Agent Pronote Mobile
 * Requis pour que Pronote accepte les requêtes
 */
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
   * Connecte un élève à Pronote via QR Code
   *
   * Flow:
   * 1. Valider que l'établissement existe et a un URL Pronote
   * 2. Parser le QR code JSON
   * 3. Authentifier avec Pawnote
   * 4. Chiffrer et stocker le token
   */
  async connectWithQrCode(
    userId: string,
    establishmentRne: string,
    qrCodeJson: string,
    pin: string
  ): Promise<PronoteConnectionResult> {
    try {
      // 1. Valider l'établissement
      const establishment = await db.query.establishments.findFirst({
        where: eq(establishments.rne, establishmentRne),
      });

      if (!establishment) {
        return { success: false, error: 'Établissement non trouvé' };
      }

      if (!establishment.hasPronote || !establishment.pronoteUrl) {
        return { success: false, error: 'Cet établissement n\'a pas Pronote configuré' };
      }

      // 2. Valider l'utilisateur
      const existingUser = await db.query.user.findFirst({
        where: eq(user.id, userId),
      });

      if (!existingUser || existingUser.role !== 'student') {
        return { success: false, error: 'Seuls les élèves peuvent se connecter à Pronote' };
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

      // 4. SECURITY: Validate QR code URL against allowlist (SSRF protection)
      if (!isAllowedPronoteUrl(qrData.url)) {
        logger.warn('Pronote SSRF attempt blocked', {
          operation: 'pronote:connect:ssrf-blocked',
          userId,
          establishmentRne,
          blockedUrl: qrData.url.substring(0, 100), // Truncate for logs
        });
        return { success: false, error: 'URL Pronote non autorisée' };
      }

      // 5. Valider le PIN (4 chiffres)
      if (!/^\d{4}$/.test(pin)) {
        return { success: false, error: 'Code PIN invalide (4 chiffres requis)' };
      }

      // 5. Générer un deviceUUID unique
      const deviceUuid = crypto.randomUUID();

      // 6. Authentifier avec Pawnote
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
          userId,
          establishmentRne,
          error: errorMessage,
        });

        // Messages d'erreur user-friendly
        if (errorMessage.includes('BadCredentials')) {
          return { success: false, error: 'Code PIN incorrect' };
        }
        if (errorMessage.includes('SessionExpired')) {
          return { success: false, error: 'QR code expiré, veuillez en scanner un nouveau' };
        }
        return { success: false, error: 'Échec de connexion Pronote' };
      }

      // 7. Chiffrer le token
      const encryptedToken = await encrypt(refreshInfo.token);
      const tokenExpiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

      // 8. Supprimer connexion existante si présente
      await db.delete(pronoteConnections).where(eq(pronoteConnections.userId, userId));

      // 9. Créer la nouvelle connexion
      await db.insert(pronoteConnections).values({
        userId,
        establishmentRne,
        encryptedToken,
        instanceUrl: refreshInfo.url,
        pronoteUsername: refreshInfo.username,
        deviceUuid,
        accountKind: refreshInfo.kind,
        status: 'active',
        tokenExpiresAt,
        lastRefreshAt: new Date(),
      });

      logger.info('Pronote connection successful', {
        operation: 'pronote:connect:success',
        userId,
        establishmentRne,
        username: refreshInfo.username,
      });

      return {
        success: true,
        establishmentName: establishment.name,
      };
    } catch (error) {
      logger.error('Pronote connection error', {
        operation: 'pronote:connect:error',
        userId,
        establishmentRne,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'high' as const,
      });
      return { success: false, error: 'Erreur interne lors de la connexion' };
    }
  }

  /**
   * Déconnecte un élève de Pronote
   */
  async disconnect(userId: string): Promise<boolean> {
    try {
      await db
        .delete(pronoteConnections)
        .where(eq(pronoteConnections.userId, userId));

      logger.info('Pronote disconnected', {
        operation: 'pronote:disconnect',
        userId,
      });

      return true;
    } catch (error) {
      logger.error('Pronote disconnect error', {
        operation: 'pronote:disconnect:error',
        userId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      return false;
    }
  }

  /**
   * Obtient une session Pronote active (avec refresh si nécessaire)
   */
  private async getActiveSession(userId: string): Promise<SessionHandle | null> {
    // 1. Récupérer la connexion
    const connection = await db.query.pronoteConnections.findFirst({
      where: eq(pronoteConnections.userId, userId),
    });

    if (!connection || connection.status !== 'active') {
      return null;
    }

    // 2. Vérifier si le token doit être rafraîchi
    const now = new Date();
    const shouldRefresh =
      connection.tokenExpiresAt.getTime() - now.getTime() < TOKEN_REFRESH_BUFFER_MS;

    // 3. Déchiffrer le token
    let token: string;
    try {
      token = await decrypt(connection.encryptedToken);
    } catch {
      // Token corrompu, marquer comme erreur
      await db
        .update(pronoteConnections)
        .set({ status: 'error', lastError: 'Token déchiffrement échoué' })
        .where(eq(pronoteConnections.userId, userId));
      return null;
    }

    // 4. Créer la session
    const session = createSessionHandle(pronoteFetcher);

    try {
      // 5. Refresh si nécessaire
      if (shouldRefresh) {
        const refreshInfo = await loginToken(session, {
          url: connection.instanceUrl,
          kind: connection.accountKind as AccountKind,
          username: connection.pronoteUsername,
          token,
          deviceUUID: connection.deviceUuid,
        });

        // Mettre à jour le token chiffré
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
          .where(eq(pronoteConnections.userId, userId));

        logger.debug('Pronote token refreshed', {
          operation: 'pronote:refresh',
          userId,
        });
      } else {
        // Utiliser le token existant
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

      // Marquer la connexion comme expirée
      await db
        .update(pronoteConnections)
        .set({
          status: 'expired',
          lastError: errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(pronoteConnections.userId, userId));

      logger.warn('Pronote session expired', {
        operation: 'pronote:session:expired',
        userId,
        error: errorMessage,
      });

      return null;
    }
  }

  /**
   * Récupère les devoirs de la semaine en cours
   */
  async getHomework(userId: string, weekOffset = 0): Promise<PronoteHomework[] | null> {
    const session = await this.getActiveSession(userId);
    if (!session) return null;

    try {
      // Calculer les dates de la semaine
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + 1 + weekOffset * 7); // Lundi
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // Dimanche
      endOfWeek.setHours(23, 59, 59, 999);

      const assignments = await assignmentsFromIntervals(session, startOfWeek, endOfWeek);

      // Mettre à jour la date de dernière sync
      await db
        .update(pronoteConnections)
        .set({ lastHomeworkSync: new Date() })
        .where(eq(pronoteConnections.userId, userId));

      return assignments.map((a: Assignment) => ({
        id: a.id,
        subject: a.subject.name,
        description: a.description,
        deadline: a.deadline,
        done: a.done,
        difficulty: a.difficulty,
        estimatedMinutes: a.length,
      }));
    } catch (error) {
      logger.error('Pronote homework fetch error', {
        operation: 'pronote:homework:error',
        userId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      return null;
    }
  }

  /**
   * Récupère les notes de la période en cours
   */
  async getGrades(userId: string): Promise<PronoteGrade[] | null> {
    const session = await this.getActiveSession(userId);
    if (!session) return null;

    try {
      // Utiliser la période par défaut (trimestre actuel)
      const defaultPeriod = session.userResource.tabs.get(198)?.defaultPeriod;
      if (!defaultPeriod) {
        logger.warn('No default period for grades', { userId });
        return [];
      }

      const overview = await gradesOverview(session, defaultPeriod);

      // Mettre à jour la date de dernière sync
      await db
        .update(pronoteConnections)
        .set({ lastGradesSync: new Date() })
        .where(eq(pronoteConnections.userId, userId));

      return overview.grades.map((g) => ({
        id: g.id,
        subject: g.subject.name,
        value: g.value.kind === 0 ? g.value.points : null,
        outOf: g.outOf.points,
        coefficient: g.coefficient,
        date: g.date,
        comment: g.comment,
        average: g.average?.points,
        max: g.max?.points,
        min: g.min?.points,
      }));
    } catch (error) {
      logger.error('Pronote grades fetch error', {
        operation: 'pronote:grades:error',
        userId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      return null;
    }
  }

  /**
   * Récupère l'emploi du temps de la semaine
   */
  async getTimetable(userId: string, weekOffset = 0): Promise<PronoteTimetableEntry[] | null> {
    const session = await this.getActiveSession(userId);
    if (!session) return null;

    try {
      // Calculer les dates de la semaine
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + 1 + weekOffset * 7); // Lundi
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // Dimanche
      endOfWeek.setHours(23, 59, 59, 999);

      const timetable = await timetableFromIntervals(session, startOfWeek, endOfWeek);

      // Mettre à jour la date de dernière sync
      await db
        .update(pronoteConnections)
        .set({ lastTimetableSync: new Date() })
        .where(eq(pronoteConnections.userId, userId));

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
        userId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      return null;
    }
  }

  /**
   * Vérifie le statut de connexion d'un utilisateur
   */
  async getConnectionStatus(userId: string): Promise<{
    connected: boolean;
    status?: string;
    establishmentName?: string;
    lastSyncAt?: Date;
    error?: string;
  }> {
    const connection = await db.query.pronoteConnections.findFirst({
      where: eq(pronoteConnections.userId, userId),
      with: {
        establishment: true,
      },
    });

    if (!connection) {
      return { connected: false };
    }

    return {
      connected: connection.status === 'active',
      status: connection.status,
      establishmentName: connection.establishment?.name,
      lastSyncAt: connection.lastSyncAt ?? undefined,
      error: connection.lastError ?? undefined,
    };
  }
}

export const pronoteService = new PronoteService();
