# E2E Dev Environment (mobile ↔ backend ↔ RAG) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any developer, on any OS, run the full stack locally and test the real mobile journey (login → chat with RAG → learning) against the real backend + RAG — manually and via an automated Maestro suite — with no hardcoded IP and zero false positives.

**Architecture:** The device derives the backend URL at runtime from the IP it already used to reach Metro (`Constants.expoConfig.hostUri`), so nothing is OS-specific. A deterministic, login-proven seed provides test accounts. A strict doctor mode (`--e2e`) proves every real dependency before any e2e run; missing dependencies fail loudly rather than passing in trompe-l'œil.

**Tech Stack:** Expo SDK 56 / React Native (mobile), Bun + Elysia + Drizzle + Better Auth (server), Node ESM scripts (`scripts/*.mjs`), Maestro (e2e), Qdrant Cloud + ai-service BGE-M3 + Mistral (RAG).

**Spec:** `docs/superpowers/specs/2026-06-23-e2e-dev-mobile-backend-rag-design.md`

## Global Constraints

- **Portability:** no OS-specific code (`if (wsl)`, hardcoded IP). The device resolves its own host at runtime. WSL/firewall is doc-only.
- **No false positives / no silent fallback:** a green signal means the real path ran and was observed. In e2e mode, `SKIP` and server `degraded` count as failure. No mocked responses simulating a working system.
- **Mobile:** TypeScript strict, zero `any` (CI-enforced); ESLint `--max-warnings 0`; 400 lines max per file.
- **Server:** validate before commit — `cd apps/server && bun run typecheck && bun run lint && bun run test`; before push also `bun run test:integration`.
- **Mobile validate before commit:** `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`.
- **Commits:** Conventional Commits in English (`<type>(<scope>): <desc>`), scopes from {chat, server, landing, mobile, ci, db, auth, rag, docs}. Stage files explicitly — never `git add .` / `-A`. Never `--amend`.
- **Backend port** is `3000` everywhere. ai-service host URL is `http://localhost:8001` (NOT `ai-service:8000`, which is intra-Docker only).

---

## Phase 1 — Socle (manual e2e)

### Task 1: `resolveApiUrl()` — portable backend URL resolution

**Files:**
- Create: `apps/mobile/src/lib/api-url.ts`
- Test: `apps/mobile/__tests__/lib/api-url.test.ts`

**Interfaces:**
- Consumes: `expo-constants` (`Constants.expoConfig?.hostUri`), global `__DEV__`, `process.env.EXPO_PUBLIC_API_URL`.
- Produces: `export function resolveApiUrl(): string` — the single source of truth for the backend base URL, consumed by Task 2.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/mobile/__tests__/lib/api-url.test.ts
import Constants from 'expo-constants';

// Mutable mock so each test can set a different hostUri.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { hostUri: '192.168.1.42:8081' } },
}));

const setHostUri = (value: string | undefined) => {
  (Constants as unknown as { expoConfig: { hostUri?: string } }).expoConfig.hostUri = value;
};
const setDev = (value: boolean) => {
  (globalThis as unknown as { __DEV__: boolean }).__DEV__ = value;
};

describe('resolveApiUrl', () => {
  const originalEnv = process.env.EXPO_PUBLIC_API_URL;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = originalEnv;
    jest.resetModules();
  });

  it('returns the explicit override when EXPO_PUBLIC_API_URL is set', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://tunnel.example.dev';
    setDev(true);
    const { resolveApiUrl } = require('@/lib/api-url');
    expect(resolveApiUrl()).toBe('https://tunnel.example.dev');
  });

  it('derives http://<host>:3000 from hostUri on a physical device in dev', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    setDev(true);
    setHostUri('192.168.1.42:8081');
    const { resolveApiUrl } = require('@/lib/api-url');
    expect(resolveApiUrl()).toBe('http://192.168.1.42:3000');
  });

  it('derives the Android emulator gateway from hostUri', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    setDev(true);
    setHostUri('10.0.2.2:8081');
    const { resolveApiUrl } = require('@/lib/api-url');
    expect(resolveApiUrl()).toBe('http://10.0.2.2:3000');
  });

  it('falls back to localhost (with a warning) when hostUri is missing in dev', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    setDev(true);
    setHostUri(undefined);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { resolveApiUrl } = require('@/lib/api-url');
    expect(resolveApiUrl()).toBe('http://localhost:3000');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('returns the production URL outside dev with no override', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    setDev(false);
    const { resolveApiUrl } = require('@/lib/api-url');
    expect(resolveApiUrl()).toBe('https://api.tomia.fr');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/mobile && pnpm test api-url`
Expected: FAIL — `Cannot find module '@/lib/api-url'`.

- [ ] **Step 3: Write the minimal implementation**

```typescript
// apps/mobile/src/lib/api-url.ts
/**
 * Resolves the backend base URL at runtime.
 *
 * Portable by design: on a device/emulator in dev we reuse the IP the device
 * already used to reach Metro (Constants.expoConfig.hostUri), so no developer
 * ever hardcodes a LAN IP and there is no OS-specific branch. The localhost
 * fallback is logged, never silent.
 */
import Constants from 'expo-constants';

const BACKEND_PORT = 3000;
const PROD_API_URL = 'https://api.tomia.fr';

export function resolveApiUrl(): string {
  const override = process.env.EXPO_PUBLIC_API_URL;
  if (override) return override;

  if (__DEV__) {
    const host = Constants.expoConfig?.hostUri?.split(':')[0];
    if (host) return `http://${host}:${BACKEND_PORT}`;
    console.warn(
      '[api-url] Constants.expoConfig.hostUri unavailable — falling back to localhost; a physical device will NOT reach the backend.',
    );
    return `http://localhost:${BACKEND_PORT}`;
  }

  return PROD_API_URL;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/mobile && pnpm test api-url`
Expected: PASS (5 tests).

- [ ] **Step 5: Validate**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint`
Expected: no errors, no warnings.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/lib/api-url.ts apps/mobile/__tests__/lib/api-url.test.ts
git commit -m "feat(mobile): portable backend URL resolution via Expo hostUri"
```

---

### Task 2: Wire `resolveApiUrl()` into api.ts and auth.ts

**Files:**
- Modify: `apps/mobile/src/lib/api.ts:15` (the `API_URL` const)
- Modify: `apps/mobile/src/lib/auth.ts:20` (the `API_URL` const)
- Test: `apps/mobile/__tests__/lib/api-init.test.ts`

**Interfaces:**
- Consumes: `resolveApiUrl()` from Task 1.
- Produces: `api.ts` and `auth.ts` no longer contain a hardcoded `'http://localhost:3000'`; both call `resolveApiUrl()`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/mobile/__tests__/lib/api-init.test.ts
const initializeApi = jest.fn();
jest.mock('@repo/api', () => ({
  initializeApi: (cfg: unknown) => initializeApi(cfg),
  setUnauthorizedHandler: jest.fn(),
}));
jest.mock('@/lib/auth', () => ({ authClient: { getCookie: () => null } }));
jest.mock('@/lib/api-url', () => ({ resolveApiUrl: () => 'http://192.168.1.42:3000' }));

describe('initializeAppApi', () => {
  it('initializes the API client with the resolved URL', () => {
    const { initializeAppApi } = require('@/lib/api');
    initializeAppApi();
    expect(initializeApi).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'http://192.168.1.42:3000' }),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/mobile && pnpm test api-init`
Expected: FAIL — `initializeApi` called with `http://localhost:3000` (current hardcoded default), not the resolved URL.

- [ ] **Step 3: Edit `apps/mobile/src/lib/api.ts`**

Replace:
```typescript
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
```
with:
```typescript
import { resolveApiUrl } from './api-url';

const API_URL = resolveApiUrl();
```
(place the import alongside the other top imports; keep the `console.log('[API] Initializing with URL:', API_URL);` line — it makes the resolved URL visible at boot.)

- [ ] **Step 4: Edit `apps/mobile/src/lib/auth.ts`**

Replace:
```typescript
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
```
with:
```typescript
import { resolveApiUrl } from './api-url';

const API_URL = resolveApiUrl();
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/mobile && pnpm test api-init`
Expected: PASS.

- [ ] **Step 6: Verify no hardcoded localhost remains**

Run: `cd apps/mobile && grep -rn "http://localhost:3000" src/lib/api.ts src/lib/auth.ts`
Expected: no matches.

- [ ] **Step 7: Validate**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`
Expected: green.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/lib/api.ts apps/mobile/src/lib/auth.ts apps/mobile/__tests__/lib/api-init.test.ts
git commit -m "refactor(mobile): consume resolveApiUrl in api and auth clients"
```

---

### Task 3: Deterministic seed of login-proven accounts (`pnpm seed`)

**Files:**
- Create: `apps/server/src/scripts/seed-dev.ts`
- Test: `apps/server/src/integration-tests/seed-dev.integration.test.ts`
- Modify: `apps/server/package.json` (add `seed` script)
- Modify: `package.json` (root, add `seed` script)

**Interfaces:**
- Consumes: `auth` (`auth.api.signUpEmail`, `auth.api.signInEmail`, `auth.api.signInUsername`) from `../lib/auth`; `usersRepository` (`findByEmail`, `findByUsername`, `update`, `deleteById`); `parentChildRepository` (`link`); `isProduction` from `../config/env`.
- Produces: `export async function seedDev(): Promise<{ parentId: string; childId: string }>` and a CLI entrypoint runnable via `bun run src/scripts/seed-dev.ts`. Seed credential defaults (used by Task 8): parent `dev.parent@tomai.local` / `DevParent123!`; child username `dev.eleve` / `DevEleve123!`, schoolLevel `troisieme`.

**Design notes (verify-then-repair, no hashing needed):** on each run, if both accounts exist AND both real logins succeed, the state is good — do nothing. Otherwise delete the parent (FK cascade removes child + link), recreate the pair via Better Auth, and **prove** both logins at the end (throw on failure). This guarantees the end state without re-implementing password hashing.

- [ ] **Step 1: Write the failing integration test**

```typescript
// apps/server/src/integration-tests/seed-dev.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';

// DB reachability guard — mirrors username-login.integration.test.ts
let dbReachable = false;
try {
  const { db } = await import('../db/connection');
  await db.execute(await import('drizzle-orm').then((m) => m.sql`SELECT 1`));
  dbReachable = true;
} catch {
  dbReachable = false;
}

describe.skipIf(!dbReachable)('seedDev — deterministic, login-proven accounts', () => {
  let auth: Awaited<typeof import('../lib/auth')>['auth'];

  beforeAll(async () => {
    auth = (await import('../lib/auth')).auth;
  });

  afterAll(async () => {
    // Cleanup: delete the parent, cascade removes the child.
    const { db } = await import('../db/connection');
    const { user } = await import('../db/schema');
    const { eq } = await import('drizzle-orm');
    await db.delete(user).where(eq(user.email, 'dev.parent@tomai.local')).catch(() => null);
  });

  it('creates a parent and a linked child that both log in for real', async () => {
    const { seedDev } = await import('../scripts/seed-dev');
    const { parentId, childId } = await seedDev();
    expect(parentId).toBeTruthy();
    expect(childId).toBeTruthy();

    const parentLogin = await auth.api.signInEmail({
      body: { email: 'dev.parent@tomai.local', password: 'DevParent123!' },
    });
    expect(parentLogin?.user?.id).toBe(parentId);

    const childLogin = await auth.api.signInUsername({
      body: { username: 'dev.eleve', password: 'DevEleve123!' },
    });
    expect(childLogin?.user?.username).toBe('dev.eleve');
  });

  it('is idempotent — a second run does not duplicate and still proves login', async () => {
    const { seedDev } = await import('../scripts/seed-dev');
    const first = await seedDev();
    const second = await seedDev();
    expect(second.parentId).toBe(first.parentId);
    expect(second.childId).toBe(first.childId);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/server && bun test src/integration-tests/seed-dev.integration.test.ts`
Expected: FAIL — `Cannot find module '../scripts/seed-dev'` (or SKIP if DB unreachable — start the DB with `pnpm dev` first so the suite actually runs).

- [ ] **Step 3: Write the seed script**

```typescript
// apps/server/src/scripts/seed-dev.ts
#!/usr/bin/env bun
/**
 * Deterministic dev seed: one parent + one linked child (autonomous login),
 * with known credentials. Verify-then-repair guarantees the end state and
 * PROVES both real logins. Refuses to run in production.
 *
 * Usage: cd apps/server && bun run seed
 */
import { isProduction } from '../config/env';
import { auth } from '../lib/auth';
import { usersRepository } from '../db/repositories/users.repository';
import { parentChildRepository } from '../db/repositories/parent-child.repository';

const SEED = {
  parentEmail: process.env.SEED_PARENT_EMAIL ?? 'dev.parent@tomai.local',
  parentPassword: process.env.SEED_PARENT_PASSWORD ?? 'DevParent123!',
  parentName: 'Dev Parent',
  childUsername: process.env.SEED_CHILD_USERNAME ?? 'dev.eleve',
  childPassword: process.env.SEED_CHILD_PASSWORD ?? 'DevEleve123!',
  childFirstName: 'Dev',
  childLastName: 'Eleve',
  childSchoolLevel: 'troisieme',
};

async function canLoginEmail(email: string, password: string): Promise<boolean> {
  try {
    await auth.api.signInEmail({ body: { email, password } });
    return true;
  } catch {
    return false;
  }
}

async function canLoginUsername(username: string, password: string): Promise<boolean> {
  try {
    await auth.api.signInUsername({ body: { username, password } });
    return true;
  } catch {
    return false;
  }
}

export async function seedDev(): Promise<{ parentId: string; childId: string }> {
  if (isProduction()) {
    throw new Error('[seed] refusing to run in production');
  }

  const existingParent = await usersRepository.findByEmail(SEED.parentEmail);
  const existingChild = await usersRepository.findByUsername(SEED.childUsername);

  const healthy =
    !!existingParent &&
    !!existingChild &&
    (await canLoginEmail(SEED.parentEmail, SEED.parentPassword)) &&
    (await canLoginUsername(SEED.childUsername, SEED.childPassword));

  if (healthy && existingParent && existingChild) {
    console.log('[seed] accounts already present and login-verified — nothing to do');
    return { parentId: existingParent.id, childId: existingChild.id };
  }

  // Repair: drop both (parent cascade removes child + link), recreate fresh.
  if (existingParent) await usersRepository.deleteById(existingParent.id);
  if (existingChild) await usersRepository.deleteById(existingChild.id);

  const parent = await auth.api.signUpEmail({
    body: { email: SEED.parentEmail, password: SEED.parentPassword, name: SEED.parentName },
  });
  await usersRepository.update(parent.user.id, { role: 'parent', firstName: 'Dev', lastName: 'Parent' });

  // The username plugin augments signUpEmail at runtime; cast only the username add.
  const childBody = {
    email: `child_${Date.now()}_${Math.random().toString(36).substring(7)}@internal.tomai`,
    password: SEED.childPassword,
    name: `${SEED.childFirstName} ${SEED.childLastName}`,
  };
  const child = await auth.api.signUpEmail({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: { ...childBody, username: SEED.childUsername } as typeof childBody & Record<string, any>,
  });
  await usersRepository.update(child.user.id, {
    firstName: SEED.childFirstName,
    lastName: SEED.childLastName,
    username: SEED.childUsername,
    displayUsername: SEED.childUsername,
    role: 'student',
    schoolLevel: SEED.childSchoolLevel as never,
  });
  await parentChildRepository.link(parent.user.id, child.user.id);

  // PROVE the end state — a seed that does not prove login is a false positive.
  if (!(await canLoginEmail(SEED.parentEmail, SEED.parentPassword))) {
    throw new Error('[seed] parent login verification failed after seed');
  }
  if (!(await canLoginUsername(SEED.childUsername, SEED.childPassword))) {
    throw new Error('[seed] child login verification failed after seed');
  }

  console.log(`[seed] OK — parent ${SEED.parentEmail} / child username ${SEED.childUsername}`);
  return { parentId: parent.user.id, childId: child.user.id };
}

// CLI entrypoint
if (import.meta.main) {
  seedDev()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
```

- [ ] **Step 4: Add the `seed` scripts**

In `apps/server/package.json` scripts, add:
```json
"seed": "bun run src/scripts/seed-dev.ts",
```
In root `package.json` scripts, add:
```json
"seed": "turbo run seed --filter=tomai-server",
```
If `seed` is not a known turbo task, instead add to root `package.json`:
```json
"seed": "pnpm --filter tomai-server seed",
```
(Pick the form consistent with how other root scripts delegate; `dev:server` uses turbo filters, but `seed` has no turbo task defined — prefer the `pnpm --filter` form unless a `seed` task is added to `turbo.json`.)

- [ ] **Step 5: Run the test to verify it passes**

Ensure the stack DB is up: `pnpm dev` (or `docker compose up -d postgres`).
Run: `cd apps/server && bun test src/integration-tests/seed-dev.integration.test.ts`
Expected: PASS (2 tests). Then run the CLI once: `cd apps/server && bun run seed` → prints `[seed] OK …`, exit 0.

- [ ] **Step 6: Validate**

Run: `cd apps/server && bun run typecheck && bun run lint`
Expected: green. (The seed script is standalone — never imported by `app.ts`/`server-lifecycle.ts` — so it does not touch the `api-endpoints.test.ts` Drizzle-mock trap.)

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/scripts/seed-dev.ts apps/server/src/integration-tests/seed-dev.integration.test.ts apps/server/package.json package.json
git commit -m "feat(server): deterministic login-proven dev seed (pnpm seed)"
```

---

### Task 4: Seed a sample learning deck for the child

**Files:**
- Modify: `apps/server/src/scripts/seed-dev.ts` (extend `seedDev` to create one deck for the child)
- Modify: `apps/server/src/integration-tests/seed-dev.integration.test.ts` (assert the deck exists)

**Interfaces:**
- Consumes: the learning deck schema + repository (to be located in Step 1).
- Produces: after seed, the child owns at least one deck (so `learning-flashcard.yaml` has something to tap).

- [ ] **Step 1: Locate the learning deck schema and repository**

Run: `cd apps/server && grep -rln "deck" src/db/schema src/db/repositories`
Read the deck schema table (columns, required fields, owner/user FK) and any `decks.repository.ts`. Record the exact insert shape. If decks are created only through a service with side effects (FSRS scheduling), prefer the repository's `create`/insert; if no repository exists, insert via `db.insert(decks).values({...})` using the schema import.

- [ ] **Step 2: Write the failing assertion**

Add to the existing seed integration test, inside the first `it(...)` after the child login assertion:
```typescript
    const { db } = await import('../db/connection');
    const schema = await import('../db/schema');
    const { eq } = await import('drizzle-orm');
    // Replace `decks` / `userId` with the real names found in Step 1.
    const childDecks = await db
      .select()
      .from(schema.decks)
      .where(eq(schema.decks.userId, childId));
    expect(childDecks.length).toBeGreaterThan(0);
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd apps/server && bun test src/integration-tests/seed-dev.integration.test.ts`
Expected: FAIL — `childDecks.length` is 0.

- [ ] **Step 4: Extend `seedDev` to create one deck**

After `parentChildRepository.link(...)` and before the login proofs, insert one deck owned by the child. Use the exact table/columns from Step 1; example shape (adjust names):
```typescript
import { db } from '../db/connection';
import { decks } from '../db/schema';
// ...
await db.insert(decks).values({
  userId: child.user.id,
  title: 'Deck de démo',
  // ...required columns with sensible dev defaults
}).onConflictDoNothing();
```
Make it idempotent (`onConflictDoNothing` or a pre-check) so repeated seeds do not pile up decks.

- [ ] **Step 5: Run to verify it passes**

Run: `cd apps/server && bun test src/integration-tests/seed-dev.integration.test.ts`
Expected: PASS.

- [ ] **Step 6: Validate & commit**

```bash
cd apps/server && bun run typecheck && bun run lint
git add apps/server/src/scripts/seed-dev.ts apps/server/src/integration-tests/seed-dev.integration.test.ts
git commit -m "feat(server): seed a sample learning deck for the dev child"
```

> If the learning deck schema turns out to require heavy domain wiring (FSRS state, cards), keep this task minimal (one empty deck) or split card-seeding into a follow-up — do not expand scope here.

---

### Task 5: Strict doctor mode `--e2e` (SKIP/degraded = failure)

**Files:**
- Modify: `scripts/doctor-checks.mjs` (add `mistralKey` to config; `strict` to `runChecks`; `e2e` to `buildChecks`; a Mistral-key check)
- Modify: `scripts/doctor.mjs` (parse `--e2e`)
- Create: `scripts/doctor-checks.test.mjs` (node:test for the strict semantics)
- Modify: `package.json` (root, add `doctor:e2e`)

**Interfaces:**
- Consumes: existing `buildChecks(ctx, { full })`, `runChecks(checks, { log })`, `loadConfig()`, `skip()` / `SKIP`.
- Produces: `runChecks(checks, { log, strict })` where `strict` makes `SKIP` count as failure; `buildChecks(ctx, { full, e2e })`; `pnpm doctor:e2e` with exit ≠ 0 if any real dependency is absent or the server is `degraded`.

- [ ] **Step 1: Write the failing test**

```javascript
// scripts/doctor-checks.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runChecks, skip } from './doctor-checks.mjs';

const noop = () => {};
const passing = { name: 'pass', run: async () => {} };
const skipping = { name: 'skip', run: async () => { throw skip('not reachable'); } };

test('non-strict: a skipping check does not fail the run', async () => {
  const r = await runChecks([passing, skipping], { log: noop });
  assert.equal(r.exitCode, 0);
  assert.equal(r.skipped, 1);
});

test('strict: a skipping check fails the run', async () => {
  const r = await runChecks([passing, skipping], { log: noop, strict: true });
  assert.equal(r.exitCode, 1);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test scripts/doctor-checks.test.mjs`
Expected: FAIL — the strict test fails because `runChecks` ignores `strict` (skip still counts as skipped).

- [ ] **Step 3: Make `runChecks` strict-aware**

In `scripts/doctor-checks.mjs`, change the `runChecks` signature and the SKIP branch:
```javascript
export async function runChecks(checks, { log = console.log, strict = false } = {}) {
  let passed = 0, failed = 0, skipped = 0;

  for (const check of checks) {
    try {
      await check.run();
      log(`${STATUS.pass}  ${check.name}`);
      passed++;
    } catch (err) {
      if (err[SKIP] && !strict) {
        log(`${STATUS.skip}  ${check.name} — ${err.message}`);
        skipped++;
      } else {
        const tag = err[SKIP] ? `${STATUS.fail}  ${check.name} — [e2e strict] ${err.message}` : `${STATUS.fail}  ${check.name} — ${err.message}`;
        log(tag);
        failed++;
      }
    }
  }

  return { passed, failed, skipped, exitCode: failed > 0 ? 1 : 0 };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test scripts/doctor-checks.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Add the Mistral-key check and `e2e` wiring**

In `loadConfig()` return object, add:
```javascript
    mistralKey:      env('MISTRAL_API_KEY'),
```
Add a check factory (near the other check factories):
```javascript
function checkMistralKey(ctx) {
  return { name: 'MISTRAL_API_KEY présent (LLM chat)', run: async () => {
    if (!ctx.config.mistralKey) {
      throw skip('MISTRAL_API_KEY absent — chat LLM indisponible (preuve LLM réelle = flow Maestro chat)');
    }
  }};
}
```
In `buildChecks`, accept and use `e2e`:
```javascript
export function buildChecks(ctx, { full = true, e2e = false } = {}) {
  const checks = [/* ...existing infra checks... */];
  if (!full) return checks;
  const fullChecks = [...checks, /* ...existing full checks (migrations, RAG roundtrip, server health)... */];
  if (e2e) fullChecks.push(checkMistralKey(ctx));
  return fullChecks;
}
```
(Keep the existing arrays intact; only add `checkMistralKey` when `e2e`. The existing server `/api/curriculum-health` check already FAILs on `degraded`; in strict mode its `SKIP` when the server is down also becomes a failure, which is what we want for e2e.)

- [ ] **Step 6: Parse `--e2e` in `doctor.mjs`**

```javascript
const e2e = process.argv.includes('--e2e');
const summary = await runChecks(buildChecks(ctx, { full: true, e2e }), { strict: e2e });
```

- [ ] **Step 7: Add the root script**

In root `package.json` scripts:
```json
"doctor:e2e": "node scripts/doctor.mjs --e2e",
```

- [ ] **Step 8: Prove it end-to-end**

With the full stack up and real creds (`pnpm dev`, server running, Qdrant Cloud + Mistral configured):
Run: `pnpm doctor:e2e`
Expected: exit 0, all checks PASS.
Then temporarily unset `MISTRAL_API_KEY` (or stop ai-service) and re-run:
Expected: exit ≠ 0 with an explicit failure — no SKIP, no degraded pass.

- [ ] **Step 9: Commit**

```bash
git add scripts/doctor-checks.mjs scripts/doctor.mjs scripts/doctor-checks.test.mjs package.json
git commit -m "feat(ci): strict doctor --e2e mode (skip/degraded = failure)"
```

---

### Task 6: Dev docs — testing on a physical device + env reference

**Files:**
- Modify: `apps/mobile/CLAUDE.md` (Troubleshooting + a "Test on a physical device" note)
- Modify: `CLAUDE.md` (root, "Commandes" — add `pnpm seed`, `pnpm doctor:e2e`)
- Modify: `apps/server/README.md` (env reference: `AI_SERVICE_URL=http://localhost:8001`, `SEED_*` block)

**Interfaces:**
- Consumes: nothing (documentation).
- Produces: a portable, OS-agnostic description of how a device reaches the local backend, plus the `SEED_*` env block (for manual paste into `.env.example`, which is read-protected by permissions).

- [ ] **Step 1: Add the physical-device section to `apps/mobile/CLAUDE.md`**

Under "Workflow dev" (or a new "## Test e2e en dev" section), add:
```markdown
### Tester sur un device physique (mobile ↔ backend local)

`pnpm dev` (backend) + `pnpm dev:mobile` (Metro). L'app dérive l'URL du backend
de l'IP par laquelle le device a joint Metro (`Constants.expoConfig.hostUri`),
donc **rien à configurer** : device physique → IP LAN, émulateur Android →
10.0.2.2, simulateur iOS → localhost. L'URL résolue est loggée au boot (`[API]`).

Si le device ne joint pas le backend : vérifier le même Wi-Fi et le pare-feu du
poste. **Sous WSL2**, le backend tourne dans la VM Linux — activer le réseau
miroir : `%UserProfile%\.wslconfig` → `[wsl2]` `networkingMode=mirrored`, puis
`wsl --shutdown` et ouvrir le port (Hyper-V firewall). C'est un réglage de poste,
hors du repo.
```

- [ ] **Step 2: Update the root `CLAUDE.md` commands block**

Add to the `## Commandes` code block:
```bash
pnpm seed                         # Comptes de test (parent + élève) login-prouvés
pnpm doctor:e2e                   # Diagnostic strict : toute dépendance réelle doit répondre
```

- [ ] **Step 3: Add the env reference (server README)**

In `apps/server/README.md`, near the env documentation, add:
```markdown
### Dev seed (optionnel — défauts intégrés au script)

| Variable | Défaut | Rôle |
|---|---|---|
| `SEED_PARENT_EMAIL` | `dev.parent@tomai.local` | login parent |
| `SEED_PARENT_PASSWORD` | `DevParent123!` | login parent |
| `SEED_CHILD_USERNAME` | `dev.eleve` | login élève autonome |
| `SEED_CHILD_PASSWORD` | `DevEleve123!` | login élève autonome |

`AI_SERVICE_URL=http://localhost:8001` quand le backend tourne sur l'host
(`ai-service:8000` est l'adresse **intra-Docker**, inutilisable depuis l'host).
```

- [ ] **Step 4: Provide the `.env.example` block (manual paste)**

`.env*` files are read-protected by the permission settings, so this block is not auto-edited. Note in the PR description that the maintainer should paste it into `apps/server/.env.example`:
```dotenv
# Dev seed (pnpm seed) — dev-only, refused in production
SEED_PARENT_EMAIL=dev.parent@tomai.local
SEED_PARENT_PASSWORD=DevParent123!
SEED_CHILD_USERNAME=dev.eleve
SEED_CHILD_PASSWORD=DevEleve123!
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/CLAUDE.md CLAUDE.md apps/server/README.md
git commit -m "docs(dev): physical-device testing + seed/doctor env reference"
```

---

## Phase 2 — Automated e2e (local)

### Task 7: Label the Pronote stub explicitly (no false positive)

**Files:**
- Modify: `apps/mobile/e2e/pronote-onboarding.yaml` (header comment making the stub unmistakable)
- Modify: `apps/mobile/src/services/pronote/pronote-e2e-stubs.ts` (top-of-file doc comment)

**Interfaces:**
- Consumes: nothing.
- Produces: the stubbed Pronote flow is unmistakably labeled as UI-only; no reader can mistake a green run for verified Pronote connectivity.

- [ ] **Step 1: Add a header comment to the Maestro flow**

At the top of `apps/mobile/e2e/pronote-onboarding.yaml` (after `appId:`), add a comment block:
```yaml
# E2E SCOPE: onboarding UI only. QR scan / discovery / activation are STUBBED
# (EXPO_PUBLIC_E2E=1). This flow does NOT verify real Pronote/ENT connectivity.
# Real connectivity is covered by the server-side demo integration smoke
# (see apps/server/src/integration-tests/pronote-demo.integration.test.ts, Task 9).
```

- [ ] **Step 2: Add a doc comment to the stubs file**

At the top of `apps/mobile/src/services/pronote/pronote-e2e-stubs.ts`, add:
```typescript
/**
 * E2E stubs for the Pronote onboarding UI flow (EXPO_PUBLIC_E2E=1, preview only).
 * These deterministic fixtures replace QR scan / discovery / activation so the
 * UI can be driven by Maestro. They DO NOT exercise real Pronote connectivity —
 * that is verified separately by the server demo-server integration smoke.
 */
```

- [ ] **Step 3: Validate & commit**

```bash
cd apps/mobile && pnpm lint
git add apps/mobile/e2e/pronote-onboarding.yaml apps/mobile/src/services/pronote/pronote-e2e-stubs.ts
git commit -m "docs(mobile): label Pronote e2e stub as UI-only (no connectivity claim)"
```

---

### Task 8: `pnpm e2e:local` — orchestrate strict-proof → seed → Maestro

**Files:**
- Create: `scripts/e2e-local.mjs`
- Modify: `package.json` (root, add `e2e:local`)

**Interfaces:**
- Consumes: `pnpm doctor:e2e` (Task 5), `pnpm seed` (Task 3), the Maestro flows and their `${E2E_*}` variables.
- Produces: `pnpm e2e:local` that refuses to start (exit ≠ 0) unless every real dependency proves out, then seeds and runs Maestro against the local backend with the seeded credentials.

- [ ] **Step 1: Collect the exact `${E2E_*}` variable names**

Run: `cd apps/mobile && grep -rhoE '\$\{E2E_[A-Z_]+\}' e2e/ | sort -u`
Record the exact names (e.g. `E2E_STUDENT_USERNAME`, `E2E_STUDENT_PASSWORD`, `E2E_PARENT_EMAIL`, `E2E_PARENT_PASSWORD`). Use these exact keys in Step 2.

- [ ] **Step 2: Write the orchestration script**

```javascript
#!/usr/bin/env node
// pnpm e2e:local — real-path e2e: prove every dependency (doctor --e2e) -> seed
// -> Maestro against the LOCAL backend. Refuses to run on a half-up stack so a
// green Maestro run can never be a false positive.
//
// Preconditions: `pnpm dev` running (backend + infra), `pnpm dev:mobile` (Metro)
// running, a dev client installed on a connected device/emulator, and Maestro
// installed (https://maestro.mobile.dev). The app auto-resolves the backend URL
// from Metro's host, so no API URL needs to be set here.
import { spawnSync } from 'node:child_process';

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { stdio: 'inherit', ...opts }).status ?? 1;
}

console.log('[e2e:local] 1/3 — doctor --e2e (every real dependency must answer)…');
if (run('node', ['scripts/doctor.mjs', '--e2e']) !== 0) {
  console.error('[e2e:local] real dependencies missing — aborting (no trompe-l\'œil e2e). Fix creds/stack, then retry.');
  process.exit(1);
}

console.log('[e2e:local] 2/3 — deterministic seed…');
if (run('pnpm', ['--filter', 'tomai-server', 'seed']) !== 0) {
  console.error('[e2e:local] seed failed — aborting.');
  process.exit(1);
}

console.log('[e2e:local] 3/3 — Maestro against the local backend…');
// Seed defaults must match seed-dev.ts. Map them onto the flows' ${E2E_*} keys
// (confirmed in Step 1).
const seedEnv = {
  E2E_STUDENT_USERNAME: process.env.SEED_CHILD_USERNAME ?? 'dev.eleve',
  E2E_STUDENT_PASSWORD: process.env.SEED_CHILD_PASSWORD ?? 'DevEleve123!',
  E2E_PARENT_EMAIL: process.env.SEED_PARENT_EMAIL ?? 'dev.parent@tomai.local',
  E2E_PARENT_PASSWORD: process.env.SEED_PARENT_PASSWORD ?? 'DevParent123!',
};
const code = run('maestro', ['test', 'apps/mobile/e2e/'], { env: { ...process.env, ...seedEnv } });
process.exit(code);
```
(If Step 1 found different `${E2E_*}` keys — e.g. `E2E_PARENT_USERNAME` instead of `E2E_PARENT_EMAIL` — adjust `seedEnv` keys to match exactly.)

- [ ] **Step 3: Add the root script**

In root `package.json` scripts:
```json
"e2e:local": "node scripts/e2e-local.mjs",
```

- [ ] **Step 4: Prove the guard rejects a half-up stack**

With the stack down (or `MISTRAL_API_KEY` unset):
Run: `pnpm e2e:local`
Expected: stops at step 1/3 with exit ≠ 0 and the explicit abort message — never proceeds to Maestro.

- [ ] **Step 5: Prove the happy path (with a device connected)**

With `pnpm dev` + `pnpm dev:mobile` running, dev client on a connected device, real creds:
Run: `pnpm e2e:local`
Expected: doctor green → seed `OK` → Maestro runs auth/chat/learning against the local backend and passes (chat asserts a real Mistral/RAG response).

- [ ] **Step 6: Commit**

```bash
git add scripts/e2e-local.mjs package.json
git commit -m "feat(ci): pnpm e2e:local — strict-proof, seed, Maestro on local backend"
```

---

### Task 9: Real Pronote connectivity smoke (demo server) — investigate then implement or document

**Files:**
- Create (if feasible): `apps/server/src/integration-tests/pronote-demo.integration.test.ts`
- Modify (if not feasible): `docs/superpowers/specs/2026-06-23-e2e-dev-mobile-backend-rag-design.md` (document the gap explicitly)

**Interfaces:**
- Consumes: the server-side pawnote integration (locate the Pronote service/client that performs `loginQrCode` / data reads).
- Produces: either a real, loudly-skipping integration smoke against an Index Education demo server, or a written, explicit "gap" entry in the spec — never a hidden untested path.

- [ ] **Step 1: Investigate feasibility (doc-first)**

Locate the server Pronote login path: `cd apps/server && grep -rln "pawnote\|loginQrCode\|qr" src/services/pronote`. Read the demo/test affordances of the installed pawnote version (`node_modules/pawnote` types/readme) and confirm whether a public Index Education demo server (`*.index-education.net/.../pronote/`) can be reached for an unauthenticated or demo login. Record the exact pawnote call and the demo URL.

- [ ] **Step 2a (feasible): Write a loudly-skipping real smoke**

```typescript
// apps/server/src/integration-tests/pronote-demo.integration.test.ts
import { describe, it, expect } from 'bun:test';

const RUN = process.env.PRONOTE_DEMO_E2E === '1';

describe.skipIf(!RUN)('Pronote demo-server connectivity (real)', () => {
  it('reaches a real Index Education demo and reads data', async () => {
    // Use the exact pawnote call recorded in Step 1.
    let reachable = true;
    try {
      // ... real pawnote demo login + minimal read ...
    } catch (err) {
      reachable = false;
      console.warn('[pronote-demo] demo unreachable — integration NOT verified:', err);
    }
    // When explicitly enabled, an unreachable demo is a real failure, not a pass.
    expect(reachable).toBe(true);
  });
});
```
Wire `PRONOTE_DEMO_E2E=1` into `pnpm e2e:local` only if Step 1 confirmed a stable demo; otherwise leave it opt-in (documented), never silently green.

- [ ] **Step 2b (not feasible): Document the gap**

If no stable demo path exists, add to the spec's "Risques et mitigations" a line: "Pronote real connectivity is NOT covered by automated e2e — verified manually with a real account during release. The Maestro onboarding flow is UI-only (stubbed)." Commit the spec change. This keeps the gap visible instead of hidden behind a green stub.

- [ ] **Step 3: Validate & commit**

```bash
cd apps/server && bun run typecheck && bun run lint
# feasible path:
git add apps/server/src/integration-tests/pronote-demo.integration.test.ts
git commit -m "test(server): real Pronote demo-server connectivity smoke (opt-in)"
# OR gap-documentation path:
git add docs/superpowers/specs/2026-06-23-e2e-dev-mobile-backend-rag-design.md
git commit -m "docs(dev): document Pronote real-connectivity e2e gap"
```

---

## Self-Review

**Spec coverage:**
- Pièce A (URL auto) → Tasks 1–2. ✅
- Pièce B (backend joignable, auth inchangée) → verified in spec/Task 2 wiring; no code change needed beyond URL (documented). ✅
- Pièce C (seed) → Task 3. ✅
- Pièce D (env clair) → Task 6 (README + manual `.env.example` block, given permission constraint). ✅
- Pièce E (doctor strict + doc) → Tasks 5–6. ✅
- Pièce F (matrice + Pronote label + real smoke) → Tasks 7, 9. ✅
- Pièce G (`e2e:local`) → Task 8. ✅
- Sample deck for learning flow → Task 4. ✅

**Placeholder scan:** No TBD/"handle errors"/"similar to". Task 4 and Task 9 contain explicit "locate schema" / "investigate" steps with concrete deliverables in both branches, not placeholders.

**Type consistency:** `resolveApiUrl()` (Task 1) is the name consumed in Task 2. `seedDev()` return `{ parentId, childId }` (Task 3) is the shape asserted in Tasks 3–4. `runChecks(checks, { log, strict })` and `buildChecks(ctx, { full, e2e })` (Task 5) match `doctor.mjs` usage. Seed credential defaults are identical in Task 3 and Task 8.

**Known constraints carried:** `.env.example` is read-protected → handled by in-script defaults + manual paste note. Seed script is standalone → avoids the `api-endpoints.test.ts` Drizzle-mock trap. Real Mistral proof is the Maestro chat flow, not the doctor (documented in Task 5).
