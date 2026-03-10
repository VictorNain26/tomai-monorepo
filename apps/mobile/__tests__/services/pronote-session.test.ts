import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockLoginQrCode = jest.fn();
const mockLoginToken = jest.fn();
const mockCreateSessionHandle = jest.fn();

jest.mock('pawnote', () => ({
  loginQrCode: mockLoginQrCode,
  loginToken: mockLoginToken,
  createSessionHandle: mockCreateSessionHandle,
  AccountKind: { PARENT: 7, STUDENT: 6 },
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

type SessionService = {
  connectWithQrCode: (
    userId: string,
    qrData: { jeton: string; login: string; url: string },
    pin: string,
    deviceUuid: string,
  ) => Promise<{ success: boolean; error?: string; resources?: { name: string; id: string; className?: string }[] }>;
  refreshSession: (
    userId: string,
    metadata: { instanceUrl: string; username: string; deviceUuid: string; accountKind: number },
  ) => Promise<unknown>;
  disconnect: (userId: string) => Promise<void>;
};

const typedService = service as SessionService;

describe('PronoteSessionService', () => {
  describe('connectWithQrCode', () => {
    it('should login and store token in SecureStore', async () => {
      const mockHandle = {
        user: {
          resources: [
            { name: 'Jean Dupont', id: '12345', className: '3eA' },
          ],
        },
        instance: { url: 'https://demo.pronote.fr' },
      };
      const mockRefreshInfo = {
        token: 'next-token-abc',
        url: 'https://demo.pronote.fr',
        username: 'jean',
        kind: 6,
        navigatorIdentifier: 'mobile',
      };

      mockCreateSessionHandle.mockReturnValue(mockHandle);
      mockLoginQrCode.mockResolvedValue(mockRefreshInfo);

      const result = await typedService.connectWithQrCode(
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
      mockCreateSessionHandle.mockReturnValue({ user: { resources: [] }, instance: {} });
      const error = new Error('BadCredentials');
      error.name = 'BadCredentialsError';
      mockLoginQrCode.mockRejectedValue(error);

      const result = await typedService.connectWithQrCode(
        'user-1',
        { jeton: 'j', login: 'l', url: 'https://x.fr' },
        '0000',
        'dev-1',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('PIN incorrect');
    });

    it('should handle SessionExpired error', async () => {
      mockCreateSessionHandle.mockReturnValue({ user: { resources: [] }, instance: {} });
      const error = new Error('SessionExpired');
      error.name = 'SessionExpiredError';
      mockLoginQrCode.mockRejectedValue(error);

      const result = await typedService.connectWithQrCode(
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
      const mockRefreshInfo = {
        token: 'refreshed-token',
        url: 'https://demo.pronote.fr',
        username: 'jean',
        kind: 6,
        navigatorIdentifier: 'mobile',
      };
      const mockHandle = {
        user: { resources: [] },
        instance: { url: 'https://demo.pronote.fr' },
      };

      mockCreateSessionHandle.mockReturnValue(mockHandle);
      mockLoginToken.mockResolvedValue(mockRefreshInfo);

      const session = await typedService.refreshSession('user-1', {
        instanceUrl: 'https://demo.pronote.fr',
        username: 'jean',
        deviceUuid: 'dev-1',
        accountKind: 6,
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

      const session = await typedService.refreshSession('user-1', {
        instanceUrl: 'https://demo.pronote.fr',
        username: 'jean',
        deviceUuid: 'dev-1',
        accountKind: 6,
      });

      expect(session).toBeNull();
    });
  });

  describe('disconnect', () => {
    it('should clear SecureStore token', async () => {
      await typedService.disconnect('user-1');

      expect(mockDeleteItemAsync).toHaveBeenCalledWith('pronote_token_user-1');
    });
  });
});
