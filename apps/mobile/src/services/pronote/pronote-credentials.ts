import { getTreaty, unwrap } from '@repo/api';
import type { PronoteMetadata } from './pronote-types';

interface PushInput {
  token: string;
  metadata: PronoteMetadata;
  tokenExpiresAt: string;
}

interface PullResult {
  token: string;
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
    } catch {
      return false;
    }
  }

  async pullFromServer(): Promise<PullResult | null> {
    try {
      const api = getTreaty();
      const response = await api.api.pronote.credentials.get();
      const data = unwrap<{
        token: string;
        metadata: string;
        tokenExpiresAt: string;
      }>(response);

      if (!data) return null;

      return {
        token: data.token,
        metadata: JSON.parse(data.metadata) as PronoteMetadata,
        tokenExpiresAt: data.tokenExpiresAt,
      };
    } catch {
      return null;
    }
  }

  async removeFromServer(): Promise<boolean> {
    try {
      const api = getTreaty();
      const response = await api.api.pronote.credentials.delete();
      unwrap(response);
      return true;
    } catch {
      return false;
    }
  }
}

export const pronoteCredentialsSync = new PronoteCredentialsSync();
