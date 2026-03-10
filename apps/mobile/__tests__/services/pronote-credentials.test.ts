import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { getTreaty } from '@repo/api';

const mockGetTreaty = getTreaty as jest.Mock;

beforeEach(() => { jest.clearAllMocks(); });

const { pronoteCredentialsSync: credentialsSync } = require('@/services/pronote/pronote-credentials');

type CredSync = {
  pushToServer: (input: {
    token: string;
    metadata: { instanceUrl: string; username: string; deviceUuid: string; accountKind: number };
    tokenExpiresAt: string;
  }) => Promise<boolean>;
  pullFromServer: () => Promise<{
    token: string;
    metadata: { instanceUrl: string };
    tokenExpiresAt: string;
  } | null>;
  removeFromServer: () => Promise<boolean>;
};

const typed = credentialsSync as CredSync;

function setupMock(method: string, returnValue: unknown) {
  const mockFn = jest.fn<() => Promise<unknown>>().mockResolvedValue(returnValue);
  const credentials = { [method]: mockFn };
  const pronote = { credentials };
  const api = { pronote };
  mockGetTreaty.mockReturnValue({ api });
  return mockFn;
}

describe('PronoteCredentialsSync', () => {
  describe('pushToServer', () => {
    it('should call PUT with credentials', async () => {
      const mockPut = setupMock('put', { data: { success: true }, error: null });

      const result = await typed.pushToServer({
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
      setupMock('get', {
        data: {
          token: 'server-token',
          metadata: '{"instanceUrl":"https://demo.pronote.fr","username":"jean","deviceUuid":"dev-1","accountKind":1}',
          tokenExpiresAt: '2026-04-01T00:00:00Z',
        },
        error: null,
      });

      const result = await typed.pullFromServer();

      expect(result).not.toBeNull();
      expect(result?.token).toBe('server-token');
      expect(result?.metadata.instanceUrl).toBe('https://demo.pronote.fr');
    });

    it('should return null on error', async () => {
      setupMock('get', {
        data: null,
        error: { status: 404, value: { message: 'Not found' } },
      });

      const result = await typed.pullFromServer();

      expect(result).toBeNull();
    });
  });

  describe('removeFromServer', () => {
    it('should call DELETE', async () => {
      const mockDelete = setupMock('delete', { data: { success: true }, error: null });

      const result = await typed.removeFromServer();

      expect(result).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});
