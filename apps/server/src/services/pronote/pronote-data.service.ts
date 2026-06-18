import type { NormalizedGrade, NormalizedHomework, NormalizedLesson } from './provider.types';
import { pawnoteServerAdapter, type AdapterSession } from './pawnote-server.adapter';
import { SessionCache } from './session-cache';
import { pronoteChildResourcesRepository } from '../../db/repositories/pronote-child-resources.repository';
import { pronoteSyncService } from '../pronote-sync.service';

// ============================================
// Typed errors — each carries context, no message.includes() needed
// ============================================

export class PronoteResourceNotMappedError extends Error {
  readonly childId: string;
  constructor(childId: string) {
    super(`No Pronote resource mapping found for child ${childId}`);
    this.name = 'PronoteResourceNotMappedError';
    this.childId = childId;
  }
}

export class PronoteNotConnectedError extends Error {
  readonly credentialId: string;
  constructor(credentialId: string) {
    super(`No Pronote credentials found for credential ${credentialId}`);
    this.name = 'PronoteNotConnectedError';
    this.credentialId = credentialId;
  }
}

export class PronoteMetadataError extends Error {
  constructor(field: string) {
    super(`Pronote metadata is missing required field: ${field}`);
    this.name = 'PronoteMetadataError';
  }
}

// ============================================
// Metadata shape stored as JSON string
// ============================================

interface PronoteMetadata {
  instanceUrl: string;
  username: string;
  deviceUuid: string;
  accountKind: number;
}

function parseMetadata(raw: string): PronoteMetadata {
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  if (typeof parsed.instanceUrl !== 'string' || !parsed.instanceUrl) throw new PronoteMetadataError('instanceUrl');
  if (typeof parsed.username !== 'string' || !parsed.username) throw new PronoteMetadataError('username');
  if (typeof parsed.deviceUuid !== 'string' || !parsed.deviceUuid) throw new PronoteMetadataError('deviceUuid');
  if (typeof parsed.accountKind !== 'number') throw new PronoteMetadataError('accountKind');

  return {
    instanceUrl: parsed.instanceUrl,
    username: parsed.username,
    deviceUuid: parsed.deviceUuid,
    accountKind: parsed.accountKind,
  };
}

// ============================================
// Service class — injectable cache for testability
// ============================================

/**
 * AUTHORIZATION: this service does NOT check caller identity.
 * Route handlers MUST verify the caller is the child or the child's parent
 * before calling these methods.
 */
class PronoteDataService {
  constructor(private readonly cache: SessionCache<AdapterSession>) {}

  /**
   * In-flight deduplication keyed by credentialId.
   * Concurrent requests for the same credential coalesce onto a single
   * connect+persist+cache.set call — prevents the race where two callers both
   * see an empty cache, both call connect(), and the second update overwrites
   * the first rotated (one-shot) token.
   */
  private readonly inflight = new Map<string, Promise<AdapterSession>>();

  private async getOrCreateSession(credentialId: string): Promise<AdapterSession> {
    const cached = this.cache.get(credentialId);
    if (cached) return cached;

    const existing = this.inflight.get(credentialId);
    if (existing) return existing;

    const p = (async () => {
      const cred = await pronoteSyncService.getCredentialById(credentialId);
      if (!cred) throw new PronoteNotConnectedError(credentialId);

      const meta = parseMetadata(cred.metadata);

      // PronoteReauthRequired propagates — no catch, no password fallback
      const session = await pawnoteServerAdapter.connect({
        url: meta.instanceUrl,
        kind: meta.accountKind,
        username: meta.username,
        token: cred.token,
        deviceUuid: meta.deviceUuid,
      });

      // Persist the rotated token BEFORE caching — caching before persisting
      // would risk serving a token that was never stored (e.g. on process crash).
      const persisted = await pronoteSyncService.updateTokenById(credentialId, session.token);
      if (!persisted) {
        throw new Error(`Failed to persist rotated Pronote token for credential ${credentialId}`);
      }

      this.cache.set(credentialId, session);
      return session;
    })().finally(() => this.inflight.delete(credentialId));

    this.inflight.set(credentialId, p);
    return p;
  }

  private async resolveSession(childId: string): Promise<{ session: AdapterSession; resourceId: number }> {
    const mapping = await pronoteChildResourcesRepository.getMapping(childId);
    if (!mapping) throw new PronoteResourceNotMappedError(childId);

    const session = await this.getOrCreateSession(mapping.credentialId);
    return { session, resourceId: mapping.resourceId };
  }

  /**
   * @internal Pre-warm the session cache for a given credential id.
   *
   * Used to seed a live session immediately after a credentials-based login
   * (e.g. right after a successful QR-code / password connect), and by
   * integration tests that must bypass `loginToken` when the demo account
   * does not support token-based re-authentication.
   *
   * NOT for production data paths — call connect() there instead.
   */
  primeSession(credentialId: string, session: AdapterSession): void {
    this.cache.set(credentialId, session);
  }

  async getGrades(childId: string): Promise<NormalizedGrade[]> {
    const { session, resourceId } = await this.resolveSession(childId);
    return pawnoteServerAdapter.getGrades(session, resourceId);
  }

  async getHomework(childId: string): Promise<NormalizedHomework[]> {
    const { session, resourceId } = await this.resolveSession(childId);
    return pawnoteServerAdapter.getHomework(session, resourceId);
  }

  async getTimetable(childId: string, day: string): Promise<NormalizedLesson[]> {
    const { session, resourceId } = await this.resolveSession(childId);
    return pawnoteServerAdapter.getTimetable(session, resourceId, day);
  }
}

// 10-minute TTL for cached Pronote sessions
const SESSION_TTL_MS = 600_000;

export const pronoteDataService = new PronoteDataService(new SessionCache<AdapterSession>(SESSION_TTL_MS));
