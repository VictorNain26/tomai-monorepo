/**
 * Pronote Connect Service
 *
 * Handles QR-code-based onboarding for a Pronote account.
 * The deviceUUID is generated server-side and stored encrypted in metadata.
 *
 * This service does NOT enrich resources into DiscoveredChild (Task 3).
 */

import { pawnoteServerAdapter } from './pawnote-server.adapter.js';
import { pronoteSyncService } from '../pronote-sync.service.js';
import { pronoteDataService } from './pronote-data.service.js';

export interface DiscoveredResource {
  resourceId: number;
  name: string;
  className: string | null;
  establishmentName: string;
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
}

export const pronoteConnectService = new PronoteConnectService();
