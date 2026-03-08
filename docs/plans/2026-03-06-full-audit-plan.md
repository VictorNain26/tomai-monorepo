# Full Codebase Audit & Modernization — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Modernize the entire TomAI codebase (server + mobile + packages) to align with 2026 best practices.

**Architecture:** 5 phases executed sequentially on staging branch. Each phase produces atomic commits. Typecheck + lint + tests validated before each commit.

**Tech Stack:** Expo 55, React Native 0.83, Elysia 1.4, Drizzle ORM v1, NativeWind v5, TypeScript 5.9.3, Bun, pnpm 10

---

## Phase 1 — Migrations de dependances

### Task 1: Split schema.ts into domain modules (prerequisite for Drizzle v1)

**Files:**
- Modify: `apps/server/src/db/schema.ts` (1410 lines -> index re-export)
- Create: `apps/server/src/db/schema/auth.schema.ts`
- Create: `apps/server/src/db/schema/learning.schema.ts`
- Create: `apps/server/src/db/schema/pronote.schema.ts`
- Create: `apps/server/src/db/schema/billing.schema.ts`
- Create: `apps/server/src/db/schema/files.schema.ts`
- Create: `apps/server/src/db/schema/notifications.schema.ts`
- Create: `apps/server/src/db/schema/index.ts`

**Step 1: Create the schema directory and plan the split**

Domain groupings:
- `auth.schema.ts`: user, session, account, verification, parentRestoreToken tables + enums (schoolLevelEnum, userRoleEnum) + their relations
- `learning.schema.ts`: studySessions, messages, progress, learningDecks, learningCards, learningCardReviews, studentCognitiveProfiles, costTracking + enums (sessionStatusEnum, messageRoleEnum) + their relations
- `pronote.schema.ts`: pronoteConnections, pronoteChildMappings + their relations
- `billing.schema.ts`: subscriptionPlans, userSubscriptions, familyBilling, webhookEvents + their relations
- `files.schema.ts`: files, sessionFiles + their relations
- `notifications.schema.ts`: devicePushTokens + their relations

**Step 2: Create each schema file**

Move tables, enums, indexes, and relations for each domain into its file. Each file imports from `drizzle-orm/pg-core` and exports all its tables and relations.

**Step 3: Create index.ts re-export**

```typescript
// apps/server/src/db/schema/index.ts
export * from './auth.schema';
export * from './learning.schema';
export * from './pronote.schema';
export * from './billing.schema';
export * from './files.schema';
export * from './notifications.schema';
```

**Step 4: Update the old schema.ts**

```typescript
// apps/server/src/db/schema.ts
export * from './schema/index';
```

**Step 5: Run typecheck and tests**

Run: `cd apps/server && bun run typecheck && bun test`
Expected: All pass (re-exports preserve all existing imports)

**Step 6: Commit**

```
feat(server): split schema.ts into domain modules

Schema was 1410 lines, split into auth/learning/pronote/billing/files/notifications.
Re-exported from schema.ts for backward compatibility.
```

---

### Task 2: Migrate Drizzle ORM to v1

**Files:**
- Modify: `apps/server/package.json` (drizzle-orm, drizzle-kit versions)
- Create: `apps/server/src/db/relations.ts`
- Modify: `apps/server/src/db/connection.ts` (schema -> relations)
- Modify: `apps/server/src/db/schema/auth.schema.ts` (export relations separately)
- Modify: `apps/server/src/db/schema/learning.schema.ts`
- Modify: `apps/server/src/db/schema/pronote.schema.ts`
- Modify: `apps/server/src/db/schema/billing.schema.ts`
- Modify: `apps/server/src/db/schema/files.schema.ts`
- Modify: `apps/server/src/db/schema/notifications.schema.ts`

**Reference:** https://orm.drizzle.team/docs/upgrade-v1 and https://orm.drizzle.team/docs/relations-v1-v2

**Step 1: Install Drizzle v1**

Run: `cd apps/server && bun add drizzle-orm@beta && bun add -D drizzle-kit@beta`

**Step 2: Create relations.ts**

Collect all `*Relations` exports from schema files into a single relations object:

```typescript
// apps/server/src/db/relations.ts
import { userRelations, sessionRelations, accountRelations } from './schema/auth.schema';
import { studySessionsRelations, messagesRelations, progressRelations, costTrackingRelations, learningDecksRelations, learningCardsRelations, studentCognitiveProfilesRelations } from './schema/learning.schema';
import { pronoteConnectionsRelations, pronoteChildMappingsRelations } from './schema/pronote.schema';
import { subscriptionPlansRelations, userSubscriptionsRelations, familyBillingRelations } from './schema/billing.schema';
import { filesRelations, sessionFilesRelations } from './schema/files.schema';
import { devicePushTokensRelations } from './schema/notifications.schema';

export const relations = {
  userRelations,
  sessionRelations,
  accountRelations,
  studySessionsRelations,
  messagesRelations,
  progressRelations,
  costTrackingRelations,
  filesRelations,
  sessionFilesRelations,
  pronoteConnectionsRelations,
  pronoteChildMappingsRelations,
  subscriptionPlansRelations,
  userSubscriptionsRelations,
  familyBillingRelations,
  devicePushTokensRelations,
  learningDecksRelations,
  learningCardsRelations,
  studentCognitiveProfilesRelations,
};
```

**Step 3: Update connection.ts**

```typescript
// Before
import * as schema from './schema';
const _db = drizzle(_sql, { schema, logger: ... });

// After
import { relations } from './relations';
const _db = drizzle(_sql, { relations, logger: ... });
```

**Step 4: Migrate relational queries (v1 -> v2 syntax)**

In `apps/server/src/services/pronote/pronote-auth.service.ts`, update all 10 `db.query.*` calls:

```typescript
// Before (v1)
const result = db.query.pronoteConnections.findFirst({
  where: eq(pronoteConnections.parentId, parentId),
  with: { childMappings: true },
});

// After (v2) - use db._query (deprecated bridge) or rewrite as SQL
const result = db.select()
  .from(pronoteConnections)
  .where(eq(pronoteConnections.parentId, parentId))
  .limit(1)
  .then(rows => rows[0]);
// + separate query for childMappings if needed
```

In `apps/server/src/services/cognitive-profile.service.ts`, update 1 `db.query.*` call.

**Step 5: Run typecheck, lint, and tests**

Run: `cd apps/server && bun run typecheck && bun run lint && bun test`

**Step 6: Run db:check to verify schema integrity**

Run: `cd apps/server && bun run db:check`

**Step 7: Commit**

```
feat(server): migrate Drizzle ORM to v1

- Install drizzle-orm@beta and drizzle-kit@beta
- Extract relations to dedicated relations.ts
- Update connection.ts to use { relations } instead of { schema }
- Migrate 11 relational queries to SQL-like syntax
```

---

### Task 3: Update NativeWind to v5 stable

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/metro.config.js` (if API changed)
- Verify: `apps/mobile/babel.config.js`, `apps/mobile/postcss.config.mjs`, `apps/mobile/src/global.css`

**Step 1: Check latest stable version**

Run: `cd apps/mobile && pnpm info nativewind versions --json | tail -20`

**Step 2: Update packages**

Run: `cd apps/mobile && pnpm add nativewind@latest react-native-css@latest`

**Step 3: Verify metro.config.js matches v5 stable API**

v5 stable uses `withNativewind(config)` (no second argument). Verify current config matches.

**Step 4: Verify babel.config.js**

v5 stable: NO `jsxImportSource: 'nativewind'`, NO `nativewind/babel` preset. Just plain `babel-preset-expo`.
Current config should already be correct (verified in audit).

**Step 5: Run the app to verify**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint`

**Step 6: Commit**

```
chore(mobile): update NativeWind to v5 stable
```

---

### Task 4: Regenerate React Native Reusables via CLI

**Files:**
- Modify: `apps/mobile/src/components/ui/*.tsx` (10 components)

**Step 1: Check current customizations**

Read each file in `src/components/ui/` and note customizations vs default RN Reusables templates:
- `button.tsx`: Custom haptic feedback, custom variants (subtle), custom sizes (icon-sm, icon-lg)
- `safe-area-view.tsx`: Custom CSS-wrapped SafeAreaView (NativeWind v5 workaround)
- Others: Check for project-specific modifications

**Step 2: Run CLI to see available components**

Run: `cd apps/mobile && npx @react-native-reusables/cli add --all --path src/components/ui`

**Step 3: Compare and merge**

For each component:
- If no customization: accept CLI version
- If customized (button, safe-area-view): keep custom version, only update if CLI version has improvements
- If new components available: evaluate if useful

**Step 4: Typecheck and lint**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint`

**Step 5: Commit**

```
chore(mobile): regenerate RN Reusables components via CLI
```

---

### Task 5: Migrate apiClient to Eden Treaty

**Files:**
- Modify: `packages/api/src/client.ts` (remove deprecated apiClient)
- Modify: `packages/api/src/index.ts` (remove apiClient export)
- Search & replace: All mobile files importing `apiClient`

**Step 1: Find all apiClient usages**

Run: `grep -rn "apiClient" apps/mobile/src/ packages/api/src/`

**Step 2: For each usage, replace with getTreaty()**

Pattern:
```typescript
// Before
import { apiClient } from '@repo/api';
const result = await apiClient.get('/api/endpoint');

// After
import { getTreaty } from '@repo/api';
const treaty = getTreaty();
const { data, error } = await treaty.api.endpoint.get();
```

**Step 3: Remove apiClient from packages/api**

Remove the `apiClient` singleton class and its export from `client.ts` and `index.ts`.

**Step 4: Typecheck all affected packages**

Run: `pnpm typecheck`

**Step 5: Commit**

```
refactor(api): remove deprecated apiClient, use Eden Treaty exclusively
```

---

## Phase 2 — Refactoring server

### Task 6: Clean server code

**Step 1: Find files exceeding 400 lines**

Run: `find apps/server/src -name "*.ts" -exec wc -l {} + | sort -rn | head -20`

**Step 2: For each file over 400 lines, split into modules**

Apply the same pattern as schema.ts split: extract into sub-files, re-export from index.

**Step 3: Remove dead code**

Check git status for deleted files (services/audio, services/pronote in mobile). Verify server-side equivalents are still needed.

**Step 4: Typecheck, lint, test**

Run: `cd apps/server && bun run typecheck && bun run lint && bun test`

**Step 5: Commit**

```
refactor(server): enforce 400-line limit, remove dead code
```

---

## Phase 3 — Refactoring mobile

### Task 7: Replace styles.ts with NativeWind CSS variables

**Files:**
- Delete: `apps/mobile/src/lib/styles.ts`
- Modify: `apps/mobile/src/global.css` (add missing CSS custom properties if needed)
- Modify: `apps/mobile/src/hooks/useIconColors.ts`
- Modify: All files importing from `@/lib/styles`

**Step 1: Find all styles.ts imports**

Run: `grep -rn "from.*@/lib/styles\|from.*lib/styles" apps/mobile/src/`

**Step 2: For each import, determine replacement**

- `colors.primary.light` -> Use NativeWind `text-primary` or `useColorScheme()` + CSS var
- `shadows.md` -> Use NativeWind shadow utilities
- `bgColors`, `borderColors` -> Use NativeWind opacity utilities (`bg-primary/10`)

For cases where raw color values are needed (icon props, ActivityIndicator):
- Keep a minimal `useThemeColors()` hook that reads from CSS variables via `useColorScheme()`
- Or use `cssInterop` to make those components className-compatible

**Step 3: Update useIconColors.ts**

Replace hardcoded palette with NativeWind theme tokens.

**Step 4: Delete styles.ts**

**Step 5: Typecheck and lint**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint`

**Step 6: Commit**

```
refactor(mobile): replace hardcoded styles.ts with NativeWind theme tokens
```

---

### Task 8: Split long mobile files

**Files:**
- `apps/mobile/src/hooks/useChat.ts` (267 lines)
- `apps/mobile/src/components/chat/ChatMessage.tsx` (272 lines)
- `apps/mobile/src/lib/auth.ts` (306 lines)

**Step 1: Split useChat.ts**

```
src/hooks/useChat.ts (orchestrator, ~80 lines)
src/hooks/chat/useMessages.ts (message state + optimistic updates)
src/hooks/chat/useAttachments.ts (pending attachments management)
src/hooks/chat/useSession.ts (session creation/reset)
```

useChat.ts becomes a facade that composes the sub-hooks.

**Step 2: Split ChatMessage.tsx**

```
src/components/chat/ChatMessage.tsx (container, ~80 lines)
src/components/chat/MessageBubble.tsx (visual wrapper)
src/components/chat/MessageContent.tsx (markdown/math/mermaid rendering)
src/components/chat/MessageActions.tsx (TTS, copy actions)
```

**Step 3: Split auth.ts**

```
src/lib/auth/client.ts (Better Auth client setup)
src/lib/auth/google.ts (Google Sign-In native + web fallback)
src/lib/auth/impersonation.ts (Quick Switch parent<->child)
src/lib/auth/index.ts (re-exports)
```

**Step 4: Typecheck and lint**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint`

**Step 5: Commit**

```
refactor(mobile): split long files (useChat, ChatMessage, auth)
```

---

### Task 9: Remove dead code in mobile

**Files:**
- Verify deletion: `apps/mobile/src/services/audio/index.ts`
- Verify deletion: `apps/mobile/src/services/pronote/index.ts`
- Check: Any other unused imports/exports

**Step 1: Confirm files are already deleted in git**

Run: `git status apps/mobile/src/services/`

**Step 2: Search for remaining imports to deleted files**

Run: `grep -rn "services/audio\|services/pronote" apps/mobile/src/`

**Step 3: Remove any dangling imports**

**Step 4: Check for other unused exports**

Run: `cd apps/mobile && pnpm typecheck` (unused imports will surface as errors with strict mode)

**Step 5: Commit**

```
chore(mobile): remove dead code (audio/pronote services)
```

---

## Phase 4 — Tests & qualite

### Task 10: Standardize test patterns

**Files:**
- Modify: `apps/server/src/tests/_helpers/` (create if needed)
- Modify: `apps/mobile/__tests__/` (organize)

**Step 1: Create shared test helpers for server**

```typescript
// apps/server/src/tests/_helpers/db.ts
// Test database setup/teardown helpers
```

**Step 2: Ensure all existing tests pass**

Run: `cd apps/server && bun test`
Run: `cd apps/mobile && pnpm test`

**Step 3: Document test conventions in CLAUDE.md** (already exists in .claude/rules/tdd.md)

**Step 4: Commit**

```
test: standardize test helpers and patterns
```

---

### Task 11: Add missing test coverage

**Priority services to test (server):**
- `chat.service.ts` — session management, message saving
- `rag.service.ts` — retrieval pipeline
- `pronote-auth.service.ts` — especially after Drizzle v1 migration

**Priority hooks to test (mobile):**
- `useChat` (after split) — each sub-hook independently
- `useStreamManager` — SSE streaming edge cases

**Step 1: Write tests for migrated Drizzle queries**

Verify that the SQL-like replacements return identical results to the old relational queries.

**Step 2: Write tests for split hooks**

Each sub-hook (useMessages, useAttachments, useSession) gets its own test file.

**Step 3: Run full test suite**

Run: `cd apps/server && bun test && cd ../mobile && pnpm test`

**Step 4: Commit**

```
test: add coverage for critical services and migrated queries
```

---

## Phase 5 — Securite & features

### Task 12: Add Better Auth Passkeys

**Files:**
- Modify: `apps/server/package.json` (add @better-auth/passkey)
- Modify: `apps/server/src/lib/auth.ts` (add passkey plugin)
- Modify: `apps/mobile/package.json` (add @better-auth/passkey)
- Modify: `apps/mobile/src/lib/auth.ts` (add passkeyClient plugin)
- Create: `apps/mobile/src/app/(auth)/passkey.tsx` (passkey registration UI)

**Step 1: Install server-side passkey plugin**

Run: `cd apps/server && bun add @better-auth/passkey`

**Step 2: Add passkey plugin to server auth config**

```typescript
import { passkey } from '@better-auth/passkey';

export const auth = betterAuth({
  plugins: [
    // ...existing plugins
    passkey(),
  ],
});
```

**Step 3: Install client-side passkey plugin**

Run: `cd apps/mobile && pnpm add @better-auth/passkey`

**Step 4: Add passkeyClient to mobile auth**

```typescript
import { passkeyClient } from '@better-auth/passkey/client';

export const authClient = createAuthClient({
  plugins: [
    // ...existing plugins
    passkeyClient(),
  ],
});
```

**Step 5: Create passkey registration UI**

Add passkey setup in profile/settings screen.

**Step 6: Generate database migration for passkey tables**

Run: `cd apps/server && bun run db:generate`

**Step 7: Typecheck all**

Run: `pnpm typecheck`

**Step 8: Commit**

```
feat: add passkey authentication (Better Auth plugin)
```

---

### Task 13: Security audit

**Step 1: Review rate limiting coverage**

Check all routes have appropriate rate limits. Verify token-bucket parameters.

**Step 2: Review encryption**

Verify AES-256-GCM in `apps/server/src/lib/encryption.ts`:
- Key rotation strategy
- IV uniqueness
- Auth tag verification

**Step 3: Review input validation**

Verify all route handlers validate input with Zod schemas.

**Step 4: Review auth middleware**

Verify `requireAuth()` is applied to all protected routes.

**Step 5: Document findings and fix issues**

**Step 6: Commit**

```
security: audit and fix rate limiting, encryption, validation
```

---

## Validation finale

After all phases complete:

```bash
# Full monorepo validation
pnpm typecheck && pnpm lint && pnpm test

# Server-specific
cd apps/server && bun run db:check && bun test

# Mobile-specific
cd apps/mobile && pnpm typecheck && pnpm test
```

Then merge staging -> main via PR (merge commit, no squash).
