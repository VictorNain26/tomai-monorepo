# Pronote Device-First Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate Pronote integration from server-side to device-first architecture, eliminating RGPD exposure while keeping AI chat context and dashboard features.

**Architecture:** Mobile device calls Pronote directly via pawnote. Server stores encrypted credentials for multi-device sync only. Chat receives Pronote context in message body. Age-gated at 15 years (CNIL).

**Tech Stack:** pawnote 1.6.2 (mobile), expo-secure-store (tokens), react-native-mmkv + zustand (state/cache), Elysia.js (sync API), Drizzle ORM (DB migration)

---

## Phase 1: Server Cleanup (delete old, add sync)

### Task 1: Delete server-side Pronote services and routes

**Files:**
- Delete: `apps/server/src/services/pronote/pronote-search.service.ts`
- Delete: `apps/server/src/services/pronote/pronote-data.service.ts`
- Delete: `apps/server/src/services/pronote/pronote-auth.service.ts`
- Delete: `apps/server/src/services/pronote/pronote-session-pool.ts`
- Delete: `apps/server/src/services/pronote/pronote-shared.ts`
- Delete: `apps/server/src/services/pronote/index.ts`
- Delete: `apps/server/src/services/pronote.service.ts`
- Delete: `apps/server/src/routes/pronote/pronote-parent.routes.ts`
- Delete: `apps/server/src/routes/pronote/pronote-student.routes.ts`
- Delete: `apps/server/src/routes/pronote/pronote-public.routes.ts`
- Delete: `apps/server/src/routes/pronote.routes.ts`
- Delete: `apps/server/src/tests/pronote-auth.test.ts`

**Step 1: Delete all files**

```bash
cd apps/server
rm -f src/services/pronote/pronote-search.service.ts
rm -f src/services/pronote/pronote-data.service.ts
rm -f src/services/pronote/pronote-auth.service.ts
rm -f src/services/pronote/pronote-session-pool.ts
rm -f src/services/pronote/pronote-shared.ts
rm -f src/services/pronote/index.ts
rm -f src/services/pronote.service.ts
rm -f src/routes/pronote/pronote-parent.routes.ts
rm -f src/routes/pronote/pronote-student.routes.ts
rm -f src/routes/pronote/pronote-public.routes.ts
rm -f src/routes/pronote.routes.ts
rm -f src/tests/pronote-auth.test.ts
rmdir src/services/pronote src/routes/pronote 2>/dev/null
```

**Step 2: Remove Pronote route from app.ts**

In `apps/server/src/app.ts`:
- Remove line 29: `import { pronoteRoutes } from './routes/pronote.routes.js';`
- Remove line 287: `.use(pronoteRoutes)`

**Step 3: Remove Pronote import from tool-executor.ts**

In `apps/server/src/services/chat/tool-executor.ts`:
- Remove line 9: `import { pronoteService } from '../pronote.service.js';`
- Remove Pronote tools from `RETRYABLE_TOOLS` (lines 30-32): delete `get_student_homework`, `get_student_grades`, `get_student_timetable`
- Replace cases in `executeToolOnce` (lines 109-116) with a message explaining data comes from device context now
- Delete functions `executeGetHomework` (lines 176-197), `executeGetGrades` (lines 199-214), `executeGetTimetable` (lines 216-237)

Replace the 3 Pronote cases in the switch with:

```typescript
case 'get_student_homework':
case 'get_student_grades':
case 'get_student_timetable':
  return {
    error: true,
    message: "Les donnees Pronote sont fournies dans le contexte de la conversation, pas via un outil.",
  };
```

**Step 4: Remove Pronote tool declarations**

In `apps/server/src/services/chat/tool-declarations.ts`:
- Delete `getStudentHomeworkDeclaration` (lines 48-61)
- Delete `getStudentGradesDeclaration` (lines 63-71)
- Delete `getStudentTimetableDeclaration` (lines 73-86)
- Remove them from `agentToolDeclarations` array (lines 143-145)
- Update file header comment (line 4): remove "7 outils" references, update list

**Step 5: Update tool instructions**

In `apps/server/src/config/prompts/core/tools.ts`:
- Remove line 18: `- Consulte les devoirs/notes Pronote quand l'éleve parle de ses devoirs, ses notes, ou un controle.`
- Add: `- Les donnees Pronote (devoirs, notes, EDT) sont fournies automatiquement dans le contexte. Utilise-les directement sans appeler d'outil.`

**Step 6: Remove pawnote dependency from server**

```bash
cd apps/server && bun remove pawnote
```

**Step 7: Verify typecheck passes**

```bash
cd apps/server && bun run typecheck
```

Fix any remaining import errors. The `pronote.schema.ts` and DB schema still exist — they'll be migrated in Task 3.

**Step 8: Commit**

```bash
git add -A && git commit -m "refactor(server): remove server-side Pronote services, routes, and tools

Device-first architecture: Pronote calls move to mobile device.
Server no longer makes any Pronote API calls."
```

---

### Task 2: Write failing tests for credential sync API (TDD Red)

**Files:**
- Create: `apps/server/src/tests/pronote-sync.test.ts`
- Reference: `apps/server/src/tests/_helpers/fixtures.ts`
- Reference: `apps/server/src/tests/_helpers/mock-logger.ts`

**Step 1: Write the test file**

```typescript
/**
 * Tests - Pronote Credential Sync API
 * TDD: Red phase — these tests define the contract for the sync endpoints.
 *
 * Endpoints:
 * - PUT /api/pronote/credentials — upsert encrypted credentials
 * - GET /api/pronote/credentials — fetch encrypted credentials
 * - DELETE /api/pronote/credentials — delete credentials
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';
import { makeParentUser, makeUser } from './_helpers/fixtures';

// ============================================
// MOCKS
// ============================================

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

let queryCredentialsFindFirstResult: Record<string, unknown> | null = null;
let insertCalled = false;
let updateCalled = false;
let deleteCalled = false;

const mockDbUpdate = mock(() => ({
  set: mock(() => ({
    where: mock(async () => {
      updateCalled = true;
      return { rowCount: 1 };
    }),
  })),
}));

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
      pronoteCredentials: {
        findFirst: mock(async () => queryCredentialsFindFirstResult),
      },
    },
    insert: mockDbInsert,
    update: mockDbUpdate,
    delete: mockDbDelete,
  },
}));

mock.module('../db/schema', () => ({
  pronoteCredentials: { userId: 'userId', id: 'id' },
}));

mock.module('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  relations: () => ({}),
  sql: Object.assign(
    (...args: unknown[]) => ({ type: 'sql', args }),
    { raw: (s: string) => s }
  ),
}));

mock.module('../lib/encryption', () => ({
  encrypt: mock(async (val: string) => `encrypted:${val}`),
  decrypt: mock(async (val: string) => val.replace('encrypted:', '')),
}));

// Import after mocks
const { pronoteSyncService } = await import(
  '../services/pronote-sync.service'
);

beforeEach(() => {
  queryCredentialsFindFirstResult = null;
  insertCalled = false;
  updateCalled = false;
  deleteCalled = false;
});

// ============================================
// TESTS
// ============================================

describe('PronoteSyncService', () => {
  describe('upsertCredentials', () => {
    it('should create new credentials when none exist', async () => {
      queryCredentialsFindFirstResult = null;

      const result = await pronoteSyncService.upsertCredentials('user-001', {
        token: 'refresh-token-123',
        metadata: JSON.stringify({
          instanceUrl: 'https://demo.index-education.net/pronote/',
          username: 'parent.dupont',
          deviceUuid: 'uuid-123',
          accountKind: 2,
        }),
        tokenExpiresAt: new Date(Date.now() + 300_000).toISOString(),
      });

      expect(result.success).toBe(true);
      expect(insertCalled).toBe(true);
    });

    it('should update existing credentials', async () => {
      queryCredentialsFindFirstResult = { id: 'cred-001', userId: 'user-001' };

      const result = await pronoteSyncService.upsertCredentials('user-001', {
        token: 'new-token',
        metadata: JSON.stringify({ instanceUrl: 'https://test.index-education.net/' }),
        tokenExpiresAt: new Date(Date.now() + 300_000).toISOString(),
      });

      expect(result.success).toBe(true);
      expect(updateCalled).toBe(true);
    });

    it('should reject missing token', async () => {
      const result = await pronoteSyncService.upsertCredentials('user-001', {
        token: '',
        metadata: '{}',
        tokenExpiresAt: new Date().toISOString(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('token');
    });

    it('should reject invalid metadata JSON', async () => {
      const result = await pronoteSyncService.upsertCredentials('user-001', {
        token: 'valid-token',
        metadata: 'not-json',
        tokenExpiresAt: new Date().toISOString(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('metadata');
    });
  });

  describe('getCredentials', () => {
    it('should return null when no credentials exist', async () => {
      queryCredentialsFindFirstResult = null;
      const result = await pronoteSyncService.getCredentials('user-001');
      expect(result).toBeNull();
    });

    it('should return decrypted credentials', async () => {
      queryCredentialsFindFirstResult = {
        id: 'cred-001',
        userId: 'user-001',
        encryptedToken: 'encrypted:my-token',
        encryptedMetadata: 'encrypted:{"instanceUrl":"https://test.net"}',
        tokenExpiresAt: new Date(Date.now() + 300_000),
      };

      const result = await pronoteSyncService.getCredentials('user-001');

      expect(result).not.toBeNull();
      expect(result!.token).toBe('my-token');
      expect(result!.metadata).toContain('instanceUrl');
    });
  });

  describe('deleteCredentials', () => {
    it('should delete credentials', async () => {
      queryCredentialsFindFirstResult = { id: 'cred-001' };

      const result = await pronoteSyncService.deleteCredentials('user-001');

      expect(result).toBe(true);
      expect(deleteCalled).toBe(true);
    });

    it('should return true even when no credentials exist', async () => {
      queryCredentialsFindFirstResult = null;

      const result = await pronoteSyncService.deleteCredentials('user-001');

      expect(result).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd apps/server && bun test src/tests/pronote-sync.test.ts
```

Expected: FAIL — `Cannot find module '../services/pronote-sync.service'`

**Step 3: Commit**

```bash
git add src/tests/pronote-sync.test.ts && git commit -m "test(server): add failing tests for Pronote credential sync service (TDD red)"
```

---

### Task 3: DB migration — replace old tables with pronote_credentials

**Files:**
- Modify: `apps/server/src/db/schema/pronote.schema.ts` (full rewrite)
- Modify: `apps/server/src/db/schema/index.ts` (update imports/relations)

**Step 1: Rewrite pronote.schema.ts**

Replace the entire file with:

```typescript
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { user } from './auth.schema';

/**
 * Pronote credentials sync table
 *
 * Device-first architecture (2026):
 * - Mobile device makes all Pronote API calls via pawnote
 * - Server stores encrypted credentials for multi-device sync only
 * - Server NEVER calls Pronote directly
 *
 * Security:
 * - Token encrypted AES-256-GCM before storage
 * - Metadata (instanceUrl, username, deviceUuid) encrypted separately
 * - Decryption happens on the requesting device
 */
export const pronoteCredentials = pgTable(
  'pronote_credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }).notNull().unique(),
    encryptedToken: text('encrypted_token').notNull(),
    encryptedMetadata: text('encrypted_metadata').notNull(),
    tokenExpiresAt: timestamp('token_expires_at', {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'pronote_credentials_user_id_fkey',
    }).onDelete('cascade'),
  })
);

// Relations
export const pronoteCredentialsRelations = relations(
  pronoteCredentials,
  ({ one }) => ({
    user: one(user, {
      fields: [pronoteCredentials.userId],
      references: [user.id],
    }),
  })
);

// Types
export type PronoteCredential = typeof pronoteCredentials.$inferSelect;
export type NewPronoteCredential = typeof pronoteCredentials.$inferInsert;
```

**Step 2: Update schema/index.ts**

Replace the Pronote-related imports and relations. Change:

```typescript
import { pronoteConnections, pronoteChildMappings } from './pronote.schema';
```

To:

```typescript
import { pronoteCredentials } from './pronote.schema';
```

Update `userRelations` — replace lines 38-45 (old Pronote relations) with:

```typescript
  // Pronote Integration (device-first, server = credential sync only)
  pronoteCredentials: one(pronoteCredentials, {
    fields: [user.id],
    references: [pronoteCredentials.userId],
  }),
```

Update re-export (line 84 stays: `export * from './pronote.schema';`).

**Step 3: Generate migration**

```bash
cd apps/server && bun run db:generate
```

Review generated SQL — should drop old tables and create `pronote_credentials`.

**Step 4: Verify typecheck**

```bash
cd apps/server && bun run typecheck
```

**Step 5: Commit**

```bash
git add src/db/schema/pronote.schema.ts src/db/schema/index.ts drizzle/
git commit -m "refactor(server): replace Pronote tables with single credentials sync table

Drop pronote_connections and pronote_child_mappings.
New pronote_credentials table stores encrypted tokens for multi-device sync only."
```

---

### Task 4: Implement credential sync service (TDD Green)

**Files:**
- Create: `apps/server/src/services/pronote-sync.service.ts`

**Step 1: Write the minimal service**

```typescript
/**
 * Pronote Credential Sync Service
 *
 * Server = encrypted credential vault for multi-device sync.
 * NEVER calls Pronote. Device handles all Pronote API calls.
 */

import { db } from '../db/connection.js';
import { pronoteCredentials } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { encrypt, decrypt } from '../lib/encryption.js';
import { logger } from '../lib/observability.js';

interface UpsertInput {
  token: string;
  metadata: string;
  tokenExpiresAt: string;
}

interface CredentialOutput {
  token: string;
  metadata: string;
  tokenExpiresAt: string;
}

class PronoteSyncService {
  async upsertCredentials(
    userId: string,
    input: UpsertInput
  ): Promise<{ success: boolean; error?: string }> {
    if (!input.token?.trim()) {
      return { success: false, error: 'Token requis' };
    }

    try {
      JSON.parse(input.metadata);
    } catch {
      return { success: false, error: 'Metadata JSON invalide' };
    }

    try {
      const encryptedToken = await encrypt(input.token);
      const encryptedMetadata = await encrypt(input.metadata);
      const tokenExpiresAt = new Date(input.tokenExpiresAt);

      const existing = await db.query.pronoteCredentials.findFirst({
        where: eq(pronoteCredentials.userId, userId),
      });

      if (existing) {
        await db
          .update(pronoteCredentials)
          .set({
            encryptedToken,
            encryptedMetadata,
            tokenExpiresAt,
            updatedAt: new Date(),
          })
          .where(eq(pronoteCredentials.userId, userId));
      } else {
        await db.insert(pronoteCredentials).values({
          userId,
          encryptedToken,
          encryptedMetadata,
          tokenExpiresAt,
        });
      }

      logger.info('Pronote credentials synced', {
        operation: 'pronote:sync:upsert',
        userId,
      });

      return { success: true };
    } catch (error) {
      logger.error('Pronote credentials sync error', {
        operation: 'pronote:sync:error',
        userId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      return { success: false, error: 'Erreur interne' };
    }
  }

  async getCredentials(userId: string): Promise<CredentialOutput | null> {
    const record = await db.query.pronoteCredentials.findFirst({
      where: eq(pronoteCredentials.userId, userId),
    });

    if (!record) return null;

    const token = await decrypt(record.encryptedToken);
    const metadata = await decrypt(record.encryptedMetadata);

    return {
      token,
      metadata,
      tokenExpiresAt: record.tokenExpiresAt.toISOString(),
    };
  }

  async deleteCredentials(userId: string): Promise<boolean> {
    try {
      await db
        .delete(pronoteCredentials)
        .where(eq(pronoteCredentials.userId, userId));

      logger.info('Pronote credentials deleted', {
        operation: 'pronote:sync:delete',
        userId,
      });

      return true;
    } catch (error) {
      logger.error('Pronote credentials delete error', {
        operation: 'pronote:sync:delete:error',
        userId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      return false;
    }
  }
}

export const pronoteSyncService = new PronoteSyncService();
```

**Step 2: Run tests**

```bash
cd apps/server && bun test src/tests/pronote-sync.test.ts
```

Expected: ALL PASS

**Step 3: Commit**

```bash
git add src/services/pronote-sync.service.ts
git commit -m "feat(server): implement Pronote credential sync service (TDD green)"
```

---

### Task 5: Add sync API routes

**Files:**
- Create: `apps/server/src/routes/pronote-sync.routes.ts`
- Modify: `apps/server/src/app.ts` (register new route)

**Step 1: Create route file**

```typescript
/**
 * Pronote Credential Sync Routes
 *
 * Encrypted credential vault for multi-device sync.
 * PUT: upsert credentials | GET: fetch credentials | DELETE: remove credentials
 */

import { Elysia, t } from 'elysia';
import { auth } from '../lib/auth.js';
import { pronoteSyncService } from '../services/pronote-sync.service.js';

export const pronoteSyncRoutes = new Elysia({ prefix: '/api/pronote' })
  .derive(async ({ request: { headers }, set }) => {
    const session = await auth.api.getSession({ headers });

    if (!session?.user) {
      set.status = 401;
      return { user: null, authError: 'Non authentifie' as const };
    }

    return { user: session.user, authError: null };
  })

  .put(
    '/credentials',
    async ({ body, user, authError, set }) => {
      if (authError || !user) {
        return { error: authError ?? 'Non authentifie' };
      }

      const result = await pronoteSyncService.upsertCredentials(
        user.id,
        body
      );

      if (!result.success) {
        set.status = 400;
        return { error: result.error };
      }

      return { success: true };
    },
    {
      body: t.Object({
        token: t.String({ minLength: 1 }),
        metadata: t.String({ minLength: 2 }),
        tokenExpiresAt: t.String(),
      }),
      detail: {
        tags: ['Pronote'],
        summary: 'Sync Pronote credentials (encrypted vault)',
      },
    }
  )

  .get(
    '/credentials',
    async ({ user, authError, set }) => {
      if (authError || !user) {
        set.status = 401;
        return { error: authError ?? 'Non authentifie' };
      }

      const credentials = await pronoteSyncService.getCredentials(user.id);

      if (!credentials) {
        set.status = 404;
        return { error: 'Aucune credentials Pronote' };
      }

      return credentials;
    },
    {
      detail: {
        tags: ['Pronote'],
        summary: 'Get synced Pronote credentials',
      },
    }
  )

  .delete(
    '/credentials',
    async ({ user, authError }) => {
      if (authError || !user) {
        return { error: authError ?? 'Non authentifie' };
      }

      await pronoteSyncService.deleteCredentials(user.id);
      return { success: true };
    },
    {
      detail: {
        tags: ['Pronote'],
        summary: 'Delete synced Pronote credentials',
      },
    }
  );
```

**Step 2: Register in app.ts**

Add import and `.use(pronoteSyncRoutes)` where the old `.use(pronoteRoutes)` was.

**Step 3: Typecheck + lint**

```bash
cd apps/server && bun run typecheck && bun run lint
```

**Step 4: Commit**

```bash
git add src/routes/pronote-sync.routes.ts src/app.ts
git commit -m "feat(server): add Pronote credential sync API routes (PUT/GET/DELETE)"
```

---

### Task 6: Update chat to accept Pronote context from device

**Files:**
- Modify: `apps/server/src/routes/chat-message.routes.ts` (add pronoteContext to body)
- Modify: `apps/server/src/services/chat/chat-orchestration.service.ts` (pass context to Gemini)

**Step 1: Add pronoteContext to chat body type**

In `apps/server/src/routes/chat-message.routes.ts`, the body destructuring (around line 50) already has a `data` field. Add `pronoteContext` as an optional field in the body schema:

```typescript
const { content, data, pronoteContext } = body as {
  content: string;
  data: {
    subject?: string;
    sessionId?: string;
    schoolLevel?: string;
    firstName?: string;
    fileId?: string;
    fileIds?: string[];
  };
  pronoteContext?: {
    homework?: Array<{ subject: string; description: string; dueDate: string; done: boolean }>;
    recentGrades?: Array<{ subject: string; value: number | null; outOf: number; date: string }>;
    todayTimetable?: Array<{ subject: string; startDate: string; endDate: string; canceled: boolean }>;
  };
};
```

Pass `pronoteContext` through to the orchestration service. The orchestration service should inject it into the Gemini system prompt as structured context (like it already does for file context).

**Step 2: Inject Pronote context into Gemini prompt**

In the orchestration service, when building the system prompt, append:

```typescript
if (pronoteContext) {
  const parts: string[] = [];
  if (pronoteContext.homework?.length) {
    parts.push(`DEVOIRS DE LA SEMAINE:\n${JSON.stringify(pronoteContext.homework)}`);
  }
  if (pronoteContext.recentGrades?.length) {
    parts.push(`DERNIERES NOTES:\n${JSON.stringify(pronoteContext.recentGrades)}`);
  }
  if (pronoteContext.todayTimetable?.length) {
    parts.push(`EDT DU JOUR:\n${JSON.stringify(pronoteContext.todayTimetable)}`);
  }
  // Append to system prompt
  systemPrompt += `\n\n## DONNEES PRONOTE (contexte eleve)\n${parts.join('\n\n')}`;
}
```

**Step 3: Typecheck + test existing chat tests still pass**

```bash
cd apps/server && bun run typecheck && bun test
```

**Step 4: Commit**

```bash
git add -A && git commit -m "feat(server): accept Pronote context from device in chat messages

Chat endpoint now accepts optional pronoteContext in message body.
Data is injected into Gemini prompt, never persisted server-side."
```

---

## Phase 2: Mobile — Pronote Device-First

### Task 7: Install mobile dependencies

**Files:**
- Modify: `apps/mobile/package.json`

**Step 1: Install dependencies**

```bash
cd apps/mobile && pnpm add zustand react-native-mmkv
```

Note: `pawnote`, `expo-secure-store` are already installed.

**Step 2: Verify no native rebuild needed**

`react-native-mmkv` requires native code. Check if a rebuild is needed:

```bash
cd apps/mobile && npx expo-doctor
```

If fingerprint changes, a dev client rebuild will be needed.

**Step 3: Commit**

```bash
git add package.json ../../pnpm-lock.yaml
git commit -m "chore(mobile): add zustand and react-native-mmkv for Pronote device storage"
```

---

### Task 8: Write failing tests for Pronote mobile services (TDD Red)

**Files:**
- Create: `apps/mobile/__tests__/services/pronote-session.test.ts`
- Create: `apps/mobile/__tests__/services/pronote-credentials.test.ts`

**Step 1: Write pronote-session tests**

```typescript
/**
 * Tests - Pronote Session Service (device-side)
 * TDD Red: define contract for pawnote session management on device
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock pawnote
const mockLoginQrCode = jest.fn();
const mockLoginToken = jest.fn();
const mockCreateSessionHandle = jest.fn();

jest.mock('pawnote', () => ({
  loginQrCode: mockLoginQrCode,
  loginToken: mockLoginToken,
  createSessionHandle: mockCreateSessionHandle,
  AccountKind: { PARENT: 2, STUDENT: 1 },
}));

// Mock expo-secure-store
const mockSetItemAsync = jest.fn();
const mockGetItemAsync = jest.fn();
const mockDeleteItemAsync = jest.fn();

jest.mock('expo-secure-store', () => ({
  setItemAsync: mockSetItemAsync,
  getItemAsync: mockGetItemAsync,
  deleteItemAsync: mockDeleteItemAsync,
}));

beforeEach(() => {
  jest.clearAllMocks();
});

// Import after mocks
const { pronoteSessionService } = require('@/services/pronote/pronote-session');

describe('PronoteSessionService', () => {
  describe('connectWithQrCode', () => {
    it('should login and store token in SecureStore', async () => {
      const mockSession = { user: { resources: [{ name: 'Marie', id: 'r1' }] } };
      mockCreateSessionHandle.mockReturnValue(mockSession);
      mockLoginQrCode.mockResolvedValue({
        token: 'refresh-token',
        url: 'https://demo.index-education.net/',
        username: 'parent.dupont',
        kind: 2,
      });

      const result = await pronoteSessionService.connectWithQrCode(
        'user-001',
        { jeton: 'tok', login: 'user', url: 'https://demo.index-education.net/' },
        '1234',
        'uuid-device'
      );

      expect(result.success).toBe(true);
      expect(result.resources).toHaveLength(1);
      expect(mockSetItemAsync).toHaveBeenCalledWith(
        'pronote_token_user-001',
        'refresh-token'
      );
    });

    it('should handle BadCredentials error', async () => {
      mockCreateSessionHandle.mockReturnValue({});
      mockLoginQrCode.mockRejectedValue(new Error('BadCredentials'));

      const result = await pronoteSessionService.connectWithQrCode(
        'user-001',
        { jeton: 'tok', login: 'user', url: 'https://demo.net/' },
        '0000',
        'uuid'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('PIN');
    });

    it('should handle SessionExpired error', async () => {
      mockCreateSessionHandle.mockReturnValue({});
      mockLoginQrCode.mockRejectedValue(new Error('SessionExpired'));

      const result = await pronoteSessionService.connectWithQrCode(
        'user-001',
        { jeton: 'tok', login: 'user', url: 'https://demo.net/' },
        '1234',
        'uuid'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('expire');
    });
  });

  describe('refreshSession', () => {
    it('should restore session from SecureStore token', async () => {
      mockGetItemAsync.mockResolvedValue('stored-token');
      mockCreateSessionHandle.mockReturnValue({ user: { resources: [] } });
      mockLoginToken.mockResolvedValue({
        token: 'new-token',
        url: 'https://demo.net/',
        username: 'user',
        kind: 2,
      });

      const result = await pronoteSessionService.refreshSession('user-001', {
        instanceUrl: 'https://demo.net/',
        username: 'user',
        deviceUuid: 'uuid',
        accountKind: 2,
      });

      expect(result).not.toBeNull();
      expect(mockSetItemAsync).toHaveBeenCalledWith(
        'pronote_token_user-001',
        'new-token'
      );
    });

    it('should return null when no stored token', async () => {
      mockGetItemAsync.mockResolvedValue(null);

      const result = await pronoteSessionService.refreshSession('user-001', {
        instanceUrl: 'https://demo.net/',
        username: 'user',
        deviceUuid: 'uuid',
        accountKind: 2,
      });

      expect(result).toBeNull();
    });
  });

  describe('disconnect', () => {
    it('should clear SecureStore token', async () => {
      await pronoteSessionService.disconnect('user-001');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('pronote_token_user-001');
    });
  });
});
```

**Step 2: Write pronote-credentials sync tests**

```typescript
/**
 * Tests - Pronote Credentials Sync (mobile ↔ server)
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockGet = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();

jest.mock('@repo/api', () => ({
  getTreaty: () => ({
    api: {
      pronote: {
        credentials: {
          get: mockGet,
          put: mockPut,
          delete: mockDelete,
        },
      },
    },
  }),
  unwrap: (val: unknown) => val,
}));

beforeEach(() => jest.clearAllMocks());

const { pronoteCredentialsSync } = require('@/services/pronote/pronote-credentials');

describe('PronoteCredentialsSync', () => {
  describe('pushToServer', () => {
    it('should encrypt and push credentials', async () => {
      mockPut.mockResolvedValue({ success: true });

      const result = await pronoteCredentialsSync.pushToServer({
        token: 'my-token',
        metadata: { instanceUrl: 'https://demo.net/', username: 'user', deviceUuid: 'uuid', accountKind: 2 },
        tokenExpiresAt: new Date().toISOString(),
      });

      expect(result).toBe(true);
      expect(mockPut).toHaveBeenCalled();
    });
  });

  describe('pullFromServer', () => {
    it('should fetch and return credentials', async () => {
      mockGet.mockResolvedValue({
        token: 'server-token',
        metadata: '{"instanceUrl":"https://demo.net/"}',
        tokenExpiresAt: new Date().toISOString(),
      });

      const result = await pronoteCredentialsSync.pullFromServer();

      expect(result).not.toBeNull();
      expect(result!.token).toBe('server-token');
    });

    it('should return null on 404', async () => {
      mockGet.mockRejectedValue({ status: 404 });

      const result = await pronoteCredentialsSync.pullFromServer();
      expect(result).toBeNull();
    });
  });

  describe('removeFromServer', () => {
    it('should delete credentials from server', async () => {
      mockDelete.mockResolvedValue({ success: true });

      const result = await pronoteCredentialsSync.removeFromServer();

      expect(result).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});
```

**Step 3: Run to confirm failures**

```bash
cd apps/mobile && pnpm test -- --testPathPattern="pronote-session|pronote-credentials"
```

Expected: FAIL — modules not found

**Step 4: Commit**

```bash
git add __tests__/services/
git commit -m "test(mobile): add failing tests for Pronote device services (TDD red)"
```

---

### Task 9: Implement Pronote types (shared source of truth)

**Files:**
- Create: `apps/mobile/src/services/pronote/pronote-types.ts`

**Step 1: Create unified types**

```typescript
/**
 * Pronote Types — Single source of truth
 *
 * Used by: pronote-session, pronote-data, pronote-store, usePronote hook,
 * HomeworkView, GradesView, and chat context.
 */

export interface QrCodeData {
  jeton: string;
  login: string;
  url: string;
}

export interface PronoteMetadata {
  instanceUrl: string;
  username: string;
  deviceUuid: string;
  accountKind: number;
}

export interface PronoteResource {
  name: string;
  id: string;
  className?: string;
}

export interface PronoteHomework {
  id: string;
  subject: string;
  description: string;
  dueDate: string;
  done: boolean;
  difficulty: number;
  estimatedMinutes?: number;
}

export interface PronoteGrade {
  id: string;
  subject: string;
  value: number | null;
  outOf: number;
  coefficient: number;
  date: string;
  description: string;
  average?: number;
  max?: number;
  min?: number;
}

export interface PronoteTimetableEntry {
  id: string;
  subject?: string;
  teacherNames: string[];
  classrooms: string[];
  startDate: string;
  endDate: string;
  canceled: boolean;
  status?: string;
}

export interface PronoteConnectionResult {
  success: boolean;
  error?: string;
  resources?: PronoteResource[];
}

/** Pronote context sent with chat messages */
export interface PronoteChatContext {
  homework?: PronoteHomework[];
  recentGrades?: PronoteGrade[];
  todayTimetable?: PronoteTimetableEntry[];
}
```

**Step 2: Commit**

```bash
git add src/services/pronote/pronote-types.ts
git commit -m "feat(mobile): add unified Pronote types (single source of truth)"
```

---

### Task 10: Implement Pronote session service (TDD Green)

**Files:**
- Create: `apps/mobile/src/services/pronote/pronote-session.ts`

**Step 1: Implement**

```typescript
/**
 * Pronote Session Service — Device-side pawnote wrapper
 *
 * Handles QR code login, token refresh, and session management.
 * Tokens stored in expo-secure-store (OS-level encryption).
 */

import {
  createSessionHandle,
  loginQrCode,
  loginToken,
  AccountKind,
  type SessionHandle,
} from 'pawnote';
import * as SecureStore from 'expo-secure-store';
import type {
  QrCodeData,
  PronoteMetadata,
  PronoteResource,
  PronoteConnectionResult,
} from './pronote-types';

const TOKEN_KEY_PREFIX = 'pronote_token_';

function tokenKey(userId: string): string {
  return `${TOKEN_KEY_PREFIX}${userId}`;
}

/** Custom fetcher matching Pronote mobile User-Agent */
const pronoteFetcher = async (options: {
  url: string;
  method: string;
  headers?: Record<string, string>;
  content?: string;
  redirect?: RequestRedirect;
}) => {
  const response = await fetch(options.url, {
    method: options.method,
    headers: {
      ...options.headers,
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) ' +
        'AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ' +
        'PRONOTE Mobile APP Version/2.0.11',
    },
    body: options.method !== 'GET' ? options.content : undefined,
    redirect: options.redirect,
  });

  return {
    content: await response.text(),
    status: response.status,
    headers: response.headers,
  };
};

class PronoteSessionService {
  async connectWithQrCode(
    userId: string,
    qrData: QrCodeData,
    pin: string,
    deviceUuid: string
  ): Promise<PronoteConnectionResult> {
    const session = createSessionHandle(pronoteFetcher);

    try {
      const refreshInfo = await loginQrCode(session, {
        deviceUUID: deviceUuid,
        pin,
        qr: qrData,
      });

      await SecureStore.setItemAsync(tokenKey(userId), refreshInfo.token);

      const resources: PronoteResource[] = session.user.resources.map(
        (r, i) => ({
          name: r.name,
          id: r.id || `resource_${i}`,
          className: r.className,
        })
      );

      return { success: true, resources };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erreur inconnue';

      if (msg.includes('BadCredentials')) {
        return { success: false, error: 'Code PIN incorrect' };
      }
      if (msg.includes('SessionExpired')) {
        return {
          success: false,
          error: 'QR code expire, veuillez en scanner un nouveau',
        };
      }
      if (
        msg.includes('Unable to connect') ||
        msg.includes('ECONNREFUSED') ||
        msg.includes('ETIMEDOUT')
      ) {
        return {
          success: false,
          error: 'Impossible de contacter le serveur Pronote',
        };
      }

      return { success: false, error: 'Echec de connexion Pronote' };
    }
  }

  async refreshSession(
    userId: string,
    metadata: PronoteMetadata
  ): Promise<SessionHandle | null> {
    const token = await SecureStore.getItemAsync(tokenKey(userId));
    if (!token) return null;

    const session = createSessionHandle(pronoteFetcher);

    try {
      const refreshInfo = await loginToken(session, {
        url: metadata.instanceUrl,
        kind: metadata.accountKind as AccountKind,
        username: metadata.username,
        token,
        deviceUUID: metadata.deviceUuid,
      });

      await SecureStore.setItemAsync(tokenKey(userId), refreshInfo.token);

      return session;
    } catch {
      return null;
    }
  }

  async disconnect(userId: string): Promise<void> {
    await SecureStore.deleteItemAsync(tokenKey(userId));
  }
}

export const pronoteSessionService = new PronoteSessionService();
```

**Step 2: Run tests**

```bash
cd apps/mobile && pnpm test -- --testPathPattern="pronote-session"
```

Expected: ALL PASS

**Step 3: Commit**

```bash
git add src/services/pronote/pronote-session.ts
git commit -m "feat(mobile): implement Pronote session service with SecureStore (TDD green)"
```

---

### Task 11: Implement Pronote credentials sync (TDD Green)

**Files:**
- Create: `apps/mobile/src/services/pronote/pronote-credentials.ts`

**Step 1: Implement**

```typescript
/**
 * Pronote Credentials Sync — Mobile ↔ Server
 *
 * Pushes encrypted credentials to server for multi-device sync.
 * Pulls credentials when logging in on a new device.
 */

import { getTreaty, unwrap } from '@repo/api';
import type { PronoteMetadata } from './pronote-types';

interface SyncInput {
  token: string;
  metadata: PronoteMetadata;
  tokenExpiresAt: string;
}

interface SyncOutput {
  token: string;
  metadata: string;
  tokenExpiresAt: string;
}

class PronoteCredentialsSync {
  async pushToServer(input: SyncInput): Promise<boolean> {
    try {
      await unwrap(
        await getTreaty().api.pronote.credentials.put({
          token: input.token,
          metadata: JSON.stringify(input.metadata),
          tokenExpiresAt: input.tokenExpiresAt,
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  async pullFromServer(): Promise<SyncOutput | null> {
    try {
      const result = await unwrap(
        await getTreaty().api.pronote.credentials.get()
      );
      return result as SyncOutput;
    } catch {
      return null;
    }
  }

  async removeFromServer(): Promise<boolean> {
    try {
      await unwrap(
        await getTreaty().api.pronote.credentials.delete()
      );
      return true;
    } catch {
      return false;
    }
  }
}

export const pronoteCredentialsSync = new PronoteCredentialsSync();
```

**Step 2: Run tests**

```bash
cd apps/mobile && pnpm test -- --testPathPattern="pronote-credentials"
```

Expected: ALL PASS

**Step 3: Commit**

```bash
git add src/services/pronote/pronote-credentials.ts
git commit -m "feat(mobile): implement Pronote credentials server sync (TDD green)"
```

---

### Task 12: Implement Pronote Zustand store

**Files:**
- Create: `apps/mobile/src/stores/pronote-store.ts`
- Create: `apps/mobile/__tests__/stores/pronote-store.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';

jest.mock('react-native-mmkv', () => {
  const store = new Map<string, string>();
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      set: (key: string, val: string) => store.set(key, val),
      getString: (key: string) => store.get(key),
      delete: (key: string) => store.delete(key),
      contains: (key: string) => store.has(key),
      clearAll: () => store.clear(),
    })),
  };
});

const { usePronoteStore } = require('@/stores/pronote-store');

beforeEach(() => {
  usePronoteStore.getState().reset();
});

describe('usePronoteStore', () => {
  it('should start disconnected', () => {
    const state = usePronoteStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.metadata).toBeNull();
  });

  it('should set connected state', () => {
    usePronoteStore.getState().setConnected({
      instanceUrl: 'https://demo.net/',
      username: 'user',
      deviceUuid: 'uuid',
      accountKind: 2,
    });

    const state = usePronoteStore.getState();
    expect(state.isConnected).toBe(true);
    expect(state.metadata?.username).toBe('user');
  });

  it('should store and retrieve homework cache', () => {
    const homework = [{ id: '1', subject: 'Maths', description: 'Ex 1-5', dueDate: '2026-03-12', done: false, difficulty: 2 }];
    usePronoteStore.getState().setHomework(homework);

    expect(usePronoteStore.getState().homework).toHaveLength(1);
  });

  it('should reset all state on disconnect', () => {
    usePronoteStore.getState().setConnected({
      instanceUrl: 'https://demo.net/',
      username: 'user',
      deviceUuid: 'uuid',
      accountKind: 2,
    });
    usePronoteStore.getState().reset();

    expect(usePronoteStore.getState().isConnected).toBe(false);
    expect(usePronoteStore.getState().homework).toEqual([]);
  });
});
```

**Step 2: Implement store**

```typescript
/**
 * Pronote Zustand Store — Device-local state + MMKV persistence
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';
import type {
  PronoteMetadata,
  PronoteResource,
  PronoteHomework,
  PronoteGrade,
  PronoteTimetableEntry,
} from '@/services/pronote/pronote-types';

const mmkv = new MMKV({ id: 'pronote-store' });

const mmkvStorage = {
  getItem: (name: string) => mmkv.getString(name) ?? null,
  setItem: (name: string, value: string) => mmkv.set(name, value),
  removeItem: (name: string) => mmkv.delete(name),
};

export interface PronoteState {
  // Connection
  isConnected: boolean;
  metadata: PronoteMetadata | null;
  resources: PronoteResource[];
  resourceMappings: Record<string, number>; // childId → resourceIndex

  // Cached data
  homework: PronoteHomework[];
  grades: PronoteGrade[];
  timetable: PronoteTimetableEntry[];

  // Last fetch timestamps (ISO strings)
  lastHomeworkFetch: string | null;
  lastGradesFetch: string | null;
  lastTimetableFetch: string | null;

  // Actions
  setConnected: (metadata: PronoteMetadata) => void;
  setResources: (resources: PronoteResource[]) => void;
  setResourceMapping: (childId: string, resourceIndex: number) => void;
  setHomework: (homework: PronoteHomework[]) => void;
  setGrades: (grades: PronoteGrade[]) => void;
  setTimetable: (timetable: PronoteTimetableEntry[]) => void;
  reset: () => void;
}

const initialState = {
  isConnected: false,
  metadata: null,
  resources: [],
  resourceMappings: {},
  homework: [],
  grades: [],
  timetable: [],
  lastHomeworkFetch: null,
  lastGradesFetch: null,
  lastTimetableFetch: null,
};

export const usePronoteStore = create<PronoteState>()(
  persist(
    (set) => ({
      ...initialState,

      setConnected: (metadata) => set({ isConnected: true, metadata }),

      setResources: (resources) => set({ resources }),

      setResourceMapping: (childId, resourceIndex) =>
        set((state) => ({
          resourceMappings: { ...state.resourceMappings, [childId]: resourceIndex },
        })),

      setHomework: (homework) =>
        set({ homework, lastHomeworkFetch: new Date().toISOString() }),

      setGrades: (grades) =>
        set({ grades, lastGradesFetch: new Date().toISOString() }),

      setTimetable: (timetable) =>
        set({ timetable, lastTimetableFetch: new Date().toISOString() }),

      reset: () => set(initialState),
    }),
    {
      name: 'pronote-storage',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);
```

**Step 3: Run tests**

```bash
cd apps/mobile && pnpm test -- --testPathPattern="pronote-store"
```

Expected: ALL PASS

**Step 4: Commit**

```bash
git add src/stores/pronote-store.ts __tests__/stores/pronote-store.test.ts
git commit -m "feat(mobile): implement Pronote Zustand store with MMKV persistence (TDD)"
```

---

### Task 13: Implement usePronote unified hook

**Files:**
- Create: `apps/mobile/src/hooks/usePronote.ts`
- Delete: `apps/mobile/src/hooks/useParentPronote.ts`
- Delete: `apps/mobile/src/hooks/useStudentPronote.ts`

**Step 1: Implement unified hook**

```typescript
/**
 * usePronote — Unified Pronote hook (replaces useParentPronote + useStudentPronote)
 *
 * Device-first: all Pronote calls happen on the device.
 * Works for both parent and student roles.
 */

import { useCallback, useEffect } from 'react';
import { usePronoteStore } from '@/stores/pronote-store';
import { pronoteSessionService } from '@/services/pronote/pronote-session';
import { pronoteCredentialsSync } from '@/services/pronote/pronote-credentials';
import type {
  QrCodeData,
  PronoteResource,
  PronoteConnectionResult,
  PronoteChatContext,
} from '@/services/pronote/pronote-types';
import {
  assignmentsFromIntervals,
  gradesOverview,
  timetableFromIntervals,
  use,
  type SessionHandle,
  type Assignment,
} from 'pawnote';

const CACHE_TTL = {
  HOMEWORK: 15 * 60 * 1000,
  GRADES: 60 * 60 * 1000,
  TIMETABLE: 30 * 60 * 1000,
};

function isCacheStale(lastFetch: string | null, ttl: number): boolean {
  if (!lastFetch) return true;
  return Date.now() - new Date(lastFetch).getTime() > ttl;
}

export function usePronote(userId: string) {
  const store = usePronoteStore();

  const connect = useCallback(
    async (
      qrData: QrCodeData,
      pin: string
    ): Promise<PronoteConnectionResult> => {
      const deviceUuid = crypto.randomUUID?.() ?? `device-${Date.now()}`;
      const result = await pronoteSessionService.connectWithQrCode(
        userId,
        qrData,
        pin,
        deviceUuid
      );

      if (result.success && result.resources) {
        const metadata = {
          instanceUrl: qrData.url,
          username: qrData.login,
          deviceUuid,
          accountKind: 2,
        };

        store.setConnected(metadata);
        store.setResources(result.resources);

        // Sync to server for multi-device
        void pronoteCredentialsSync.pushToServer({
          token: '', // Token is in SecureStore, server gets its own encrypted copy
          metadata,
          tokenExpiresAt: new Date(
            Date.now() + 5 * 60 * 1000
          ).toISOString(),
        });
      }

      return result;
    },
    [userId, store]
  );

  const disconnect = useCallback(async () => {
    await pronoteSessionService.disconnect(userId);
    void pronoteCredentialsSync.removeFromServer();
    store.reset();
  }, [userId, store]);

  const fetchHomework = useCallback(
    async (weekOffset = 0) => {
      if (!store.metadata) return;
      if (!isCacheStale(store.lastHomeworkFetch, CACHE_TTL.HOMEWORK) && weekOffset === 0) return;

      const session = await pronoteSessionService.refreshSession(
        userId,
        store.metadata
      );
      if (!session) return;

      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + 1 + weekOffset * 7);
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      try {
        const assignments = await assignmentsFromIntervals(
          session,
          startOfWeek,
          endOfWeek
        );
        store.setHomework(
          assignments.map((a: Assignment) => ({
            id: a.id,
            subject: a.subject.name,
            description: a.description,
            dueDate: a.deadline.toISOString(),
            done: a.done,
            difficulty: a.difficulty,
            estimatedMinutes: a.length,
          }))
        );
      } catch {
        // Silent fail — cached data still available
      }
    },
    [userId, store]
  );

  const fetchGrades = useCallback(async () => {
    if (!store.metadata) return;
    if (!isCacheStale(store.lastGradesFetch, CACHE_TTL.GRADES)) return;

    const session = await pronoteSessionService.refreshSession(
      userId,
      store.metadata
    );
    if (!session) return;

    try {
      const defaultPeriod = session.userResource.tabs.get(198)?.defaultPeriod;
      if (!defaultPeriod) return;

      const overview = await gradesOverview(session, defaultPeriod);
      store.setGrades(
        overview.grades.map((g) => ({
          id: g.id,
          subject: g.subject.name,
          value: g.value.kind === 0 ? g.value.points : null,
          outOf: g.outOf.points,
          coefficient: g.coefficient,
          date: g.date.toISOString(),
          description: g.comment,
          average: g.average?.points,
          max: g.max?.points,
          min: g.min?.points,
        }))
      );
    } catch {
      // Silent fail
    }
  }, [userId, store]);

  const fetchTimetable = useCallback(
    async (weekOffset = 0) => {
      if (!store.metadata) return;
      if (!isCacheStale(store.lastTimetableFetch, CACHE_TTL.TIMETABLE) && weekOffset === 0) return;

      const session = await pronoteSessionService.refreshSession(
        userId,
        store.metadata
      );
      if (!session) return;

      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + 1 + weekOffset * 7);
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      try {
        const timetable = await timetableFromIntervals(
          session,
          startOfWeek,
          endOfWeek
        );
        store.setTimetable(
          timetable.classes
            .filter(
              (c): c is typeof c & { is: 'lesson' } => c.is === 'lesson'
            )
            .map((lesson) => ({
              id: lesson.id,
              subject: lesson.subject?.name,
              teacherNames: lesson.teacherNames,
              classrooms: lesson.classrooms,
              startDate: lesson.startDate.toISOString(),
              endDate: lesson.endDate.toISOString(),
              canceled: lesson.canceled,
              status: lesson.status,
            }))
        );
      } catch {
        // Silent fail
      }
    },
    [userId, store]
  );

  /** Build context object to send with chat messages */
  const getChatContext = useCallback((): PronoteChatContext | undefined => {
    if (!store.isConnected) return undefined;

    const context: PronoteChatContext = {};
    if (store.homework.length > 0) context.homework = store.homework;
    if (store.grades.length > 0)
      context.recentGrades = store.grades.slice(0, 10);
    if (store.timetable.length > 0)
      context.todayTimetable = store.timetable;

    return Object.keys(context).length > 0 ? context : undefined;
  }, [store]);

  return {
    // State
    isConnected: store.isConnected,
    resources: store.resources,
    homework: store.homework,
    grades: store.grades,
    timetable: store.timetable,

    // Actions
    connect,
    disconnect,
    fetchHomework,
    fetchGrades,
    fetchTimetable,
    getChatContext,

    // Mapping (for parent flow)
    setResourceMapping: store.setResourceMapping,
    resourceMappings: store.resourceMappings,
  };
}
```

**Step 2: Delete old hooks**

```bash
rm apps/mobile/src/hooks/useParentPronote.ts
rm apps/mobile/src/hooks/useStudentPronote.ts
```

**Step 3: Typecheck**

```bash
cd apps/mobile && pnpm typecheck
```

Fix any import errors in screens that used the old hooks.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat(mobile): implement unified usePronote hook, delete old hooks

Device-first: all Pronote data fetching happens on device via pawnote.
Replaces useParentPronote and useStudentPronote."
```

---

### Task 14: Update screens to use new hook + age gating

**Files:**
- Modify: `apps/mobile/src/app/(parent)/(profile)/pronote-connect.tsx`
- Modify: `apps/mobile/src/app/(student)/(profile)/pronote/` screens
- Modify: `apps/mobile/src/components/pronote/HomeworkView.tsx`
- Modify: `apps/mobile/src/components/pronote/GradesView.tsx`
- Modify: `apps/mobile/src/components/dashboard/HomeworkUrgentCard.tsx`
- Modify: `apps/mobile/src/components/dashboard/GradesRecentCard.tsx`

This task involves updating all UI components to use `usePronote` instead of the deleted hooks. The key changes:

1. Replace all `useParentPronote`/`useStudentPronote` imports with `usePronote`
2. Add age check for student self-connect: show "Connecter Pronote" button in student profile only if `age >= 15`
3. Update chat screen to include `getChatContext()` in message body
4. Import types from `@/services/pronote/pronote-types` instead of the old hook files

**Age gating logic:**

```typescript
// In student profile screen
const birthDate = user.birthDate ? new Date(user.birthDate) : null;
const age = birthDate
  ? Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  : null;
const canSelfConnect = age !== null && age >= 15;
```

**Chat integration:**

```typescript
// In chat screen, when sending message
const { getChatContext } = usePronote(userId);

const sendMessage = () => {
  const pronoteContext = getChatContext();
  // Include in request body alongside content and data
  api.chat.stream.post({ content, data, pronoteContext });
};
```

**Step: Typecheck + lint + test**

```bash
cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test
```

**Commit:**

```bash
git add -A && git commit -m "feat(mobile): update all screens for device-first Pronote + age gating at 15"
```

---

## Phase 3: Cleanup + Validation

### Task 15: Delete old mobile test + update pronote-helpers

**Files:**
- Modify: `apps/mobile/src/lib/pronote-helpers.ts` — update type imports
- Modify: `apps/mobile/__tests__/lib/pronote-helpers.test.ts` — ensure still passes

**Step 1: Update pronote-helpers imports**

Change type imports from old hook files to `@/services/pronote/pronote-types`.

**Step 2: Run all tests**

```bash
cd apps/mobile && pnpm test
cd apps/server && bun test
```

**Step 3: Full validation**

```bash
cd apps/server && bun run typecheck && bun run lint && bun test
cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test
```

**Step 4: Final commit**

```bash
git add -A && git commit -m "refactor: cleanup Pronote migration, all tests passing

Server: credential sync only, no Pronote API calls.
Mobile: device-first via pawnote, SecureStore tokens, MMKV cache.
Age gating: 15+ can self-connect (CNIL digital majority)."
```
