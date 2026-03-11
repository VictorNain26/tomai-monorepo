import { getTreaty, unwrap } from '@repo/api';
import type { PronoteMetadata } from './pronote-types';

interface PushInput {
  metadata: PronoteMetadata;
  token: string;
  tokenExpiresAt: string;
}

interface PullResult {
  metadata: PronoteMetadata;
  tokenExpiresAt: string;
}

class PronoteCredentialsSync {
  async pushToServer(input: PushInput): Promise<boolean> {
    try {
      const api = getTreaty();
      const response = await api.api.pronote.credentials.put({
        token: input.token,
        metadata: JSON.stringify(input.metadata),
        tokenExpiresAt: input.tokenExpiresAt,
      });
      unwrap(response);
      return true;
    } catch (error) {
      console.error('[PronoteCredentials] pushToServer failed:', error);
      return false;
    }
  }

  async pullFromServer(): Promise<PullResult | null> {
    try {
      const api = getTreaty();
      const response = await api.api.pronote.credentials.get();
      const data = unwrap<{
        metadata: string;
        tokenExpiresAt: string;
      }>(response);

      if (!data) return null;

      return {
        metadata: JSON.parse(data.metadata) as PronoteMetadata,
        tokenExpiresAt: data.tokenExpiresAt,
      };
    } catch (error) {
      console.error('[PronoteCredentials] pullFromServer failed:', error);
      return null;
    }
  }

  async removeFromServer(): Promise<boolean> {
    try {
      const api = getTreaty();
      const response = await api.api.pronote.credentials.delete();
      unwrap(response);
      return true;
    } catch (error) {
      console.error('[PronoteCredentials] removeFromServer failed:', error);
      return false;
    }
  }
}

export const pronoteCredentialsSync = new PronoteCredentialsSync();
