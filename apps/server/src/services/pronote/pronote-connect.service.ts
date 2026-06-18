/**
 * Pronote Connect Service
 *
 * Handles QR-code-based onboarding for a Pronote account.
 * The deviceUUID is generated server-side and stored encrypted in metadata.
 */

import { pawnoteServerAdapter } from './pawnote-server.adapter.js';
import { pronoteSyncService } from '../pronote-sync.service.js';
import { pronoteDataService } from './pronote-data.service.js';
import { parentService } from '../parent.service.js';
import type { DiscoveredResource } from './provider.types.js';
import type { SchoolLevel } from '../../db/schema.js';
import { splitName, inferSchoolLevel, matchExistingChild } from '../../lib/pronote-onboarding.js';

export type { DiscoveredResource };

export interface DiscoveredChild extends DiscoveredResource {
  suggested: {
    firstName: string;
    lastName: string;
    schoolLevel: SchoolLevel | null;
  };
  existingChildId: string | null;
}

export class PronoteCredentialNotFoundError extends Error {
  constructor(credentialId: string) {
    super(`Pronote credential not found: ${credentialId}`);
    this.name = 'PronoteCredentialNotFoundError';
  }
}

export class PronoteCredentialForbiddenError extends Error {
  constructor() {
    super('This Pronote credential does not belong to the requesting user');
    this.name = 'PronoteCredentialForbiddenError';
  }
}

class PronoteConnectService {
  async connectQr(
    userId: string,
    input: { qr: { jeton: string; login: string; url: string }; pin: string },
  ): Promise<{ credentialId: string; resources: DiscoveredResource[] }> {
    const { session, metadata, resources } = await pawnoteServerAdapter.connectWithQrPayload(input);

    const tokenExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const upsertResult = await pronoteSyncService.upsertCredentials(userId, {
      token: session.token,
      metadata: JSON.stringify({
        instanceUrl: metadata.instanceUrl,
        username: metadata.username,
        deviceUuid: metadata.deviceUuid,
        accountKind: metadata.kind,
      }),
      tokenExpiresAt,
    });

    if (!upsertResult.success || !upsertResult.credentialId) {
      throw new Error(
        `Failed to store Pronote credentials: ${upsertResult.error ?? 'unknown error'}`,
      );
    }

    pronoteDataService.primeSession(upsertResult.credentialId, session);

    return {
      credentialId: upsertResult.credentialId,
      resources,
    };
  }

  /**
   * Discover Pronote resources for a credential and enrich them with name suggestions
   * and dedup against the parent's existing children.
   *
   * Throws PronoteCredentialNotFoundError if the credential does not exist.
   * Throws PronoteCredentialForbiddenError if the credential belongs to another user.
   */
  async discover(userId: string, credentialId: string): Promise<DiscoveredChild[]> {
    const cred = await pronoteSyncService.getCredentialById(credentialId);
    if (!cred) throw new PronoteCredentialNotFoundError(credentialId);
    if (cred.userId !== userId) throw new PronoteCredentialForbiddenError();

    const [resources, children] = await Promise.all([
      pronoteDataService.listResources(credentialId),
      parentService.getParentChildren(userId),
    ]);

    return resources.map((resource) => {
      const suggested = splitName(resource.name);
      return {
        ...resource,
        suggested: {
          firstName: suggested.firstName,
          lastName: suggested.lastName,
          schoolLevel: inferSchoolLevel(resource.className),
        },
        existingChildId: matchExistingChild(resource.name, children),
      };
    });
  }
}

export const pronoteConnectService = new PronoteConnectService();
