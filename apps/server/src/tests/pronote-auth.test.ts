/**
 * Tests unitaires - Pronote Auth Service (services/pronote/pronote-auth.service.ts)
 * Mock: DB (Drizzle v1 query syntax), pawnote, encryption, cache, session pool
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';
import { makeParentUser } from './_helpers/fixtures';

// ============================================
// MOCKS
// ============================================

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

// DB mock state
let queryUserFindFirstResult: Record<string, unknown> | null = null;
let queryConnectionFindFirstResult: Record<string, unknown> | null = null;
let queryChildMappingFindFirstResult: Record<string, unknown> | null = null;
let insertCalled = false;
let deleteCalled = false;

const mockDbDelete = mock(() => ({
  where: mock(async () => {
    deleteCalled = true;
    return { rowCount: 1 };
  }),
}));

const mockDbInsert = mock(() => ({
  values: mock(async () => {
    insertCalled = true;
    return {};
  }),
}));

mock.module('../db/connection', () => ({
  db: {
    query: {
      user: {
        findFirst: mock(async () => queryUserFindFirstResult),
      },
      pronoteConnections: {
        findFirst: mock(async () => queryConnectionFindFirstResult),
      },
      pronoteChildMappings: {
        findFirst: mock(async () => queryChildMappingFindFirstResult),
      },
    },
    delete: mockDbDelete,
    insert: mockDbInsert,
    update: mock(() => ({
      set: mock(() => ({
        where: mock(async () => ({})),
      })),
    })),
  },
}));

mock.module('../db/schema', () => ({
  pronoteConnections: { parentId: 'parentId', id: 'id' },
  pronoteChildMappings: { connectionId: 'connectionId' },
}));

mock.module('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
}));

mock.module('../lib/encryption', () => ({
  encrypt: mock(async (val: string) => `encrypted:${val}`),
  decrypt: mock(async (val: string) => val.replace('encrypted:', '')),
}));

// Cache mock
const mockCacheService = {
  invalidateByPattern: mock(() => {}),
};
mock.module('../services/memory-cache.service', () => ({
  cacheService: mockCacheService,
}));

// Pawnote mock state
let loginQrCodeResult: Record<string, unknown> = {
  token: 'refresh-token-123',
  url: 'https://demo.index-education.net/pronote/',
  username: 'parent.dupont',
  kind: 2, // AccountKind.PARENT
};
let loginQrCodeShouldThrow: Error | null = null;

const mockSessionUser = {
  resources: [
    { name: 'Marie Dupont', id: 'res-1', className: '3emeA' },
    { name: 'Jean Dupont', id: 'res-2', className: '6emeB' },
  ],
};

const mockSession = {
  user: mockSessionUser,
};

mock.module('pawnote', () => ({
  createSessionHandle: mock(() => mockSession),
  loginQrCode: mock(async () => {
    if (loginQrCodeShouldThrow) throw loginQrCodeShouldThrow;
    return loginQrCodeResult;
  }),
  loginToken: mock(async () => loginQrCodeResult),
  use: mock(() => {}),
  AccountKind: { PARENT: 2, STUDENT: 1 },
}));

// Pronote shared
mock.module('./pronote-shared', () => ({
  TOKEN_EXPIRY_MS: 300_000,
  TOKEN_REFRESH_BUFFER_MS: 30_000,
  SESSION_POOL_TTL_MS: 240_000,
  PRONOTE_CACHE: { PREFIX: 'pronote:' },
  isAllowedPronoteUrl: (url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
      const hostname = parsed.hostname.toLowerCase();
      return ['index-education.net'].some(d => hostname === d || hostname.endsWith(`.${d}`));
    } catch {
      return false;
    }
  },
  pronoteFetcher: mock(() => Promise.resolve({ content: '', status: 200, headers: new Headers() })),
}));

// Session pool mock
mock.module('./pronote-session-pool', () => ({
  createSessionFromConnection: mock(async () => mockSession),
  removePooledSession: mock(() => {}),
  getPooledSession: mock(() => null),
  setPooledSession: mock(() => {}),
}));

// Import after mocks
const { pronoteAuthService } = await import('../services/pronote/pronote-auth.service');

beforeEach(() => {
  queryUserFindFirstResult = null;
  queryConnectionFindFirstResult = null;
  queryChildMappingFindFirstResult = null;
  insertCalled = false;
  deleteCalled = false;
  loginQrCodeShouldThrow = null;
  loginQrCodeResult = {
    token: 'refresh-token-123',
    url: 'https://demo.index-education.net/pronote/',
    username: 'parent.dupont',
    kind: 2,
  };
  mockCacheService.invalidateByPattern.mockReset();
});

// ============================================
// TESTS
// ============================================

describe('PronoteAuthService', () => {
  describe('connectParentWithQrCode', () => {
    const validQrJson = JSON.stringify({
      jeton: 'token123',
      login: 'parent.dupont',
      url: 'https://demo.index-education.net/pronote/',
    });

    it('should reject empty establishment name', async () => {
      const result = await pronoteAuthService.connectParentWithQrCode(
        'parent-001', '', validQrJson, '1234'
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('requis');
    });

    it('should reject non-parent user', async () => {
      queryUserFindFirstResult = { ...makeParentUser(), role: 'student' };
      const result = await pronoteAuthService.connectParentWithQrCode(
        'parent-001', 'College Test', validQrJson, '1234'
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('parents');
    });

    it('should reject user not found', async () => {
      queryUserFindFirstResult = null;
      const result = await pronoteAuthService.connectParentWithQrCode(
        'parent-001', 'College Test', validQrJson, '1234'
      );
      expect(result.success).toBe(false);
    });

    it('should reject invalid JSON in QR code', async () => {
      queryUserFindFirstResult = makeParentUser();
      const result = await pronoteAuthService.connectParentWithQrCode(
        'parent-001', 'College Test', 'not-json', '1234'
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('JSON');
    });

    it('should reject QR code missing required fields', async () => {
      queryUserFindFirstResult = makeParentUser();
      const result = await pronoteAuthService.connectParentWithQrCode(
        'parent-001', 'College Test', JSON.stringify({ jeton: 'x' }), '1234'
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('manquantes');
    });

    it('should reject non-allowed URL (SSRF protection)', async () => {
      queryUserFindFirstResult = makeParentUser();
      const maliciousQr = JSON.stringify({
        jeton: 'tok', login: 'user', url: 'https://evil.com/pronote/',
      });
      const result = await pronoteAuthService.connectParentWithQrCode(
        'parent-001', 'College', maliciousQr, '1234'
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('non autorisée');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should reject invalid PIN format', async () => {
      queryUserFindFirstResult = makeParentUser();
      const result = await pronoteAuthService.connectParentWithQrCode(
        'parent-001', 'College Test', validQrJson, '12'
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('4 chiffres');
    });

    it('should handle BadCredentials error from pawnote', async () => {
      queryUserFindFirstResult = makeParentUser();
      loginQrCodeShouldThrow = new Error('BadCredentials');
      const result = await pronoteAuthService.connectParentWithQrCode(
        'parent-001', 'College Test', validQrJson, '1234'
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('PIN incorrect');
    });

    it('should handle SessionExpired error', async () => {
      queryUserFindFirstResult = makeParentUser();
      loginQrCodeShouldThrow = new Error('SessionExpired');
      const result = await pronoteAuthService.connectParentWithQrCode(
        'parent-001', 'College Test', validQrJson, '1234'
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('expiré');
    });

    it('should handle network connection errors', async () => {
      queryUserFindFirstResult = makeParentUser();
      loginQrCodeShouldThrow = new Error('Unable to connect');
      const result = await pronoteAuthService.connectParentWithQrCode(
        'parent-001', 'College Test', validQrJson, '1234'
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('contacter le serveur');
    });

    it('should reject non-parent account kind', async () => {
      queryUserFindFirstResult = makeParentUser();
      loginQrCodeResult = { ...loginQrCodeResult, kind: 1 }; // STUDENT
      const result = await pronoteAuthService.connectParentWithQrCode(
        'parent-001', 'College Test', validQrJson, '1234'
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('PARENT');
    });

    it('should succeed and return resources on valid connection', async () => {
      queryUserFindFirstResult = makeParentUser();
      queryConnectionFindFirstResult = null;

      const result = await pronoteAuthService.connectParentWithQrCode(
        'parent-001', 'College Test', validQrJson, '1234'
      );

      expect(result.success).toBe(true);
      expect(result.establishmentName).toBe('College Test');
      expect(result.resources?.length).toBe(2);
      expect(result.resources?.[0]?.name).toBe('Marie Dupont');
    });

    it('should replace existing connection on reconnect', async () => {
      queryUserFindFirstResult = makeParentUser();
      queryConnectionFindFirstResult = { id: 'old-conn-001', parentId: 'parent-001' };

      const result = await pronoteAuthService.connectParentWithQrCode(
        'parent-001', 'College Test', validQrJson, '1234'
      );

      expect(result.success).toBe(true);
      expect(deleteCalled).toBe(true);
    });
  });

  describe('createChildMappings', () => {
    it('should fail when no connection exists', async () => {
      queryConnectionFindFirstResult = null;
      const result = await pronoteAuthService.createChildMappings('parent-001', []);
      expect(result.success).toBe(false);
      expect(result.error).toContain('non trouvée');
    });

    it('should create mappings for valid children', async () => {
      queryConnectionFindFirstResult = { id: 'conn-001' };
      queryUserFindFirstResult = { id: 'child-001', parentId: 'parent-001' };

      const result = await pronoteAuthService.createChildMappings('parent-001', [
        { childId: 'child-001', resourceIndex: 0, pronoteChildName: 'Marie' },
      ]);

      expect(result.success).toBe(true);
    });

    it('should skip invalid child mappings', async () => {
      queryConnectionFindFirstResult = { id: 'conn-001' };
      queryUserFindFirstResult = null;

      const result = await pronoteAuthService.createChildMappings('parent-001', [
        { childId: 'invalid-child', resourceIndex: 0, pronoteChildName: 'Test' },
      ]);

      expect(result.success).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('disconnectParent', () => {
    it('should disconnect and invalidate caches', async () => {
      queryConnectionFindFirstResult = {
        id: 'conn-001',
        childMappings: [{ childId: 'child-001' }],
      };

      const result = await pronoteAuthService.disconnectParent('parent-001');
      expect(result).toBe(true);
      expect(mockCacheService.invalidateByPattern).toHaveBeenCalled();
    });

    it('should succeed even when no connection exists', async () => {
      queryConnectionFindFirstResult = null;
      const result = await pronoteAuthService.disconnectParent('parent-001');
      expect(result).toBe(true);
    });
  });

  describe('getParentConnectionStatus', () => {
    it('should return not connected when no connection', async () => {
      queryConnectionFindFirstResult = null;
      const status = await pronoteAuthService.getParentConnectionStatus('parent-001');
      expect(status.connected).toBe(false);
    });

    it('should return connected status with details', async () => {
      queryConnectionFindFirstResult = {
        status: 'active',
        establishmentName: 'College Test',
        pronoteResources: [{ name: 'Marie', id: 'r1', className: '3A' }],
        lastSyncAt: new Date(),
        lastError: null,
        childMappings: [],
      };

      const status = await pronoteAuthService.getParentConnectionStatus('parent-001');
      expect(status.connected).toBe(true);
      expect(status.establishmentName).toBe('College Test');
    });

    it('should return disconnected when status is not active', async () => {
      queryConnectionFindFirstResult = {
        status: 'expired',
        establishmentName: 'College Test',
        pronoteResources: [],
        lastSyncAt: null,
        lastError: 'Token expired',
        childMappings: [],
      };

      const status = await pronoteAuthService.getParentConnectionStatus('parent-001');
      expect(status.connected).toBe(false);
      expect(status.status).toBe('expired');
    });
  });

  describe('getChildPronoteStatus', () => {
    it('should return not connected when no mapping', async () => {
      queryChildMappingFindFirstResult = null;
      const status = await pronoteAuthService.getChildPronoteStatus('child-001');
      expect(status.isConnected).toBe(false);
    });

    it('should return connected with details', async () => {
      queryChildMappingFindFirstResult = {
        childId: 'child-001',
        pronoteChildName: 'Marie Dupont',
        pronoteClassName: '3emeA',
        connection: {
          status: 'active',
          establishmentName: 'College Test',
        },
      };

      const status = await pronoteAuthService.getChildPronoteStatus('child-001');
      expect(status.isConnected).toBe(true);
      expect(status.establishmentName).toBe('College Test');
      expect(status.pronoteChildName).toBe('Marie Dupont');
    });

    it('should return not connected when connection is inactive', async () => {
      queryChildMappingFindFirstResult = {
        childId: 'child-001',
        connection: { status: 'expired' },
      };

      const status = await pronoteAuthService.getChildPronoteStatus('child-001');
      expect(status.isConnected).toBe(false);
    });
  });

  describe('getChildMappings', () => {
    it('should return empty when no connection', async () => {
      queryConnectionFindFirstResult = null;
      const result = await pronoteAuthService.getChildMappings('parent-001');
      expect(result).toEqual([]);
    });

    it('should return formatted mappings', async () => {
      queryConnectionFindFirstResult = {
        id: 'conn-001',
        childMappings: [
          {
            childId: 'child-001',
            resourceIndex: 0,
            pronoteChildName: 'Marie Dupont',
            pronoteClassName: '3emeA',
            child: { firstName: 'Marie', lastName: 'Dupont' },
          },
        ],
      };

      const result = await pronoteAuthService.getChildMappings('parent-001');
      expect(result.length).toBe(1);
      expect(result[0]?.childName).toBe('Marie Dupont');
      expect(result[0]?.pronoteClassName).toBe('3emeA');
    });
  });

  describe('invalidateChildCache', () => {
    it('should invalidate homework, grades, and timetable caches', () => {
      pronoteAuthService.invalidateChildCache('child-001');
      expect(mockCacheService.invalidateByPattern).toHaveBeenCalledTimes(3);
    });
  });
});
