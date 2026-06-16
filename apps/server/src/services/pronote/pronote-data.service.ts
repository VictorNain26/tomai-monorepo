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
  readonly parentUserId: string;
  constructor(parentUserId: string) {
    super(`No Pronote credentials found for parent ${parentUserId}`);
    this.name = 'PronoteNotConnectedError';
    this.parentUserId = parentUserId;
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

  if (parsed.accountKind === undefined || parsed.accountKind === null) {
    throw new PronoteMetadataError('accountKind');
  }

  return {
    instanceUrl: parsed.instanceUrl as string,
    username: parsed.username as string,
    deviceUuid: parsed.deviceUuid as string,
    accountKind: parsed.accountKind as number,
  };
}

// ============================================
// Service class — injectable cache for testability
// ============================================

class PronoteDataService {
  constructor(private readonly cache: SessionCache<AdapterSession>) {}

  private async resolveSession(childId: string): Promise<{ session: AdapterSession; resourceId: number }> {
    const mapping = await pronoteChildResourcesRepository.getMapping(childId);
    if (!mapping) throw new PronoteResourceNotMappedError(childId);

    const cached = this.cache.get(mapping.parentUserId);
    if (cached) {
      return { session: cached, resourceId: mapping.resourceId };
    }

    const cred = await pronoteSyncService.getCredentials(mapping.parentUserId);
    if (!cred) throw new PronoteNotConnectedError(mapping.parentUserId);

    const meta = parseMetadata(cred.metadata);

    // PronoteReauthRequired propagates — no catch, no password fallback
    const session = await pawnoteServerAdapter.connect({
      url: meta.instanceUrl,
      kind: meta.accountKind,
      username: meta.username,
      token: cred.token,
      deviceUuid: meta.deviceUuid,
    });

    // Re-persist the rotated token; keep existing metadata string and expiry
    await pronoteSyncService.upsertCredentials(mapping.parentUserId, {
      token: session.token,
      metadata: cred.metadata,
      tokenExpiresAt: cred.tokenExpiresAt,
    });

    this.cache.set(mapping.parentUserId, session);

    return { session, resourceId: mapping.resourceId };
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
