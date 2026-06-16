# Pronote Server Provider — Phase 0 + 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read Pronote data (grades / homework / timetable) **server-side** via `pawnote`, from the rotating token already stored in `pronote_credentials`, behind a source-agnostic `PronoteProvider` port — proven end-to-end against the public demo account.

**Architecture:** A `PronoteProvider` port (stable interface, normalized types) with a `PawnoteServerAdapter` implementation. The adapter authenticates from a stored token (`authenticateToken`), reads data, and re-persists the rotated token. A new `pronote_child_resources` table maps a Tom child to a Pronote resource (the parent's login covers N children). New protected endpoints `/api/pronote/{grades,homework,timetable}` resolve `childId → parent → token → resource → adapter`. The existing credentials vault (`pronote-sync.service.ts`) is reused as-is for token storage.

**Tech Stack:** Bun, Elysia.js, Drizzle ORM, `pawnote@^1.6.2`, Bun test runner. Demo account: `demonstration` / `pronotevs` at `https://demo.index-education.net/pronote/` (canonical pawnote/pronotepy demo — direct access, no ENT).

**Scope:** Phase 0 (de-risk on demo) + Phase 1 (server foundation). **Out of scope** (separate plans): web wiring, mobile migration, ENT/EduConnect WebView auth, EcoleDirecte adapter. Mobile stays device-first and untouched.

---

## Reference: existing code (from exploration)

- Credentials vault (reuse): `apps/server/src/services/pronote-sync.service.ts` — `pronoteSyncService.getCredentials(userId)` returns `{ token, metadata, tokenExpiresAt }` (decrypted); `upsertCredentials(userId, { token, metadata, tokenExpiresAt })`.
- Schema: `apps/server/src/db/schema/pronote.schema.ts` (`pronoteCredentials`, FK `user_id → user.id` CASCADE, UNIQUE on `user_id`).
- Encryption (reuse, do not touch): `apps/server/src/lib/encryption.ts` — `encrypt`/`decrypt`.
- Route pattern (auth-guarded group): `apps/server/src/routes/pronote-sync.routes.ts` — `.use(authMacro).onBeforeHandle(rateLimit).guard({ auth: true }).group('/api/pronote', ...)`.
- App mount + Eden type: `apps/server/src/app.ts:282` (`.use(pronoteSyncRoutes)`), `app.ts:289` (`export type App = typeof app`).
- pawnote data-fetch reference (mobile, proven working): `apps/mobile/src/hooks/usePronote.ts:8-22` imports `AccountKind, GradeKind, assignmentsFromIntervals, gradesOverview, timetableFromIntervals, TabLocation`; auth ref: `apps/mobile/src/services/pronote/pronote-session.ts` (`createSessionHandle`, `loginToken`, fetcher User-Agent `PRONOTE Mobile APP Version/2.0.11`).
- Children link: a child `user` row has `parentId` → resolve parent. Confirm the exact column during Task 5 (read `apps/server/src/db/schema/` user/auth schema before writing the query).
- Test patterns: unit + mocks → `apps/server/src/tests/pronote-sync.test.ts`; real crypto → `apps/server/src/tests/encryption.test.ts`; e2e via `app.handle()` → `apps/server/src/integration-tests/api-endpoints.test.ts` (note: it mocks `pronoteSyncRoutes` to an empty Elysia — our new data routes must be added to its mocks if they pull the Drizzle schema chain; follow the `retention-purge.service` mock pattern).

---

## Phase 0 — De-risk on the demo account (must pass before Phase 1)

Goal: prove, with real network calls, that the server (Bun) can authenticate to Pronote and read data, and measure the rotating-token behavior. This is an **integration probe**, run manually, never a CI gate.

### Task 0: Server-side pawnote spike against demo

**Files:**
- Modify: `apps/server/package.json` (add `pawnote`)
- Create: `apps/server/src/integration-tests/pronote-demo.probe.test.ts`

- [ ] **Step 1: Add pawnote to the server**

Run: `cd apps/server && bun add pawnote@^1.6.2`
Expected: `pawnote` appears in `apps/server/package.json` dependencies, version `^1.6.2` (same major as mobile).

- [ ] **Step 2: Write the probe (real network, demo account)**

Create `apps/server/src/integration-tests/pronote-demo.probe.test.ts`. It logs in with credentials (demo is direct-access), captures the token, re-authenticates from the token, reads the three data kinds, and asserts the token rotates. Use the mobile fetcher pattern (User-Agent spoof) as reference.

```ts
import { describe, expect, it } from 'bun:test';
import {
  createSessionHandle,
  loginCredentials,
  loginToken,
  AccountKind,
  gradesOverview,
  type SessionHandle,
} from 'pawnote';

const DEMO_URL = 'https://demo.index-education.net/pronote/';
const DEMO_USER = 'demonstration';
const DEMO_PASS = 'pronotevs';
const DEVICE_UUID = 'tom-server-probe';

// Real network. Run manually: `bun test src/integration-tests/pronote-demo.probe.test.ts`
describe('pawnote server-side probe (demo)', () => {
  it('logs in, rotates token, reads grades', async () => {
    const handle: SessionHandle = createSessionHandle();
    const refresh = await loginCredentials(handle, {
      url: DEMO_URL,
      kind: AccountKind.STUDENT,
      username: DEMO_USER,
      password: DEMO_PASS,
      deviceUUID: DEVICE_UUID,
    });

    expect(refresh.token).toBeTruthy();
    const firstToken = refresh.token;

    // Re-auth from token only (this is what the server will do every request)
    const handle2: SessionHandle = createSessionHandle();
    const refresh2 = await loginToken(handle2, {
      url: DEMO_URL,
      kind: AccountKind.STUDENT,
      username: refresh.username,
      token: firstToken,
      deviceUUID: DEVICE_UUID,
    });

    // Document the rotation behavior: is the token stable or rotated?
    console.log('token rotated:', refresh2.token !== firstToken);
    expect(refresh2.token).toBeTruthy();

    const period = handle2.readDefaultPeriod?.() ?? handle2.user.resources[0].periods[0];
    const grades = await gradesOverview(handle2, period);
    expect(grades).toBeDefined();
    console.log('grades subjects:', grades.subjects?.length ?? 0);
  }, 30_000);
});
```

> **Note for implementer:** the exact `loginCredentials`/`loginToken`/`gradesOverview` option shapes and the period accessor must be confirmed against the installed `pawnote@1.6.2` types (`node_modules/pawnote/dist/index.d.ts`) and the mobile usage in `apps/mobile/src/hooks/usePronote.ts`. Adjust field names to match the real types — do not guess. If `AccountKind.STUDENT` is wrong for the demo, read the enum.

- [ ] **Step 3: Run the probe**

Run: `cd apps/server && bun test src/integration-tests/pronote-demo.probe.test.ts`
Expected: PASS. Capture in the task report: (a) does the token rotate on `loginToken`? (b) the grades payload shape. These answer open risks #1 (token lifetime) and inform the adapter.

- [ ] **Step 4: Record findings, do not commit the probe yet**

Write the observed token-rotation behavior and grades/homework/timetable payload shapes into the task report. The probe file stays uncommitted until Task 9 wires it into a proper, named integration test. If the probe fails (auth or read), STOP and escalate — the design assumption is broken.

---

## Phase 1 — Server foundation

### Task 1: Define the `PronoteProvider` port and normalized types

**Files:**
- Create: `apps/server/src/services/pronote/provider.types.ts`
- Test: `apps/server/src/tests/pronote-provider-types.test.ts`

- [ ] **Step 1: Write the failing test (types compile + shape contract)**

```ts
import { describe, expect, it } from 'bun:test';
import type { PronoteProvider, NormalizedGrade } from '../services/pronote/provider.types';

describe('PronoteProvider port', () => {
  it('NormalizedGrade carries source-agnostic fields', () => {
    const g: NormalizedGrade = {
      subject: 'Mathématiques', value: 15, scale: 20, date: '2026-06-01', comment: null,
    };
    expect(g.scale).toBe(20);
  });

  it('provider exposes the four read methods + lifecycle', () => {
    const shape: (keyof PronoteProvider)[] = ['connect', 'getGrades', 'getHomework', 'getTimetable', 'disconnect'];
    expect(shape).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/server && bun test src/tests/pronote-provider-types.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the port + normalized types**

```ts
// apps/server/src/services/pronote/provider.types.ts
export interface NormalizedGrade {
  subject: string;
  value: number | null;     // null = unmarked / "absent"
  scale: number;            // e.g. 20
  date: string;             // ISO date
  comment: string | null;
}

export interface NormalizedHomework {
  subject: string;
  description: string;
  dueDate: string;          // ISO date
  done: boolean;
}

export interface NormalizedLesson {
  subject: string;
  start: string;            // ISO datetime
  end: string;              // ISO datetime
  room: string | null;
  canceled: boolean;
}

export interface ProviderSession {
  token: string;            // rotated token to re-persist after use
  username: string;
}

export interface PronoteProvider {
  connect(input: { url: string; username: string; token: string; deviceUuid: string }): Promise<ProviderSession>;
  getGrades(session: ProviderSession, resourceId: number): Promise<NormalizedGrade[]>;
  getHomework(session: ProviderSession, resourceId: number): Promise<NormalizedHomework[]>;
  getTimetable(session: ProviderSession, resourceId: number, day: string): Promise<NormalizedLesson[]>;
  disconnect(session: ProviderSession): Promise<void>;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/server && bun test src/tests/pronote-provider-types.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/pronote/provider.types.ts apps/server/src/tests/pronote-provider-types.test.ts
git commit -m "feat(server): define PronoteProvider port and normalized types

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 2: Implement `PawnoteServerAdapter`

**Files:**
- Create: `apps/server/src/services/pronote/pawnote-server.adapter.ts`
- Test: `apps/server/src/tests/pawnote-server-adapter.test.ts`

The adapter wraps `pawnote`.

**Production path**: `connect({ url, username, token, deviceUuid })` calls `loginToken` and returns the rotated token in `ProviderSession`. If `loginToken` fails (expired/invalidated token), throw a typed `PronoteReauthRequired` error — **NO fallback to credentials**. We are token-only: a credentials fallback would need a stored password we never keep, and would silently mask a re-auth need (forbidden by the owner's zero-silent-fallback rule). The caller surfaces "reconnect required" to the user (re-do the QR).

**Test-only path**: also expose `connectWithCredentials({ url, username, password, deviceUuid })` (calls `loginCredentials`), used ONLY by the demo probe/e2e — the public demo does NOT accept `loginToken` (Task 0 confirmed `BadCredentialsError` on demo). Mark it clearly test-only; it must not be reachable from any production route.

**Field mappings — use the EXACT pawnote 1.6.2 shapes captured by the Task 0 probe** (real, confirmed):
- grades: `overview.grades[]` → `.value.kind` (GradeKind: `0`=Grade, `1`=Absent…), `.value.points` (valid only when `kind===GradeKind.Grade` → otherwise `NormalizedGrade.value = null`), `.outOf.points` (=`scale`), `.subject.name`, `.date` (Date), `.comment`. Period: `handle.userResource.tabs.get(TabLocation.Grades)?.defaultPeriod ?? periods[0]`.
- homework: `assignmentsFromIntervals(handle, from, to)` → `Assignment[]` → `.subject.name`, `.description` (HTML — strip tags for `NormalizedHomework.description`), `.deadline` (Date → `dueDate`), `.done`.
- timetable: `timetableFromIntervals(handle, from, to)` → `Timetable` with `.classes[]`, discriminate by `.is` (`'lesson'`|`'activity'`|`'detention'`); lesson → `.subject?.name`, `.startDate`, `.endDate`, `.classrooms[]` (first → `room`), `.canceled`.

Use the mobile `usePronote.ts:8-22` as the working API reference and confirm against the installed types.

- [ ] **Step 1: Write the failing test (mock pawnote)**

Mock `pawnote` (Bun `mock.module` before importing the adapter, like `pronote-sync.test.ts`). Assert `connect` returns the rotated token and `getGrades` maps fields.

```ts
import { describe, expect, it, mock } from 'bun:test';

mock.module('pawnote', () => ({
  createSessionHandle: () => ({ user: { resources: [{ id: 1, periods: [{}] }] } }),
  loginToken: mock(async () => ({ token: 'rotated-token', username: 'demo' })),
  gradesOverview: mock(async () => ({ subjects: [{ name: 'Maths', averages: [] }], grades: [
    { subject: { name: 'Maths' }, value: { value: 15 }, outOf: { value: 20 }, date: new Date('2026-06-01'), comment: '' },
  ] })),
  AccountKind: { STUDENT: 6, PARENT: 7 },
  GradeKind: { Grade: 0 },
}));

const { pawnoteServerAdapter } = await import('../services/pronote/pawnote-server.adapter');

describe('PawnoteServerAdapter', () => {
  it('connect returns the rotated token', async () => {
    const s = await pawnoteServerAdapter.connect({ url: 'u', username: 'demo', token: 't', deviceUuid: 'd' });
    expect(s.token).toBe('rotated-token');
  });

  it('getGrades maps to NormalizedGrade', async () => {
    const s = { token: 't', username: 'demo' };
    const grades = await pawnoteServerAdapter.getGrades(s, 1);
    expect(grades[0]).toMatchObject({ subject: 'Maths', value: 15, scale: 20 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/server && bun test src/tests/pawnote-server-adapter.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the adapter**

Implement `pawnoteServerAdapter: PronoteProvider`. `connect` calls `loginToken` with a fresh `createSessionHandle()` and a server fetcher carrying the `PRONOTE Mobile APP Version/2.0.11` User-Agent (copy the fetcher shape from `apps/mobile/src/services/pronote/pronote-session.ts`). The read methods call `gradesOverview` / `assignmentsFromIntervals` / `timetableFromIntervals` for the given resource and map every field to the normalized types (handle `value === null` for unmarked grades). Keep the handle in a closure for the duration of the call; the rotated token from `loginToken` is returned in `ProviderSession`.

> Field mappings (subject name, value/outOf, date formatting) must be confirmed against `pawnote@1.6.2` types and the mobile reads — do not invent property paths.

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/server && bun test src/tests/pawnote-server-adapter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/pronote/pawnote-server.adapter.ts apps/server/src/tests/pawnote-server-adapter.test.ts
git commit -m "feat(server): implement PawnoteServerAdapter (token-based reads)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 3: In-memory session cache

**Files:**
- Create: `apps/server/src/services/pronote/session-cache.ts`
- Test: `apps/server/src/tests/pronote-session-cache.test.ts`

A per-user cache of `ProviderSession` with a short TTL, so we don't re-`loginToken` on every request. On miss/expiry, the caller re-connects and updates the cache.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'bun:test';
import { SessionCache } from '../services/pronote/session-cache';

describe('SessionCache', () => {
  it('returns a cached session within TTL and null after expiry', () => {
    let now = 1000;
    const cache = new SessionCache(60_000, () => now);
    cache.set('user1', { token: 't', username: 'u' });
    expect(cache.get('user1')?.token).toBe('t');
    now += 60_001;
    expect(cache.get('user1')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/server && bun test src/tests/pronote-session-cache.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `SessionCache`**

`class SessionCache` with constructor `(ttlMs: number, clock: () => number = Date.now)`, a `Map<string, { session: ProviderSession; expiresAt: number }>`, methods `get(userId): ProviderSession | null`, `set(userId, session)`, `delete(userId)`. The injectable clock keeps the test deterministic.

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/server && bun test src/tests/pronote-session-cache.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/pronote/session-cache.ts apps/server/src/tests/pronote-session-cache.test.ts
git commit -m "feat(server): add in-memory Pronote session cache

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 4: `pronote_child_resources` table (schema + migration)

**Files:**
- Modify: `apps/server/src/db/schema/pronote.schema.ts`
- Create: migration via `drizzle-kit generate`
- Test: `apps/server/src/tests/pronote-child-resources-schema.test.ts`

Maps a Tom child to a Pronote resource id under the parent's credential. One row per (parentUserId, childUserId).

- [ ] **Step 1: Write the failing test (schema shape)**

```ts
import { describe, expect, it } from 'bun:test';
import { pronoteChildResources } from '../db/schema/pronote.schema';

describe('pronote_child_resources schema', () => {
  it('exposes the mapping columns', () => {
    const cols = Object.keys(pronoteChildResources);
    expect(cols).toEqual(expect.arrayContaining([
      'id', 'parentUserId', 'childUserId', 'resourceId', 'createdAt', 'updatedAt',
    ]));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/server && bun test src/tests/pronote-child-resources-schema.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add the table to `pronote.schema.ts`**

```ts
export const pronoteChildResources = pgTable('pronote_child_resources', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentUserId: varchar('parent_user_id', { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  childUserId: varchar('child_user_id', { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  resourceId: integer('resource_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  childUnique: unique('pronote_child_resources_child_unique').on(table.childUserId),
}));

export type PronoteChildResource = typeof pronoteChildResources.$inferSelect;
export type NewPronoteChildResource = typeof pronoteChildResources.$inferInsert;
```

Add any missing imports (`integer`, `unique`) and confirm the `user` import already used by `pronoteCredentials`.

- [ ] **Step 4: Run schema test**

Run: `cd apps/server && bun test src/tests/pronote-child-resources-schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Generate + apply the migration**

Run: `cd apps/server && bun run db:generate`
Expected: a new `drizzle/00XX_*.sql` creating `pronote_child_resources`. Read it — it must be a plain `CREATE TABLE` (no destructive ALTER on existing tables).
Run: `cd apps/server && bun run db:migrate` (dev DB)
Expected: applied cleanly. Verify the table exists (`\d pronote_child_resources`).

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/db/schema/pronote.schema.ts apps/server/src/tests/pronote-child-resources-schema.test.ts apps/server/drizzle
git commit -m "feat(db): add pronote_child_resources mapping table

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 5: Resolution service (childId → parent → token → resource)

**Files:**
- Create: `apps/server/src/services/pronote/pronote-data.service.ts`
- Test: `apps/server/src/tests/pronote-data-service.test.ts`

Single-level resolution: given a `childId`, find the parent, load the parent's credential (token), find the child's `resourceId`, get/refresh a session via the cache + adapter, read data, re-persist the rotated token.

- [ ] **Step 1: Read the user/auth schema first**

Read `apps/server/src/db/schema/` to confirm how a child links to its parent (`parentId` column on `user`, or a separate relation). Use the real column in the query. Do not assume.

- [ ] **Step 2: Write the failing test (mock repos + adapter + cache)**

Mock `pronoteSyncService`, the child-resources repository (Task 6), `pawnoteServerAdapter`, and a `SessionCache`. Assert that `getGrades(childId)`: resolves the parent, connects with the stored token on cache miss, calls the adapter with the child's `resourceId`, and re-persists the rotated token via `pronoteSyncService.upsertCredentials`.

```ts
// shape only — full mocks per pronote-sync.test.ts pattern
it('resolves child → parent token → resource and re-persists rotated token', async () => {
  const grades = await pronoteDataService.getGrades('child-1');
  expect(grades).toBeDefined();
  expect(upsertSpy).toHaveBeenCalled(); // rotated token re-persisted
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd apps/server && bun test src/tests/pronote-data-service.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement `pronoteDataService`**

`getGrades(childId)` / `getHomework(childId)` / `getTimetable(childId, day)`:
1. resolve `parentUserId` from `childId` (real column from Step 1); throw a typed `PronoteResolutionError` if the child has no parent.
2. `cache.get(parentUserId)` → on miss: `getCredentials(parentUserId)` → `adapter.connect({ url, username, token, deviceUuid })` (url/username/deviceUuid from decrypted `metadata`) → `cache.set`.
3. lookup `resourceId` from `pronoteChildResources` (repo, Task 6); throw `PronoteResourceNotMappedError` if absent.
4. call the adapter read method; then `upsertCredentials(parentUserId, { token: session.token, metadata, tokenExpiresAt })` to persist the rotated token.

Define typed errors in this file (no `error.message.includes`).

- [ ] **Step 5: Run to verify it passes**

Run: `cd apps/server && bun test src/tests/pronote-data-service.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/services/pronote/pronote-data.service.ts apps/server/src/tests/pronote-data-service.test.ts
git commit -m "feat(server): add Pronote data resolution service (child→parent→resource)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 6: `pronote_child_resources` repository

**Files:**
- Create: `apps/server/src/db/repositories/pronote-child-resources.repository.ts`
- Test: `apps/server/src/tests/pronote-child-resources-repository.test.ts`

Follow the existing repository pattern in `apps/server/src/db/repositories/` (mock `db` chain like `pronote-sync.test.ts`).

- [ ] **Step 1: Write the failing test**

Assert `getResourceId(childUserId)` returns the mapped `resourceId` or `null`, and `upsertMapping(parentUserId, childUserId, resourceId)` calls `insert().values().onConflictDoUpdate()`.

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/server && bun test src/tests/pronote-child-resources-repository.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the repository**

`getResourceId(childUserId): Promise<number | null>`, `upsertMapping(parentUserId, childUserId, resourceId): Promise<void>`, `deleteByChild(childUserId): Promise<void>`. Direct Drizzle queries on `pronoteChildResources`.

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/server && bun test src/tests/pronote-child-resources-repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the repo into the data service (replace the mock seam) and re-run Task 5's test**

Run: `cd apps/server && bun test src/tests/pronote-data-service.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/db/repositories/pronote-child-resources.repository.ts apps/server/src/tests/pronote-child-resources-repository.test.ts apps/server/src/services/pronote/pronote-data.service.ts
git commit -m "feat(server): add pronote_child_resources repository

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 7: Data endpoints + resource-mapping endpoint

**Files:**
- Create: `apps/server/src/routes/pronote-data.routes.ts`
- Modify: `apps/server/src/app.ts` (mount)
- Test: `apps/server/src/tests/pronote-data-routes.test.ts`

Add `GET /api/pronote/children/:childId/{grades,homework,timetable}` and `PUT /api/pronote/children/:childId/resource` (persist the mapping), all under `.guard({ auth: true })`. Follow `pronote-sync.routes.ts` exactly (authMacro → rateLimit after guard → group).

- [ ] **Step 1: Write the failing test (e2e via app.handle on the route module)**

Mock `pronoteDataService`; build the Elysia route, `app.handle(new Request(...))` with an authed context (mock authMacro like the existing route tests), assert 200 + JSON body for grades, and that an unmapped child surfaces a typed 4xx (not a 500).

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/server && bun test src/tests/pronote-data-routes.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the routes**

```ts
// apps/server/src/routes/pronote-data.routes.ts  (skeleton — mirror pronote-sync.routes.ts)
export const pronoteDataRoutes = new Elysia({ name: 'pronote-data-routes' })
  .use(authMacro)
  .onBeforeHandle(rateLimit)
  .guard({ auth: true })
  .group('/api/pronote/children', (app) => app
    .get('/:childId/grades', ({ params }) => pronoteDataService.getGrades(params.childId))
    .get('/:childId/homework', ({ params }) => pronoteDataService.getHomework(params.childId))
    .get('/:childId/timetable', ({ params, query }) => pronoteDataService.getTimetable(params.childId, query.day), {
      query: t.Object({ day: t.String() }),
    })
    .put('/:childId/resource', ({ params, body, user }) =>
      pronoteChildResourcesRepository.upsertMapping(user.id, params.childId, body.resourceId), {
      body: t.Object({ resourceId: t.Number() }),
    })
  );
```

Map typed service errors (`PronoteResourceNotMappedError`, `PronoteResolutionError`) to 4xx via Elysia `.onError` or an error handler; never leak a 500 for an expected condition.

- [ ] **Step 4: Mount in `app.ts`**

Add the import and `.use(pronoteDataRoutes)` next to `pronoteSyncRoutes` (around `app.ts:282`). Then update `apps/server/src/integration-tests/api-endpoints.test.ts` to mock `pronote-data.routes` the same way it mocks `pronote-sync.routes` (empty Elysia), so the integration suite doesn't pull the Drizzle schema chain.

- [ ] **Step 5: Run to verify it passes**

Run: `cd apps/server && bun test src/tests/pronote-data-routes.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/routes/pronote-data.routes.ts apps/server/src/app.ts apps/server/src/integration-tests/api-endpoints.test.ts apps/server/src/tests/pronote-data-routes.test.ts
git commit -m "feat(server): expose Pronote data + resource-mapping endpoints

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 8: Eden types build

- [ ] **Step 1: Rebuild API types**

Run: `cd /home/ordiv/projets/tomai-monorepo && pnpm --filter tomai-server build:types`
Expected: success; `apps/server/dist/types/app.d.ts` now includes the new routes.

- [ ] **Step 2: Typecheck the whole monorepo (App-tree types must stay exported)**

Run: `cd /home/ordiv/projets/tomai-monorepo && pnpm typecheck`
Expected: PASS across all packages (this catches the knip/build:types trap where App-tree types must remain exported).

- [ ] **Step 3: Commit if dist types are tracked**

If `apps/server/dist/types` is git-tracked, stage it; otherwise skip. `git status` to check, then commit only if there are changes.

### Task 9: End-to-end proof on the demo (real route, no mocks)

**Files:**
- Create: `apps/server/src/integration-tests/pronote-data.integration.test.ts` (promote the Task 0 probe into a named, gated integration test)

- [ ] **Step 1: Write a real e2e that seeds a parent+child, maps the demo resource, and reads via the HTTP route**

Using the real DB (integration suite) and the demo account: establish a real demo session via `connectWithCredentials` (the demo does NOT accept `loginToken` — Task 0 confirmed `BadCredentialsError`, so the token-rotation cycle is NOT provable on the demo), seed a parent+child pair, persist the parent credential, `PUT .../resource` the demo resource id, seed the demo session into the cache so resolution uses it, then `GET .../grades` through `app.handle()` and assert a non-empty normalized payload. This proves the full chain (resolution → resource → real read → normalized endpoint) with **zero mocks on the data path**.

**Explicitly document in the test (out of demo scope):** the token-based re-login cycle (`loginToken`) must be proven later against a REAL Pronote account (QR) — the demo cannot exercise it. Do NOT fake it.

Clean up: `DELETE FROM "user" WHERE email LIKE 'probe-%'` and the credential/mapping rows in an `afterAll`.

- [ ] **Step 2: Run the integration suite**

Run: `cd apps/server && bun run test:integration`
Expected: the new test PASSES (pre-existing RAG failures from a missing local ai-service are unrelated — note them, don't fix here).

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/integration-tests/pronote-data.integration.test.ts
git commit -m "test(server): e2e Pronote data read via real route on demo account

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 10: Final validation

- [ ] **Step 1: Full server gate**

Run: `cd apps/server && bun run typecheck && bun run lint && bun run test`
Expected: all green.

- [ ] **Step 2: Integration gate**

Run: `cd apps/server && bun run test:integration`
Expected: the Pronote chain green (RAG env failures excepted and noted).

- [ ] **Step 3: Monorepo typecheck**

Run: `cd /home/ordiv/projets/tomai-monorepo && pnpm typecheck && pnpm lint`
Expected: green.

- [ ] **Step 4: Push the branch and open a PR to main**

Push `feat/pronote-server-provider`; open a PR describing Phase 0+1 (server-side Pronote provider, demo-proven, mobile untouched). Merge is Victor's call (merge commit, via `gh api PUT .../merge`).

---

## Self-review (plan author)

- **Spec coverage:** port/adapter (T1–T2), session model (T3), `pronote_child_resources` + single-level resolution (T4–T6), endpoints (T7), token-only reuse of the existing vault (T5 re-persist), demo de-risk before build (Phase 0), e2e via real route (T9). Web/mobile/ENT/EcoleDirecte explicitly out of scope. Covered.
- **Open risk #3 (coexistence device/server):** not triggered in Phase 1 (demo account, no real device) — deferred to the mobile-migration plan. Stated.
- **Doc-first guardrails:** every pawnote field mapping is flagged "confirm against installed types + mobile usage, do not guess" (T0, T2). The child→parent column is read from the real schema before querying (T5 Step 1).
- **No silent gates:** RAG integration failures are pre-existing/env — called out, not silently passed.
