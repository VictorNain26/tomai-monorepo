import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockLoginQrCode = jest.fn();
const mockLoginToken = jest.fn();
const mockCreateSessionHandle = jest.fn();

jest.mock('pawnote', () => ({
  loginQrCode: mockLoginQrCode,
  loginToken: mockLoginToken,
  createSessionHandle: mockCreateSessionHandle,
  AccountKind: { PARENT: 2, STUDENT: 1 },
}));

const mockSetItemAsync = jest.fn();
const mockGetItemAsync = jest.fn();
const mockDeleteItemAsync = jest.fn();

jest.mock('expo-secure-store', () => ({
  setItemAsync: mockSetItemAsync,
  getItemAsync: mockGetItemAsync,
  deleteItemAsync: mockDeleteItemAsync,
}));

beforeEach(() => jest.clearAllMocks());

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { pronoteSessionService: service } = require('@/services/pronote/pronote-session');

describe('PronoteSessionService', () => {
  describe('connectWithQrCode', () => {
    it('should login and store token in SecureStore', async () => {
      const mockSession = {
        instance: { url: 'https://demo.pronote.fr' },
        user: {
          resources: [
            { name: 'Jean Dupont', id: '12345', className: '3eA' },
          ],
        },
        getNextToken: jest.fn().mockReturnValue('next-token-abc'),
      };
      const mockHandle = { id: 'handle-1' };

      mockCreateSessionHandle.mockReturnValue(mockHandle);
      mockLoginQrCode.mockResolvedValue(mockSession);

      const result = await (service as { connectWithQrCode: (...args: unknown[]) => Promise<{ success: boolean; resources?: { name: string; id: string; className?: string }[] }> }).connectWithQrCode(
        'user-1',
        { jeton: 'qr-jeton', login: 'qr-login', url: 'https://demo.pronote.fr' },
        '1234',
        'device-uuid-1',
      );

      expect(result.success).toBe(true);
      expect(result.resources).toEqual([
        { name: 'Jean Dupont', id: '12345', className: '3eA' },
      ]);
      expect(mockSetItemAsync).toHaveBeenCalledWith(
        'pronote_token_user-1',
        'next-token-abc',
      );
      expect(mockCreateSessionHandle).toHaveBeenCalled();
      expect(mockLoginQrCode).toHaveBeenCalled();
    });

    it('should handle BadCredentials error', async () => {
      mockCreateSessionHandle.mockReturnValue({ id: 'handle' });
      mockLoginQrCode.mockRejectedValue(new Error('BadCredentials'));

      const result = await (service as { connectWithQrCode: (...args: unknown[]) => Promise<{ success: boolean; error?: string }> }).connectWithQrCode(
        'user-1',
        { jeton: 'j', login: 'l', url: 'https://x.fr' },
        '0000',
        'dev-1',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('PIN incorrect');
    });

    it('should handle SessionExpired error', async () => {
      mockCreateSessionHandle.mockReturnValue({ id: 'handle' });
      mockLoginQrCode.mockRejectedValue(new Error('SessionExpired'));

      const result = await (service as { connectWithQrCode: (...args: unknown[]) => Promise<{ success: boolean; error?: string }> }).connectWithQrCode(
        'user-1',
        { jeton: 'j', login: 'l', url: 'https://x.fr' },
        '0000',
        'dev-1',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('QR code expir');
    });
  });

  describe('refreshSession', () => {
    it('should restore session from SecureStore token', async () => {
      mockGetItemAsync.mockResolvedValue('stored-token');
      const mockSession = {
        instance: { url: 'https://demo.pronote.fr' },
        getNextToken: jest.fn().mockReturnValue('refreshed-token'),
      };
      const mockHandle = { id: 'handle-2' };

      mockCreateSessionHandle.mockReturnValue(mockHandle);
      mockLoginToken.mockResolvedValue(mockSession);

      const session = await (service as { refreshSession: (...args: unknown[]) => Promise<unknown> }).refreshSession('user-1', {
        instanceUrl: 'https://demo.pronote.fr',
        username: 'jean',
        deviceUuid: 'dev-1',
        accountKind: 1,
      });

      expect(session).not.toBeNull();
      expect(mockGetItemAsync).toHaveBeenCalledWith('pronote_token_user-1');
      expect(mockLoginToken).toHaveBeenCalled();
      expect(mockSetItemAsync).toHaveBeenCalledWith(
        'pronote_token_user-1',
        'refreshed-token',
      );
    });

    it('should return null when no stored token', async () => {
      mockGetItemAsync.mockResolvedValue(null);

      const session = await (service as { refreshSession: (...args: unknown[]) => Promise<unknown> }).refreshSession('user-1', {
        instanceUrl: 'https://demo.pronote.fr',
        username: 'jean',
        deviceUuid: 'dev-1',
        accountKind: 1,
      });

      expect(session).toBeNull();
    });
  });

  describe('disconnect', () => {
    it('should clear SecureStore token', async () => {
      await (service as { disconnect: (userId: string) => Promise<void> }).disconnect('user-1');

      expect(mockDeleteItemAsync).toHaveBeenCalledWith('pronote_token_user-1');
    });
  });
});
