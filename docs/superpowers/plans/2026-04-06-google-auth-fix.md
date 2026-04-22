# Google Auth Fix - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix "unable to create user" Google OAuth error and harden the auth implementation with account linking, better error handling, and schema cleanup.

**Architecture:** Server-side Better Auth config gets account linking + improved Google provider config. Mobile gets translated error messages. Orphaned passkey table/dep removed. Migration generated for passkey DROP TABLE.

**Tech Stack:** Better Auth 1.5, Drizzle ORM 0.45, Elysia.js 1.4, Expo SDK 55, React Native

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `apps/server/src/lib/auth.ts` | Add accountLinking, improve Google config |
| Modify | `apps/server/src/db/schema/auth.schema.ts` | Remove passkey table + types |
| Modify | `apps/server/package.json` | Remove `@better-auth/passkey` dep |
| Modify | `apps/mobile/src/lib/auth.ts` | Improve error handling in signInWithGoogle |
| Modify | `apps/mobile/src/app/(auth)/login.tsx` | Translate Better Auth error messages |
| Modify | `apps/mobile/src/app/(auth)/register.tsx` | Translate Better Auth error messages |
| Generate | `apps/server/drizzle/0014_*.sql` | DROP TABLE passkey migration |

---

### Task 1: Add account linking to Better Auth config

**Files:**
- Modify: `apps/server/src/lib/auth.ts:170-182`

- [ ] **Step 1: Add accountLinking config**

In `apps/server/src/lib/auth.ts`, add `account` block after `emailAndPassword` (line 173) and enhance Google provider config:

```typescript
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
    },
  },

  socialProviders: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      prompt: "select_account",
      mapProfileToUser: (profile) => ({
        firstName: profile.given_name ?? null,
        lastName: profile.family_name ?? null,
      }),
    },
  } : {},
```

- [ ] **Step 2: Run typecheck**

Run: `cd apps/server && bun run typecheck`
Expected: PASS (no type errors)

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/lib/auth.ts
git commit -m "fix(auth): add account linking + improve Google OAuth config

Enables account linking for Google provider so users who register
with email/password can also sign in with Google (same email).
Adds prompt:select_account and maps firstName/lastName from profile."
```

---

### Task 2: Improve mobile error handling for Google Auth

**Files:**
- Modify: `apps/mobile/src/lib/auth.ts:152-168`
- Modify: `apps/mobile/src/app/(auth)/login.tsx:50-65`
- Modify: `apps/mobile/src/app/(auth)/register.tsx:48-63`

- [ ] **Step 1: Add error translation helper in auth.ts**

In `apps/mobile/src/lib/auth.ts`, add before the `signInWithGoogle` function (around line 150):

```typescript
/**
 * Traduit les codes d'erreur Better Auth en messages utilisateur.
 */
function translateAuthError(errorMessage: string): string {
  const map: Record<string, string> = {
    'Unable to create user': 'Impossible de creer le compte. Verifiez votre connexion ou essayez avec un autre compte Google.',
    'User already exists': 'Un compte existe deja avec cet email. Connectez-vous plutot.',
    'UNABLE_TO_CREATE_USER': 'Impossible de creer le compte. Verifiez votre connexion ou essayez avec un autre compte Google.',
    'USER_ALREADY_EXISTS': 'Un compte existe deja avec cet email. Connectez-vous plutot.',
  };

  for (const [key, value] of Object.entries(map)) {
    if (errorMessage.includes(key)) return value;
  }
  return errorMessage;
}
```

- [ ] **Step 2: Update signInWithGoogle to use translation**

Replace the `signInWithGoogle` function:

```typescript
export async function signInWithGoogle() {
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();

  if (isCancelledResponse(response)) {
    return null;
  }

  if (isSuccessResponse(response) && response.data.idToken) {
    const result = await authClient.signIn.social({
      provider: 'google',
      idToken: { token: response.data.idToken },
    });

    if (result.error) {
      return {
        ...result,
        error: {
          ...result.error,
          message: translateAuthError(result.error.message ?? ''),
        },
      };
    }

    return result;
  }

  throw new Error('Google Sign-In: aucun idToken recu');
}
```

- [ ] **Step 3: Run mobile typecheck**

Run: `cd apps/mobile && pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/lib/auth.ts
git commit -m "fix(mobile): translate Google Auth error messages

Better Auth returns technical error codes like UNABLE_TO_CREATE_USER.
Now translated to user-friendly French messages."
```

---

### Task 3: Remove orphaned passkey table from schema

**Files:**
- Modify: `apps/server/src/db/schema/auth.schema.ts:196-249`
- Modify: `apps/server/package.json`

- [ ] **Step 1: Remove passkey table definition**

In `apps/server/src/db/schema/auth.schema.ts`:
- Delete lines 195-219 (the entire `passkey` pgTable definition and its comment)
- Delete lines 248-249 (`export type Passkey` and `export type NewPasskey`)

- [ ] **Step 2: Remove @better-auth/passkey dependency**

In `apps/server/package.json`, remove the line:
```
"@better-auth/passkey": "^1.5.5",
```

- [ ] **Step 3: Run pnpm install from monorepo root**

Run: `cd /c/Users/ordiv/Tom/tomai-monorepo && pnpm install`

- [ ] **Step 4: Run server typecheck + lint**

Run: `cd apps/server && bun run typecheck && bun run lint`
Expected: PASS (Passkey types are not imported anywhere)

- [ ] **Step 5: Generate Drizzle migration for passkey DROP**

Run: `cd apps/server && bun run db:generate`
Expected: Generates a new migration file `0014_*.sql` containing `DROP TABLE "passkey" CASCADE;`

- [ ] **Step 6: Verify generated migration**

Read the generated SQL file and confirm it ONLY drops the passkey table and related indexes/constraints. Nothing else should be affected.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/db/schema/auth.schema.ts apps/server/package.json apps/server/drizzle/ pnpm-lock.yaml
git commit -m "chore(db): remove orphaned passkey table and dependency

Passkey plugin was removed in a61979e but table definition and
@better-auth/passkey dep remained. No code references passkey types."
```

---

### Task 4: Validate everything together

- [ ] **Step 1: Run full server validation**

Run: `cd apps/server && bun run typecheck && bun run lint`
Expected: PASS

- [ ] **Step 2: Run full mobile validation**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint`
Expected: PASS

- [ ] **Step 3: Run server tests**

Run: `cd apps/server && bun run test`
Expected: PASS

- [ ] **Step 4: Run mobile tests**

Run: `cd apps/mobile && pnpm test`
Expected: PASS

---

## Post-Deploy Verification (staging)

After pushing to staging, verify:

1. **Migration applied:** Check server logs for `0014` migration execution
2. **Google Sign-In new user:** Create a fresh Google account sign-in
3. **Google Sign-In existing email:** Sign in with Google using an email that already has an email/password account (tests account linking)
4. **Error messages:** Intentionally trigger errors to verify French translations appear
5. **Quick Switch:** Verify parent impersonation still works (admin plugin unaffected)
