import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { getTreaty } from '@repo/api';

beforeEach(() => jest.clearAllMocks());

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { pronoteCredentialsSync: credentialsSync } = require('@/services/pronote/pronote-credentials');

describe('PronoteCredentialsSync', () => {
  describe('pushToServer', () => {
    it('should call PUT with credentials', async () => {
      const mockPut = jest.fn().mockResolvedValue({ data: { success: true }, error: null });
      const treaty = getTreaty() as Record<string, unknown>;
      const api = treaty.api as Record<string, unknown>;
      const pronote = api.pronote as Record<string, unknown>;
      const credentials = pronote.credentials as Record<string, unknown>;
      (credentials.put as jest.Mock) = mockPut;

      const result = await (credentialsSync as { pushToServer: (input: Record<string, unknown>) => Promise<boolean> }).pushToServer({
        token: 'my-token',
        metadata: {
          instanceUrl: 'https://demo.pronote.fr',
          username: 'jean',
          deviceUuid: 'dev-1',
          accountKind: 1,
        },
        tokenExpiresAt: '2026-04-01T00:00:00Z',
      });

      expect(result).toBe(true);
      expect(mockPut).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'my-token',
          metadata: expect.any(String),
          tokenExpiresAt: '2026-04-01T00:00:00Z',
        }),
      );
    });
  });

  describe('pullFromServer', () => {
    it('should return credentials from GET', async () => {
      const mockGet = jest.fn().mockResolvedValue({
        data: {
          token: 'server-token',
          metadata: '{"instanceUrl":"https://demo.pronote.fr","username":"jean","deviceUuid":"dev-1","accountKind":1}',
          tokenExpiresAt: '2026-04-01T00:00:00Z',
        },
        error: null,
      });
      const treaty = getTreaty() as Record<string, unknown>;
      const api = treaty.api as Record<string, unknown>;
      const pronote = api.pronote as Record<string, unknown>;
      const credentials = pronote.credentials as Record<string, unknown>;
      (credentials.get as jest.Mock) = mockGet;

      const result = await (credentialsSync as { pullFromServer: () => Promise<{ token: string; metadata: { instanceUrl: string }; tokenExpiresAt: string } | null> }).pullFromServer();

      expect(result).not.toBeNull();
      expect(result?.token).toBe('server-token');
      expect(result?.metadata.instanceUrl).toBe('https://demo.pronote.fr');
    });

    it('should return null on error', async () => {
      const mockGet = jest.fn().mockResolvedValue({
        data: null,
        error: { status: 404, value: { message: 'Not found' } },
      });
      const treaty = getTreaty() as Record<string, unknown>;
      const api = treaty.api as Record<string, unknown>;
      const pronote = api.pronote as Record<string, unknown>;
      const credentials = pronote.credentials as Record<string, unknown>;
      (credentials.get as jest.Mock) = mockGet;

      const result = await (credentialsSync as { pullFromServer: () => Promise<unknown> }).pullFromServer();

      expect(result).toBeNull();
    });
  });

  describe('removeFromServer', () => {
    it('should call DELETE', async () => {
      const mockDelete = jest.fn().mockResolvedValue({ data: { success: true }, error: null });
      const treaty = getTreaty() as Record<string, unknown>;
      const api = treaty.api as Record<string, unknown>;
      const pronote = api.pronote as Record<string, unknown>;
      const credentials = pronote.credentials as Record<string, unknown>;
      (credentials.delete as jest.Mock) = mockDelete;

      const result = await (credentialsSync as { removeFromServer: () => Promise<boolean> }).removeFromServer();

      expect(result).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});
