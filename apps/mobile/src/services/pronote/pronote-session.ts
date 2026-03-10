import {
  createSessionHandle,
  loginQrCode,
  loginToken,
  type SessionHandle,
} from 'pawnote';
import * as SecureStore from 'expo-secure-store';
import type {
  QrCodeData,
  PronoteMetadata,
  PronoteResource,
  PronoteConnectionResult,
} from './pronote-types';

const PRONOTE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ' +
  'PRONOTE Mobile APP Version/2.0.11';

const pronoteFetcher = async (request: {
  url: URL;
  method?: 'GET' | 'POST';
  headers?: Record<string, string> | Headers;
  content?: string;
  redirect?: 'follow' | 'manual';
}): Promise<{
  content: string;
  status: number;
  headers: Record<string, string>;
}> => {
  const rawHeaders =
    request.headers instanceof Headers
      ? Object.fromEntries(request.headers.entries())
      : request.headers ?? {};

  const response = await fetch(request.url.toString(), {
    method: request.method ?? 'GET',
    headers: { ...rawHeaders, 'User-Agent': PRONOTE_USER_AGENT },
    body: request.method === 'POST' ? request.content : undefined,
    redirect: request.redirect ?? 'follow',
  });

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  return {
    content: await response.text(),
    status: response.status,
    headers: responseHeaders,
  };
};

function tokenKey(userId: string): string {
  return `pronote_token_${userId}`;
}

class PronoteSessionService {
  async connectWithQrCode(
    userId: string,
    qrData: QrCodeData,
    pin: string,
    deviceUuid: string,
  ): Promise<PronoteConnectionResult> {
    try {
      const handle = createSessionHandle(pronoteFetcher);

      const refreshInfo = await loginQrCode(handle, {
        deviceUUID: deviceUuid,
        pin,
        qr: {
          jeton: qrData.jeton,
          login: qrData.login,
          url: qrData.url,
        },
      });

      await SecureStore.setItemAsync(tokenKey(userId), refreshInfo.token);

      const resources: PronoteResource[] = handle.user.resources.map((r) => ({
        name: r.name,
        id: r.id,
        className: r.className,
      }));

      return { success: true, resources };
    } catch (error: unknown) {
      return { success: false, error: this.mapError(error) };
    }
  }

  async refreshSession(
    userId: string,
    metadata: PronoteMetadata,
  ): Promise<SessionHandle | null> {
    const token = await SecureStore.getItemAsync(tokenKey(userId));
    if (!token) return null;

    try {
      const handle = createSessionHandle(pronoteFetcher);

      const refreshInfo = await loginToken(handle, {
        url: metadata.instanceUrl,
        kind: metadata.accountKind,
        username: metadata.username,
        deviceUUID: metadata.deviceUuid,
        token,
      });

      await SecureStore.setItemAsync(tokenKey(userId), refreshInfo.token);

      return handle;
    } catch {
      return null;
    }
  }

  async disconnect(userId: string): Promise<void> {
    await SecureStore.deleteItemAsync(tokenKey(userId));
  }

  private mapError(error: unknown): string {
    if (!(error instanceof Error)) {
      return 'Erreur inconnue';
    }

    const msg = error.message || error.name || '';

    if (msg.includes('BadCredentials')) {
      return 'Code PIN incorrect ou identifiants invalides';
    }
    if (msg.includes('SessionExpired')) {
      return 'QR code expiré, veuillez en générer un nouveau';
    }
    if (msg.includes('NetworkError') || msg.includes('fetch')) {
      return 'Impossible de contacter le serveur Pronote';
    }

    return `Erreur Pronote : ${msg}`;
  }
}

export const pronoteSessionService = new PronoteSessionService();
