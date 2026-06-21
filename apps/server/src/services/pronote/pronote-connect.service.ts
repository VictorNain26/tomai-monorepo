/**
 * Pronote Connect Service
 *
 * Handles QR-code-based onboarding for a Pronote account.
 * The deviceUUID is generated server-side and stored encrypted in metadata.
 */

import { pawnoteServerAdapter } from './pawnote-server.adapter.js';
import { pronoteSyncService, PronoteCredentialForbiddenError } from '../pronote-sync.service.js';
import { pronoteDataService } from './pronote-data.service.js';
import { parentService } from '../parent.service.js';
import { pronoteChildResourcesRepository } from '../../db/repositories/pronote-child-resources.repository.js';
import { usersRepository } from '../../db/repositories/users.repository.js';
import type { DiscoveredResource } from './provider.types.js';
import type { SchoolLevel } from '../../db/schema.js';
import { splitName, inferSchoolLevel, matchExistingChild } from '../../lib/pronote-onboarding.js';
import { logger } from '../../lib/observability.js';

export type { DiscoveredResource };
// PronoteCredentialForbiddenError originates in pronote-sync.service to avoid
// a circular import. Re-exported here for backward compatibility.
export { PronoteCredentialForbiddenError };

export interface ActivationSelection {
  resourceId: number;
  firstName: string;
  lastName: string;
  schoolLevel: SchoolLevel;
  username: string;
  password: string;
  linkToChildId?: string;
}

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

export class PronoteChildNotOwnedError extends Error {
  constructor(childId: string) {
    super(`Child ${childId} does not belong to the requesting parent`);
    this.name = 'PronoteChildNotOwnedError';
  }
}

class PronoteConnectService {
  private async enrichResource(
    resource: DiscoveredResource,
    children: { id: string; firstName: string; lastName: string }[],
  ): Promise<DiscoveredChild> {
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
  }

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
      establishmentName: resources[0]?.establishmentName ?? null,
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

    return Promise.all(resources.map((resource) => this.enrichResource(resource, children)));
  }

  /**
   * Compare current Pronote resources against already-mapped ones for this credential.
   *
   * Returns:
   *   added       — resources not yet mapped, enriched with name suggestions and dedup.
   *   stillMapped — resourceIds that are already mapped and still present on the account.
   *
   * Idempotent: writes nothing. The parent activates new children via activate().
   *
   * Throws PronoteCredentialNotFoundError or PronoteCredentialForbiddenError on bad ownership.
   */
  async resync(
    userId: string,
    credentialId: string,
  ): Promise<{ added: DiscoveredChild[]; stillMapped: number[] }> {
    const cred = await pronoteSyncService.getCredentialById(credentialId);
    if (!cred) throw new PronoteCredentialNotFoundError(credentialId);
    if (cred.userId !== userId) throw new PronoteCredentialForbiddenError();

    const [resources, mappedIds, children] = await Promise.all([
      pronoteDataService.listResources(credentialId),
      pronoteChildResourcesRepository.getResourceIdsByCredential(credentialId),
      parentService.getParentChildren(userId),
    ]);

    const mappedSet = new Set(mappedIds);
    const added: DiscoveredChild[] = [];
    const stillMapped: number[] = [];

    for (const resource of resources) {
      if (mappedSet.has(resource.resourceId)) {
        stillMapped.push(resource.resourceId);
      } else {
        added.push(await this.enrichResource(resource, children));
      }
    }

    return { added, stillMapped };
  }

  /**
   * Activate Pronote resources for a parent: create or link children and write mappings.
   *
   * Each selection is processed independently — a failing item is excluded from the
   * result without aborting the rest of the batch.
   *
   * Throws PronoteCredentialNotFoundError or PronoteCredentialForbiddenError before
   * any write if the ownership check fails.
   */
  async activate(
    parentUserId: string,
    credentialId: string,
    selections: ActivationSelection[],
  ): Promise<{
    activated: { resourceId: number; childId: string }[];
    failed: { resourceId: number; reason: string }[];
  }> {
    const cred = await pronoteSyncService.getCredentialById(credentialId);
    if (!cred) throw new PronoteCredentialNotFoundError(credentialId);
    if (cred.userId !== parentUserId) throw new PronoteCredentialForbiddenError();

    const allResources = await pronoteDataService.listResources(credentialId);
    const resourceById = new Map(allResources.map((r) => [r.resourceId, r]));

    const activated: { resourceId: number; childId: string }[] = [];
    const failed: { resourceId: number; reason: string }[] = [];

    for (const selection of selections) {
      let createdChildId: string | null = null;
      try {
        let childId: string;

        if (selection.linkToChildId) {
          // C2: verify the child already belongs to this parent before mapping
          const owned = await parentService.isParentOf(parentUserId, selection.linkToChildId);
          if (!owned) throw new PronoteChildNotOwnedError(selection.linkToChildId);

          // C3: reject if the child already has a Pronote mapping (no silent overwrite)
          const existing = await pronoteChildResourcesRepository.getMapping(selection.linkToChildId);
          if (existing) {
            failed.push({ resourceId: selection.resourceId, reason: 'already_mapped' });
            continue;
          }

          childId = selection.linkToChildId;
        } else {
          const child = await parentService.createChild(parentUserId, {
            firstName: selection.firstName,
            lastName: selection.lastName,
            username: selection.username,
            password: selection.password,
            schoolLevel: selection.schoolLevel,
          });
          createdChildId = child.id;
          childId = child.id;
        }

        const res = resourceById.get(selection.resourceId);
        await pronoteChildResourcesRepository.upsertMapping(
          parentUserId,
          childId,
          credentialId,
          selection.resourceId,
          res?.className ?? null,
          res?.establishmentName ?? null,
        );

        activated.push({ resourceId: selection.resourceId, childId });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        // I1: log without leaking credentials
        logger.warn('Pronote activate item failed', {
          operation: 'pronote-connect:activate:item-failed',
          credentialId,
          resourceId: selection.resourceId,
          reason,
        });
        failed.push({ resourceId: selection.resourceId, reason });

        // I2: compensate orphaned child if mapping failed after creation
        if (createdChildId !== null) {
          await usersRepository.deleteById(createdChildId).catch((deleteErr) => {
            logger.warn('Pronote activate: failed to delete orphan child', {
              operation: 'pronote-connect:activate:orphan-cleanup',
              childId: createdChildId,
              reason: deleteErr instanceof Error ? deleteErr.message : String(deleteErr),
            });
          });
        }
      }
    }

    return { activated, failed };
  }
}

export const pronoteConnectService = new PronoteConnectService();
