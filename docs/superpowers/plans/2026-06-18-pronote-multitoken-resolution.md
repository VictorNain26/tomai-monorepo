# Pronote Multi-Token & Resolution Implementation Plan (B1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire passer la couche Pronote d'un jeton unique par utilisateur à **un jeton par établissement** (`(user_id, establishment_url)`), et router la résolution de lecture par `credential_id` au lieu de `parent_user_id` — pré-requis de l'onboarding multi-établissement (Plan B2).

**Architecture:** `pronote_credentials` gagne `establishment_url` (dérivé de `metadata.instanceUrl`, donc **contrat des routes mobiles inchangé**). `pronote_child_resources` gagne `credential_id` (quel jeton lit quel enfant). `pronoteDataService` cache et résout par `credential_id`. L'adapter passe la ressource active via `pronote.use(handle, resourceId)`.

**Tech Stack:** Bun 1.3, Elysia 1.4, Drizzle ORM, PostgreSQL 16, pawnote 1.6.2, `bun:test`.

**Dépendances:** indépendant du Plan A (ownership N-N) au niveau code ; les deux convergent dans le Plan B2 (onboarding). **Convention de test** : DDL via `db:push` + vérif ; TDD sur la logique (services/repos) avec `bun:test` + `mock.module` (cf. `src/tests/pronote-data-service.test.ts`).

---

### Task 1: Colonne `establishment_url` sur `pronote_credentials` (nullable)

**Files:**
- Modify: `apps/server/src/db/schema/pronote.schema.ts` (table `pronoteCredentials`, ~ll. 27-51)

- [ ] **Step 1: Ajouter la colonne nullable** (sans toucher encore à la contrainte unique).

```typescript
// dans pronoteCredentials, après encryptedMetadata :
establishmentUrl: varchar('establishment_url', { length: 255 }),
```
> Nullable d'abord (zéro-downtime : les lignes existantes restent valides). La contrainte unique est modifiée en Task 2 après backfill.

- [ ] **Step 2: Appliquer**

Run: `cd apps/server && bun run db:push`
Expected: colonne ajoutée, aucune violation. `bun run db:check` → cohérent.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/db/schema/pronote.schema.ts
git commit -m "feat(db): add nullable establishment_url to pronote_credentials"
```

---

### Task 2: `pronoteSyncService` multi-jeton + backfill + contrainte

**Files:**
- Modify: `apps/server/src/services/pronote-sync.service.ts`
- Modify: `apps/server/src/db/schema/pronote.schema.ts`
- Create: `apps/server/src/db/backfill-establishment-url.ts`
- Test: `apps/server/src/tests/pronote-sync-multitoken.test.ts`

- [ ] **Step 1: Écrire le test** (upsert dérive l'URL du metadata et retourne un `credentialId` ; `getCredentialById` relit par id)

```typescript
import { describe, it, expect, beforeEach, mock } from 'bun:test';

const rows: Array<{ id: string; userId: string; establishmentUrl: string; encryptedToken: string; encryptedMetadata: string }> = [];
mock.module('../db/connection', () => ({
  db: {
    insert: () => ({ values: (v: { userId: string; establishmentUrl: string; encryptedToken: string; encryptedMetadata: string }) => ({
      onConflictDoUpdate: () => ({ returning: async () => {
        const existing = rows.find(r => r.userId === v.userId && r.establishmentUrl === v.establishmentUrl);
        if (existing) { existing.encryptedToken = v.encryptedToken; return [{ id: existing.id }]; }
        const id = `cred-${rows.length + 1}`; rows.push({ id, ...v }); return [{ id }];
      } }),
    }) }),
    select: () => ({ from: () => ({ where: async () => rows.map(r => ({ ...r, tokenExpiresAt: new Date(0) })) }) }),
  },
}));
mock.module('../lib/encryption', () => ({ encrypt: async (s: string) => `enc(${s})`, decrypt: async (s: string) => s.replace(/^enc\(|\)$/g, '') }));

const { pronoteSyncService } = await import('../services/pronote-sync.service');

describe('pronoteSyncService multi-token', () => {
  beforeEach(() => { rows.length = 0; });
  const meta = JSON.stringify({ instanceUrl: 'https://x.index-education.net/pronote/', username: 'P.N', deviceUuid: 'd1', accountKind: 1 });

  it('upsert derives establishment_url from metadata and returns credentialId', async () => {
    const res = await pronoteSyncService.upsertCredentials('u1', { token: 't1', metadata: meta, tokenExpiresAt: new Date().toISOString() });
    expect(res.success).toBe(true);
    expect(res.credentialId).toBe('cred-1');
    expect(rows[0]!.establishmentUrl).toBe('https://x.index-education.net/pronote/');
  });

  it('upsert rejects metadata without instanceUrl', async () => {
    const res = await pronoteSyncService.upsertCredentials('u1', { token: 't1', metadata: '{}', tokenExpiresAt: new Date().toISOString() });
    expect(res.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test (must fail)**

Run: `cd apps/server && bun test src/tests/pronote-sync-multitoken.test.ts`
Expected: FAIL (`upsertCredentials` ne dérive pas l'URL ni ne renvoie `credentialId` ; `getCredentialById` absent).

- [ ] **Step 3: Étendre `UpsertResult`** et **`upsertCredentials`** (`pronote-sync.service.ts`). Modifier l'interface `UpsertResult` (ll. 28-31) :

```typescript
interface UpsertResult { success: boolean; error?: string; credentialId?: string }
```
Et dans `upsertCredentials`, dériver l'URL avant le chiffrement, cibler la contrainte composite, et retourner l'id :

```typescript
let establishmentUrl: string;
try {
  const parsed = JSON.parse(input.metadata) as { instanceUrl?: string };
  if (!parsed.instanceUrl) return { success: false, error: 'metadata.instanceUrl manquant' };
  establishmentUrl = parsed.instanceUrl;
} catch {
  return { success: false, error: 'metadata invalide' };
}

const encryptedToken = await encrypt(input.token);
const encryptedMetadata = await encrypt(input.metadata);

const [row] = await db
  .insert(pronoteCredentials)
  .values({ userId, establishmentUrl, encryptedToken, encryptedMetadata, tokenExpiresAt: new Date(input.tokenExpiresAt) })
  .onConflictDoUpdate({
    target: [pronoteCredentials.userId, pronoteCredentials.establishmentUrl],
    set: { encryptedToken, encryptedMetadata, tokenExpiresAt: new Date(input.tokenExpiresAt), updatedAt: new Date() },
  })
  .returning({ id: pronoteCredentials.id });

return { success: true, credentialId: row?.id };
```

- [ ] **Step 4: Ajouter `getCredentialById` et `updateTokenById`** (`pronote-sync.service.ts`) :

```typescript
async getCredentialById(id: string): Promise<(CredentialOutput & { id: string }) | null> {
  const [row] = await db.select().from(pronoteCredentials).where(eq(pronoteCredentials.id, id));
  if (!row) return null;
  return {
    id: row.id,
    token: await decrypt(row.encryptedToken),
    metadata: await decrypt(row.encryptedMetadata),
    tokenExpiresAt: row.tokenExpiresAt.toISOString(),
  };
}

async updateTokenById(id: string, token: string): Promise<boolean> {
  const encryptedToken = await encrypt(token);
  const res = await db.update(pronoteCredentials)
    .set({ encryptedToken, updatedAt: new Date() })
    .where(eq(pronoteCredentials.id, id))
    .returning({ id: pronoteCredentials.id });
  return res.length > 0;
}
```

- [ ] **Step 5: Run test (must pass)**

Run: `cd apps/server && bun test src/tests/pronote-sync-multitoken.test.ts`
Expected: PASS.

- [ ] **Step 6: Script de backfill** dans `apps/server/src/db/backfill-establishment-url.ts` (remplit `establishment_url` des lignes existantes en déchiffrant le metadata) :

```typescript
import { isNull } from 'drizzle-orm';
import { db } from './connection';
import { pronoteCredentials } from './schema';
import { decrypt } from '../lib/encryption';
import { eq } from 'drizzle-orm';

async function backfill(): Promise<void> {
  const rows = await db.select().from(pronoteCredentials).where(isNull(pronoteCredentials.establishmentUrl));
  let done = 0;
  for (const row of rows) {
    const meta = JSON.parse(await decrypt(row.encryptedMetadata)) as { instanceUrl?: string };
    if (!meta.instanceUrl) { console.warn(`Skip ${row.id}: pas d'instanceUrl`); continue; }
    await db.update(pronoteCredentials).set({ establishmentUrl: meta.instanceUrl }).where(eq(pronoteCredentials.id, row.id));
    done += 1;
  }
  console.log(`Backfill establishment_url: ${done} lignes.`);
}

backfill().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 7: Exécuter le backfill puis verrouiller la contrainte** — modifier `pronoteCredentials` : retirer `.unique()` sur `userId`, rendre `establishmentUrl` `.notNull()`, ajouter la contrainte composite.

```typescript
userId: varchar('user_id', { length: 255 }).notNull(),            // retirer .unique()
establishmentUrl: varchar('establishment_url', { length: 255 }).notNull(),
// dans le callback (table) => ({ ... }) :
userEstablishmentUnique: unique('pronote_credentials_user_establishment_unique').on(table.userId, table.establishmentUrl),
```

Run: `cd apps/server && bun run src/db/backfill-establishment-url.ts && bun run db:push`
Expected: backfill OK puis contrainte appliquée sans violation. (Prod : backfill AVANT `db:generate`/déploiement ; cf. `.claude/rules/database-migrations.md`.)

- [ ] **Step 8: Commit**

```bash
git add apps/server/src/services/pronote-sync.service.ts apps/server/src/db/schema/pronote.schema.ts apps/server/src/db/backfill-establishment-url.ts apps/server/src/tests/pronote-sync-multitoken.test.ts
git commit -m "feat(server): multi-token pronote credentials keyed by (user, establishment)"
```

---

### Task 3: Colonne `credential_id` sur `pronote_child_resources`

**Files:**
- Modify: `apps/server/src/db/schema/pronote.schema.ts` (table `pronoteChildResources`, ~ll. 68-85)

- [ ] **Step 1: Ajouter `credentialId` + ajuster les contraintes** — retirer l'unique sur `childUserId`, ajouter l'unique `(parentUserId, childUserId)`, ajouter la FK `credential_id`.

```typescript
credentialId: uuid('credential_id'),  // nullable d'abord (backfill éventuel), FK ci-dessous
// dans (table) => ({ ... }) :
// retirer : childUnique: unique('pronote_child_resources_child_unique').on(table.childUserId),
parentChildUnique: unique('pronote_child_resources_parent_child_unique').on(table.parentUserId, table.childUserId),
credentialFk: foreignKey({
  columns: [table.credentialId],
  foreignColumns: [pronoteCredentials.id],
  name: 'pronote_child_resources_credential_id_fkey',
}).onDelete('cascade'),
```
> `credentialId` nullable pour ne pas casser d'éventuelles lignes existantes du socle (mappings démo à 1 jeton) ; le nouveau code le renseigne toujours. Cascade : déconnecter un établissement retire ses mappings (le profil enfant subsiste).

- [ ] **Step 2: Appliquer**

Run: `cd apps/server && bun run db:push`
Expected: colonne + contraintes mises à jour, aucune violation.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/db/schema/pronote.schema.ts
git commit -m "feat(db): pronote_child_resources keyed by (parent, child) with credential_id"
```

---

### Task 4: `pronoteChildResourcesRepository` porte le `credential_id`

**Files:**
- Modify: `apps/server/src/db/repositories/pronote-child-resources.repository.ts`
- Test: `apps/server/src/tests/pronote-child-resources-repo.test.ts`

- [ ] **Step 1: Écrire le test** (getMapping renvoie credentialId ; upsert sur la paire parent+enfant)

```typescript
import { describe, it, expect, beforeEach, mock } from 'bun:test';

const rows: Array<{ parentUserId: string; childUserId: string; credentialId: string; resourceId: number }> = [];
mock.module('../connection', () => ({
  db: {
    select: () => ({ from: () => ({ where: async () => rows.filter(r => r.childUserId === '__c__').map(r => ({ parentUserId: r.parentUserId, credentialId: r.credentialId, resourceId: r.resourceId })) }) }),
    insert: () => ({ values: (v: { parentUserId: string; childUserId: string; credentialId: string; resourceId: number }) => ({ onConflictDoUpdate: async () => {
      const ex = rows.find(r => r.parentUserId === v.parentUserId && r.childUserId === v.childUserId);
      if (ex) { ex.credentialId = v.credentialId; ex.resourceId = v.resourceId; } else rows.push(v);
    } }) }),
    delete: () => ({ where: async () => {} }),
  },
}));

const { pronoteChildResourcesRepository } = await import('../db/repositories/pronote-child-resources.repository');

describe('pronoteChildResourcesRepository', () => {
  beforeEach(() => { rows.length = 0; });
  it('upsert is keyed by (parent, child) and stores credentialId', async () => {
    await pronoteChildResourcesRepository.upsertMapping('p1', '__c__', 'cred-1', 2);
    await pronoteChildResourcesRepository.upsertMapping('p1', '__c__', 'cred-1', 5);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.resourceId).toBe(5);
  });
});
```

- [ ] **Step 2: Run test (must fail)**

Run: `cd apps/server && bun test src/tests/pronote-child-resources-repo.test.ts`
Expected: FAIL (signature actuelle `upsertMapping(parent, child, resourceId)`, conflict sur `childUserId`).

- [ ] **Step 3: Réécrire le repository**

```typescript
import { and, eq } from 'drizzle-orm';
import { db } from '../connection';
import { pronoteChildResources } from '../schema';

class PronoteChildResourcesRepository {
  async getMapping(childUserId: string): Promise<{ parentUserId: string; credentialId: string; resourceId: number } | null> {
    const [row] = await db
      .select({
        parentUserId: pronoteChildResources.parentUserId,
        credentialId: pronoteChildResources.credentialId,
        resourceId: pronoteChildResources.resourceId,
      })
      .from(pronoteChildResources)
      .where(eq(pronoteChildResources.childUserId, childUserId));
    if (!row || !row.credentialId) return null;
    return { parentUserId: row.parentUserId, credentialId: row.credentialId, resourceId: row.resourceId };
  }

  async upsertMapping(parentUserId: string, childUserId: string, credentialId: string, resourceId: number): Promise<void> {
    await db
      .insert(pronoteChildResources)
      .values({ parentUserId, childUserId, credentialId, resourceId })
      .onConflictDoUpdate({
        target: [pronoteChildResources.parentUserId, pronoteChildResources.childUserId],
        set: { credentialId, resourceId, updatedAt: new Date() },
      });
  }

  async deleteByChild(childUserId: string): Promise<void> {
    await db.delete(pronoteChildResources).where(eq(pronoteChildResources.childUserId, childUserId));
  }
}

export const pronoteChildResourcesRepository = new PronoteChildResourcesRepository();
```
> `getMapping` renvoie le premier mapping de l'enfant (un seul parent active la lecture ; multi-parent = choix avancé reporté). Routes appelantes (`pronote-data.routes.ts:120`) à adapter en Task 5.

- [ ] **Step 4: Run test (must pass)**

Run: `cd apps/server && bun test src/tests/pronote-child-resources-repo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/db/repositories/pronote-child-resources.repository.ts apps/server/src/tests/pronote-child-resources-repo.test.ts
git commit -m "refactor(db): child-resources mapping carries credential_id, keyed by (parent, child)"
```

---

### Task 5: Résolution `pronoteDataService` par `credential_id`

**Files:**
- Modify: `apps/server/src/services/pronote/pronote-data.service.ts` (résolution ll. 82-131)
- Modify: `apps/server/src/routes/pronote-data.routes.ts:116-121` (PUT resource → inclure `credentialId`)
- Test: `apps/server/src/tests/pronote-data-service.test.ts` (étendre l'existant)

- [ ] **Step 1: Étendre le test existant** — un mapping résolu doit ouvrir la session du `credentialId` (pas du `parentUserId`). Ajouter un cas où `getMapping` renvoie `{ parentUserId, credentialId, resourceId }` et vérifier que `getCredentialById(credentialId)` est appelé.

```typescript
// dans pronote-data-service.test.ts, ajouter aux mocks :
mock.module('../services/pronote-sync.service', () => ({
  pronoteSyncService: {
    getCredentialById: mock(async (id: string) => id === 'cred-x' ? { id, token: 'tok', metadata: JSON.stringify({ instanceUrl: 'https://x/pronote/', username: 'P.N', deviceUuid: 'd', accountKind: 1 }), tokenExpiresAt: new Date(Date.now() + 1e6).toISOString() } : null),
    updateTokenById: mock(async () => true),
  },
}));
// getMapping renvoie credentialId :
//   getMapping: mock(async () => ({ parentUserId: 'p1', credentialId: 'cred-x', resourceId: 0 }))
// puis : expect(getCredentialById).toHaveBeenCalledWith('cred-x');
```

- [ ] **Step 2: Run test (must fail)**

Run: `cd apps/server && bun test src/tests/pronote-data-service.test.ts`
Expected: FAIL (résolution actuelle via `pronoteSyncService.getCredentials(parentUserId)`).

- [ ] **Step 3: Réécrire la résolution** (`pronote-data.service.ts`) — le cache et l'inflight sont **clés par `credentialId`** ; persistance du token tourné par id :

```typescript
private async getOrCreateSession(credentialId: string): Promise<AdapterSession> {
  const cached = this.cache.get(credentialId);
  if (cached) return cached;

  const existing = this.inflight.get(credentialId);
  if (existing) return existing;

  const p = (async () => {
    const cred = await pronoteSyncService.getCredentialById(credentialId);
    if (!cred) throw new PronoteNotConnectedError(credentialId);

    const meta = parseMetadata(cred.metadata);
    const session = await pawnoteServerAdapter.connect({
      url: meta.instanceUrl, kind: meta.accountKind, username: meta.username,
      token: cred.token, deviceUuid: meta.deviceUuid,
    });

    const persisted = await pronoteSyncService.updateTokenById(credentialId, session.token);
    if (!persisted) throw new Error(`Failed to persist rotated Pronote token for credential ${credentialId}`);

    this.cache.set(credentialId, session);
    return session;
  })().finally(() => this.inflight.delete(credentialId));

  this.inflight.set(credentialId, p);
  return p;
}

private async resolveSession(childId: string): Promise<{ session: AdapterSession; resourceId: number }> {
  const mapping = await pronoteChildResourcesRepository.getMapping(childId);
  if (!mapping) throw new PronoteResourceNotMappedError(childId);
  const session = await this.getOrCreateSession(mapping.credentialId);
  return { session, resourceId: mapping.resourceId };
}
```
> `primeSession` reste mais sa clé devient un `credentialId`. Mettre à jour son commentaire `@internal`.

- [ ] **Step 4: Adapter la route PUT resource** (`pronote-data.routes.ts:116-121`) — le mapping requiert désormais un `credentialId`. La signature de la route gagne `credentialId` dans le body :

```typescript
const denied = await assertParentOrSelf(user.id, childId, status as StatusFn);
if (denied) return denied;
await pronoteChildResourcesRepository.upsertMapping(user.id, childId, body.credentialId, body.resourceId);
return { success: true };
}, {
  body: t.Object({ credentialId: t.String({ minLength: 1 }), resourceId: t.Integer({ minimum: 0 }) }),
})
```

- [ ] **Step 5: Run test (must pass)**

Run: `cd apps/server && bun test src/tests/pronote-data-service.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/services/pronote/pronote-data.service.ts apps/server/src/routes/pronote-data.routes.ts apps/server/src/tests/pronote-data-service.test.ts
git commit -m "refactor(server): resolve pronote sessions by credential_id (multi-token)"
```

---

### Task 6: Adapter — sélection de ressource multi-enfant

**Files:**
- Modify: `apps/server/src/services/pronote/pawnote-server.adapter.ts` (reads ll. 143-162 et équivalents homework/timetable)
- Test: `apps/server/src/tests/pawnote-adapter-use.test.ts`

- [ ] **Step 1: Vérifier la signature de `use`** dans les types pawnote AVANT d'implémenter (ne pas deviner sync/async).

Run: `grep -nE 'declare const use' apps/server/node_modules/.pnpm/pawnote@1.6.2/node_modules/pawnote/dist/index.d.ts`
Expected: une ligne du type `declare const use: (session: SessionHandle, resource: number | UserResource) => ...` — noter si le retour est `Promise<...>` (alors `await`) ou synchrone.

- [ ] **Step 2: Écrire le test** (une lecture sur `resourceId=2` sélectionne la ressource d'index 2, ne jette plus)

```typescript
import { describe, it, expect, mock } from 'bun:test';

const useCalls: Array<[unknown, number]> = [];
mock.module('pawnote', () => ({
  use: (handle: unknown, idx: number) => { useCalls.push([handle, idx]); },
  gradesOverview: async () => ({ grades: [] }),
  TabLocation: { Grades: 1 },
  createSessionHandle: () => ({}), loginToken: async () => ({ token: 't', username: 'u' }),
}));

const { pawnoteServerAdapter } = await import('../services/pronote/pawnote-server.adapter');

describe('adapter resource selection', () => {
  it('selects the resource at the given index instead of throwing', async () => {
    const handle = { user: { resources: [{}, {}, {}] }, userResource: { tabs: new Map() } };
    await pawnoteServerAdapter.getGrades({ token: 't', username: 'u', handle } as never, 2);
    expect(useCalls.some(([, idx]) => idx === 2)).toBe(true);
  });
});
```

- [ ] **Step 3: Run test (must fail)**

Run: `cd apps/server && bun test src/tests/pawnote-adapter-use.test.ts`
Expected: FAIL (le code jette `Multi-child resource selection is not yet supported`).

- [ ] **Step 4: Remplacer le garde-fou par `use`** dans `getGrades`, `getHomework`, `getTimetable`. Pour chacune, retirer le bloc `if (resourceId !== 0) throw ...` et insérer, juste après `const { handle } = assertAdapterSession(session);` :

```typescript
use(handle, resourceId); // ou `await use(...)` selon la signature relevée au Step 1
```
> Ajouter `use` à l'import pawnote en tête de fichier. ⚠️ **À valider sur vrai compte** (multi-enfant non éprouvé contre pawnote — cf. test `pronote-real-account.integration.test.ts`).

- [ ] **Step 5: Run test (must pass) + validation complète**

Run: `cd apps/server && bun test src/tests/pawnote-adapter-use.test.ts && bun run typecheck && bun run lint:ci && bun run test && bun run test:integration`
Expected: tout PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/services/pronote/pawnote-server.adapter.ts apps/server/src/tests/pawnote-adapter-use.test.ts
git commit -m "feat(server): adapter selects active pronote resource by index (multi-child)"
```

---

## Self-Review

- **Spec coverage** : couvre §4 (multi-jeton `(user, établissement)`, mapping resource `(parent, jeton, enfant)`, `resource_id` volatile). L'onboarding (géoloc/découverte/activation), la fusion-confirmation et le resync sont **hors de ce plan** → Plan B2.
- **Backward-compat mobile** : le contrat des routes `pronote-sync` est **inchangé** — `upsertCredentials` dérive `establishment_url` du `metadata.instanceUrl` déjà envoyé. `getCredentials(userId)` existant reste (mobile = 1 jeton) ; le serveur lit par `getCredentialById`.
- **Type consistency** : `getCredentialById`/`updateTokenById` (Task 2) consommés par `getOrCreateSession` (Task 5) ; `upsertMapping(parent, child, credentialId, resourceId)` (Task 4) consommé par la route PUT (Task 5).
- **Risque** : `pronote.use` multi-enfant non éprouvé (Task 6) → input de dérisquage = test vrai-compte. `credential_id` nullable transitoire (Task 3) assumé (nouveau code le renseigne toujours).
```
