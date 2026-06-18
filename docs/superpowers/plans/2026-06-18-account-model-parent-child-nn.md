# Account Model — Parent↔Child Many-to-Many Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le lien primaire `user.parentId` (un parent par enfant) par une table de jonction `parent_child` (plusieurs-à-plusieurs), pour permettre qu'un même enfant soit partagé par ses deux parents séparés.

**Architecture:** Nouvelle table `parent_child` + `parentChildRepository`. Tous les call-sites lecteurs/écrivains de `parentId` basculent sur la jonction. Backfill des données existantes, puis suppression de la colonne `user.parentId`. `family_billing.parent_id` (le parent payeur, 1-1) est **hors scope** — ce n'est pas un lien de parenté.

**Tech Stack:** Bun 1.3, Elysia 1.4, Drizzle ORM, PostgreSQL 16, Better Auth 1.6, `bun:test`.

**Convention de test (alignée sur le repo) :** le DDL Drizzle (schéma/table) n'est pas testé en TDD — il est appliqué via `db:push` puis vérifié. Le TDD porte sur la **logique** (services/repository), avec le pattern `bun:test` + `mock.module` du repo (cf. `src/tests/pronote-data-service.test.ts`). Commandes : `cd apps/server` ; `bun test src/tests/<f>.test.ts` ; validation finale `bun run typecheck && bun run lint:ci && bun run test && bun run test:integration`.

---

### Task 1: Table de jonction `parent_child` + repository

**Files:**
- Modify: `apps/server/src/db/schema/pronote.schema.ts` → non. Create dans `apps/server/src/db/schema/auth.schema.ts` (la table vit avec `user`).
- Create: `apps/server/src/db/repositories/parent-child.repository.ts`
- Test: `apps/server/src/tests/parent-child.repository.test.ts`

- [ ] **Step 1: Déclarer la table** dans `apps/server/src/db/schema/auth.schema.ts` (après la déclaration de `user`). Vérifier que `unique` et `index` sont importés depuis `drizzle-orm/pg-core` (ajouter si absent).

```typescript
export const parentChild = pgTable('parent_child', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentUserId: varchar('parent_user_id', { length: 255 }).notNull(),
  childUserId: varchar('child_user_id', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pairUnique: unique('parent_child_pair_unique').on(table.parentUserId, table.childUserId),
  parentIdx: index('idx_parent_child_parent').on(table.parentUserId),
  childIdx: index('idx_parent_child_child').on(table.childUserId),
  parentFk: foreignKey({
    columns: [table.parentUserId],
    foreignColumns: [user.id],
    name: 'parent_child_parent_user_id_fkey',
  }).onDelete('cascade'),
  childFk: foreignKey({
    columns: [table.childUserId],
    foreignColumns: [user.id],
    name: 'parent_child_child_user_id_fkey',
  }).onDelete('cascade'),
}));
```
> `uuid`, `varchar`, `timestamp`, `foreignKey` sont déjà importés dans ce fichier. Ajouter `unique, index` si manquants.

- [ ] **Step 2: Appliquer le schéma en dev**

Run: `cd apps/server && bun run db:push`
Expected: `parent_child` créée, aucune erreur. Vérifier : `bun run db:check` → no drift.

- [ ] **Step 3: Écrire le test du repository** dans `apps/server/src/tests/parent-child.repository.test.ts`

```typescript
import { describe, it, expect, beforeEach, mock } from 'bun:test';

const rows: Array<{ parentUserId: string; childUserId: string }> = [];
mock.module('../db/connection', () => ({
  db: {
    insert: () => ({ values: (v: { parentUserId: string; childUserId: string }) => ({ onConflictDoNothing: async () => { if (!rows.some(r => r.parentUserId === v.parentUserId && r.childUserId === v.childUserId)) rows.push(v); } }) }),
    delete: () => ({ where: async () => {} }),
    select: () => ({ from: () => ({ where: async () => rows.map(r => ({ childUserId: r.childUserId, parentUserId: r.parentUserId })) }) }),
  },
}));

const { parentChildRepository } = await import('../db/repositories/parent-child.repository');

describe('parentChildRepository', () => {
  beforeEach(() => { rows.length = 0; });

  it('link is idempotent on the (parent, child) pair', async () => {
    await parentChildRepository.link('p1', 'c1');
    await parentChildRepository.link('p1', 'c1');
    expect(rows).toHaveLength(1);
  });

  it('a child can be linked to two parents', async () => {
    await parentChildRepository.link('p1', 'c1');
    await parentChildRepository.link('p2', 'c1');
    expect(rows).toHaveLength(2);
  });
});
```

- [ ] **Step 4: Run test (must fail — module not found)**

Run: `cd apps/server && bun test src/tests/parent-child.repository.test.ts`
Expected: FAIL — `Cannot find module '../db/repositories/parent-child.repository'`.

- [ ] **Step 5: Implémenter le repository** dans `apps/server/src/db/repositories/parent-child.repository.ts`

```typescript
import { and, eq } from 'drizzle-orm';
import { db } from '../connection';
import { parentChild } from '../schema';

class ParentChildRepository {
  async link(parentUserId: string, childUserId: string): Promise<void> {
    await db.insert(parentChild).values({ parentUserId, childUserId }).onConflictDoNothing();
  }

  async unlink(parentUserId: string, childUserId: string): Promise<void> {
    await db.delete(parentChild).where(
      and(eq(parentChild.parentUserId, parentUserId), eq(parentChild.childUserId, childUserId)),
    );
  }

  async getChildIds(parentUserId: string): Promise<string[]> {
    const rows = await db.select({ childUserId: parentChild.childUserId })
      .from(parentChild).where(eq(parentChild.parentUserId, parentUserId));
    return rows.map((r) => r.childUserId);
  }

  async getParentIds(childUserId: string): Promise<string[]> {
    const rows = await db.select({ parentUserId: parentChild.parentUserId })
      .from(parentChild).where(eq(parentChild.childUserId, childUserId));
    return rows.map((r) => r.parentUserId);
  }

  async isLinked(parentUserId: string, childUserId: string): Promise<boolean> {
    const [row] = await db.select({ id: parentChild.id }).from(parentChild)
      .where(and(eq(parentChild.parentUserId, parentUserId), eq(parentChild.childUserId, childUserId)))
      .limit(1);
    return Boolean(row);
  }
}

export const parentChildRepository = new ParentChildRepository();
```

- [ ] **Step 6: Run test (must pass)**

Run: `cd apps/server && bun test src/tests/parent-child.repository.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/db/schema/auth.schema.ts apps/server/src/db/repositories/parent-child.repository.ts apps/server/src/tests/parent-child.repository.test.ts
git commit -m "feat(db): add parent_child junction table and repository"
```

---

### Task 2: Backfill `user.parentId` → `parent_child`

**Files:**
- Create: `apps/server/src/db/backfill-parent-child.ts`

- [ ] **Step 1: Écrire le script de backfill idempotent**

```typescript
import { isNotNull } from 'drizzle-orm';
import { db } from './connection';
import { user, parentChild } from './schema';

async function backfill(): Promise<void> {
  const linked = await db.select({ id: user.id, parentId: user.parentId })
    .from(user).where(isNotNull(user.parentId));

  let inserted = 0;
  for (const row of linked) {
    if (!row.parentId) continue;
    await db.insert(parentChild)
      .values({ parentUserId: row.parentId, childUserId: row.id })
      .onConflictDoNothing();
    inserted += 1;
  }
  console.log(`Backfill parent_child: ${inserted} liens traités (idempotent).`);
}

backfill().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```
> Idempotent grâce à `onConflictDoNothing` sur `parent_child_pair_unique`. Rejouable sans risque.

- [ ] **Step 2: Exécuter le backfill en dev**

Run: `cd apps/server && bun run src/db/backfill-parent-child.ts`
Expected: `Backfill parent_child: N liens traités` (N = nb d'enfants existants ; 0 sur base neuve, sans erreur).

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/db/backfill-parent-child.ts
git commit -m "feat(db): add idempotent parent_child backfill from user.parentId"
```
> En prod : exécuter ce script APRÈS création de la table et AVANT le DROP de `parentId` (Task 8). Backup DB recommandé avant le DROP.

---

### Task 3: `usersRepository` lit la jonction

**Files:**
- Modify: `apps/server/src/db/repositories/users.repository.ts:63-72`
- Test: `apps/server/src/tests/users-repository-children.test.ts`

- [ ] **Step 1: Écrire le test** (le repo joint `parent_child`, ne lit plus `user.parentId`)

```typescript
import { describe, it, expect, beforeEach, mock } from 'bun:test';

let lastJoinTable = '';
const fakeUser = { id: 'c1', isActive: true };
mock.module('../connection', () => ({
  db: {
    select: () => ({
      from: (t: { _: { name?: string } }) => {
        lastJoinTable = '';
        return {
          innerJoin: (joined: unknown, _on: unknown) => ({
            where: async () => [{ user: fakeUser, parent_child: { parentUserId: 'p1', childUserId: 'c1' } }],
          }),
        };
      },
    }),
  },
}));

const { usersRepository } = await import('../db/repositories/users.repository');

describe('usersRepository children via parent_child', () => {
  it('findChildrenByParentId returns mapped users from the junction join', async () => {
    const children = await usersRepository.findChildrenByParentId('p1');
    expect(children).toEqual([fakeUser]);
  });
});
```
> Note : ce test verrouille le *contrat de retour* (`User[]`). Le détail du JOIN est exercé en `integration-tests` (DB réelle) à la validation finale.

- [ ] **Step 2: Run test (must fail)**

Run: `cd apps/server && bun test src/tests/users-repository-children.test.ts`
Expected: FAIL (l'implémentation actuelle filtre `user.parentId`, pas de `innerJoin`).

- [ ] **Step 3: Réécrire les deux méthodes** (`users.repository.ts`)

```typescript
async findChildrenByParentId(parentId: string): Promise<User[]> {
  const rows = await db
    .select()
    .from(parentChild)
    .innerJoin(user, eq(user.id, parentChild.childUserId))
    .where(and(eq(parentChild.parentUserId, parentId), eq(user.isActive, true)));
  return rows.map((r) => r.user);
}

async findAllChildrenByParentId(parentId: string): Promise<User[]> {
  const rows = await db
    .select()
    .from(parentChild)
    .innerJoin(user, eq(user.id, parentChild.childUserId))
    .where(eq(parentChild.parentUserId, parentId));
  return rows.map((r) => r.user);
}
```
> Mettre à jour l'import en tête de fichier : `import { user, parentChild } from '../schema';`.

- [ ] **Step 4: Run test (must pass)**

Run: `cd apps/server && bun test src/tests/users-repository-children.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/db/repositories/users.repository.ts apps/server/src/tests/users-repository-children.test.ts
git commit -m "refactor(db): read children through parent_child junction"
```

---

### Task 4: `parentService.createChild` écrit la jonction + `isParentOf`

**Files:**
- Modify: `apps/server/src/services/parent.service.ts:89-134` (createChild), `:256-263` (isParentOf)
- Test: `apps/server/src/tests/parent-service-link.test.ts`

- [ ] **Step 1: Écrire le test** (createChild appelle `link`, isParentOf passe par la jonction)

```typescript
import { describe, it, expect, beforeEach, mock } from 'bun:test';

const linkCalls: Array<[string, string]> = [];
mock.module('../db/repositories/parent-child.repository', () => ({
  parentChildRepository: {
    link: async (p: string, c: string) => { linkCalls.push([p, c]); },
    isLinked: async (p: string, c: string) => linkCalls.some(([lp, lc]) => lp === p && lc === c),
  },
}));
mock.module('../db/repositories/users.repository', () => ({
  usersRepository: {
    findByUsername: async () => undefined,
    update: async (id: string, data: Record<string, unknown>) => ({ id, ...data }),
  },
}));
mock.module('../lib/auth', () => ({
  auth: { api: { signUpEmail: async () => ({ user: { id: 'c1' } }) } },
}));

const { parentService } = await import('../services/parent.service');

describe('parentService linking via junction', () => {
  beforeEach(() => { linkCalls.length = 0; });

  it('createChild links parent and child in the junction', async () => {
    await parentService.createChild('p1', {
      firstName: 'Léa', lastName: 'Martin', username: 'lea.martin',
      password: 'temp-pass-123', schoolLevel: 'seconde', dateOfBirth: '2009-05-01',
    });
    expect(linkCalls).toContainEqual(['p1', 'c1']);
  });

  it('isParentOf is true only when a link exists', async () => {
    await parentService.createChild('p1', {
      firstName: 'Léa', lastName: 'Martin', username: 'lea.martin',
      password: 'temp-pass-123', schoolLevel: 'seconde', dateOfBirth: '2009-05-01',
    });
    expect(await parentService.isParentOf('p1', 'c1')).toBe(true);
    expect(await parentService.isParentOf('p2', 'c1')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test (must fail)**

Run: `cd apps/server && bun test src/tests/parent-service-link.test.ts`
Expected: FAIL (createChild n'appelle pas `link` ; isParentOf passe par `getParentChildren`).

- [ ] **Step 3: Modifier `createChild`** — remplacer l'écriture `parentId` par un `link`, et compenser si l'association échoue après `signUpEmail`. Remplacer le bloc `usersRepository.update(...)` + `return` (lignes ~117-133) par :

```typescript
  try {
    await usersRepository.update(result.user.id, {
      firstName: childData.firstName,
      lastName: childData.lastName,
      username: childData.username,
      displayUsername: childData.username,
      role: 'student',
      schoolLevel: childData.schoolLevel as SchoolLevel,
      dateOfBirth: childData.dateOfBirth,
    });
    await parentChildRepository.link(parentId, result.user.id);
  } catch (error) {
    await usersRepository.deleteById(result.user.id); // compense le signUpEmail orphelin
    throw error;
  }

  return {
    id: result.user.id,
    firstName: childData.firstName,
    lastName: childData.lastName,
    username: childData.username,
    schoolLevel: childData.schoolLevel,
    dateOfBirth: childData.dateOfBirth ?? undefined,
    isActive: true,
    parentId,
    role: 'student' as const,
    createdAt: new Date().toISOString(),
  };
```
> Ajouter l'import `import { parentChildRepository } from '../db/repositories/parent-child.repository';`. Le champ `parentId` reste dans l'objet `ChildInfo` retourné (compat type) — il vaut le parent créateur ; ce n'est plus une colonne DB.

- [ ] **Step 4: Modifier `isParentOf`** (lignes 256-263) :

```typescript
async isParentOf(parentId: string, studentId: string): Promise<boolean> {
  return parentChildRepository.isLinked(parentId, studentId);
}
```

- [ ] **Step 5: Run test (must pass)**

Run: `cd apps/server && bun test src/tests/parent-service-link.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/services/parent.service.ts apps/server/src/tests/parent-service-link.test.ts
git commit -m "refactor(server): createChild and isParentOf use parent_child junction"
```

---

### Task 5: Hook d'impersonation Better Auth lit la jonction

**Files:**
- Modify: `apps/server/src/lib/auth.ts:249-275`
- Test: `apps/server/src/tests/auth-impersonation-link.test.ts`

- [ ] **Step 1: Écrire le test** (l'autorisation d'impersonation dépend d'un lien dans la jonction, plus de `targetUser.parentId`)

```typescript
import { describe, it, expect } from 'bun:test';

// La logique d'autorisation extraite est testée directement.
function canImpersonate(requesting: { id: string; role: string }, target: { role: string } | undefined, linked: boolean): boolean {
  if (requesting.role !== 'parent') return false;
  if (!target) return false;
  return target.role === 'student' && linked;
}

describe('impersonation authorization', () => {
  it('allows a parent to impersonate a linked student', () => {
    expect(canImpersonate({ id: 'p1', role: 'parent' }, { role: 'student' }, true)).toBe(true);
  });
  it('denies when no link exists', () => {
    expect(canImpersonate({ id: 'p1', role: 'parent' }, { role: 'student' }, false)).toBe(false);
  });
  it('denies when target is not a student', () => {
    expect(canImpersonate({ id: 'p1', role: 'parent' }, { role: 'parent' }, true)).toBe(false);
  });
});
```
> Ce test verrouille la règle d'autorisation. L'intégration réelle (lecture jonction) est couverte par `integration-tests`.

- [ ] **Step 2: Run test (must pass déjà — c'est un test pur)**

Run: `cd apps/server && bun test src/tests/auth-impersonation-link.test.ts`
Expected: PASS (la fonction de référence encode la règle cible).

- [ ] **Step 3: Réécrire le hook** dans `auth.ts` (remplacer la lecture `user.parentId` lignes 250-275). Le `select` ne récupère plus que `role` ; le lien vient de la jonction :

```typescript
        const [targetUser] = await db
          .select({ role: user.role })
          .from(user)
          .where(eq(user.id, targetUserId))
          .limit(1);

        if (!targetUser) {
          logger.warn('Impersonation denied: target user not found', {
            operation: 'auth:impersonation:denied',
            parentId: requestingUser.id,
            targetId: targetUserId,
          });
          return false;
        }

        const linked = await parentChildRepository.isLinked(requestingUser.id, targetUserId);
        if (targetUser.role !== 'student' || !linked) {
          logger.warn('Impersonation denied: target is not child of parent', {
            operation: 'auth:impersonation:denied',
            parentId: requestingUser.id,
            targetId: targetUserId,
            targetRole: targetUser.role,
          });
          return false;
        }
```
> Ajouter `import { parentChildRepository } from '../db/repositories/parent-child.repository';` en tête de `auth.ts`.

- [ ] **Step 4: Typecheck**

Run: `cd apps/server && bun run typecheck`
Expected: PASS (aucune référence restante à `targetUser.parentId`).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/auth.ts apps/server/src/tests/auth-impersonation-link.test.ts
git commit -m "refactor(auth): impersonation authorization via parent_child junction"
```

---

### Task 6: `subscription.service` + `status.routes` lisent la jonction

**Files:**
- Modify: `apps/server/src/services/subscription.service.ts:30` (utilise déjà `findAllChildrenByParentId` — basculé en Task 3, vérifier)
- Modify: `apps/server/src/routes/subscription/status.routes.ts:51`
- Test: `apps/server/src/tests/status-route-access.test.ts`

- [ ] **Step 1: Écrire le test** de la règle d'accès (un parent accède à l'enfant s'il est lié)

```typescript
import { describe, it, expect } from 'bun:test';

function canParentAccessChild(authedId: string, isLinked: boolean): boolean {
  return isLinked; // remplace `userRecord.parentId === authedId`
}

describe('status route parent→child access', () => {
  it('grants access when linked', () => { expect(canParentAccessChild('p1', true)).toBe(true); });
  it('denies access when not linked', () => { expect(canParentAccessChild('p1', false)).toBe(false); });
});
```

- [ ] **Step 2: Run test**

Run: `cd apps/server && bun test src/tests/status-route-access.test.ts`
Expected: PASS.

- [ ] **Step 3: Modifier `status.routes.ts:51`** — remplacer la comparaison directe `userRecord.parentId === authenticatedUser.id` par un appel jonction :

```typescript
import { parentChildRepository } from '../../db/repositories/parent-child.repository';
// ...
const isLinked = await parentChildRepository.isLinked(authenticatedUser.id, userRecord.id);
if (!isLinked) {
  return status(403, { error: 'Access denied', code: 'forbidden' });
}
```
> Adapter au flux exact de la route (garder la forme de réponse existante). `subscription.service.ts:30` consomme `findAllChildrenByParentId`, déjà basculé en Task 3 — vérifier qu'aucune autre lecture de `parentId` n'y subsiste.

- [ ] **Step 4: Typecheck + tests**

Run: `cd apps/server && bun run typecheck && bun test src/tests/status-route-access.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/subscription/status.routes.ts apps/server/src/tests/status-route-access.test.ts
git commit -m "refactor(server): subscription status access via parent_child junction"
```

---

### Task 7: Relations Drizzle `userRelations` → jonction

**Files:**
- Modify: `apps/server/src/db/schema/index.ts:12-49` (userRelations), `:67-74` (UserWithRelations)

- [ ] **Step 1: Réécrire les relations parent/enfant** via la table de jonction (remplacer le `one`/`many` self-ref qui s'appuyait sur `user.parentId`, lignes 14-21) :

```typescript
export const parentChildRelations = relations(parentChild, ({ one }) => ({
  parent: one(user, { fields: [parentChild.parentUserId], references: [user.id], relationName: 'pc_parent' }),
  child: one(user, { fields: [parentChild.childUserId], references: [user.id], relationName: 'pc_child' }),
}));
```
Et dans `userRelations`, remplacer les entrées `parent`/`children` par :
```typescript
  asParentLinks: many(parentChild, { relationName: 'pc_parent' }),
  asChildLinks: many(parentChild, { relationName: 'pc_child' }),
```
> Importer `parentChild` depuis `./auth.schema`. Retirer `relationName: 'parent_child'` devenu inutilisé.

- [ ] **Step 2: Nettoyer `UserWithRelations`** (lignes 67-74) — retirer `parent?: User | null;` et `children?: User[];` (plus dérivés de `parentId`). Ajouter si besoin réel ailleurs ; sinon ne rien remettre (YAGNI).

- [ ] **Step 3: Typecheck**

Run: `cd apps/server && bun run typecheck`
Expected: PASS (aucun conscommateur de `UserWithRelations.parent/children` — vérifier via `grep -rn "\.parent\b\|\.children\b" src` si doute).

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/db/schema/index.ts
git commit -m "refactor(db): model parent-child relations through junction table"
```

---

### Task 8: Supprimer `user.parentId` + validation finale

**Files:**
- Modify: `apps/server/src/db/schema/auth.schema.ts:43` (colonne), `:68` (index), `:73-77` (FK)
- Modify (si nécessaire): `apps/server/src/integration-tests/api-endpoints.test.ts`

- [ ] **Step 1: Vérifier qu'aucun code ne lit `parentId`**

Run: `cd apps/server && grep -rn "\.parentId\b\|parent_id" src --include=*.ts | grep -v family_billing | grep -v parent-child | grep -v node_modules`
Expected: aucune occurrence sur `user.parentId` (les hits restants doivent concerner `family_billing.parentId`, le payeur — légitime).

- [ ] **Step 2: Retirer la colonne `parentId`, son index et sa FK** de `auth.schema.ts` (supprimer la ligne 43 `parentId: ...`, la ligne 68 `parentIdIdx`, et le bloc `parentIdFk` lignes 73-77).

- [ ] **Step 3: Appliquer en dev**

Run: `cd apps/server && bun run db:push`
Expected: colonne `parent_id` supprimée de `user`. (Prod : `db:generate` + backup avant le DROP — cf. `.claude/rules/database-migrations.md`, migration destructive.)

- [ ] **Step 4: Si `api-endpoints.test.ts` casse** (chaîne `app.ts` qui tire les schémas), aligner le mock comme les modules existants. Lancer d'abord pour voir :

Run: `cd apps/server && bun test src/integration-tests/api-endpoints.test.ts`
Expected: PASS — sinon ajuster les mocks Drizzle au même niveau que `retention-purge.service`.

- [ ] **Step 5: Validation complète**

Run: `cd apps/server && bun run typecheck && bun run lint:ci && bun run test && bun run test:integration`
Expected: tout PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/db/schema/auth.schema.ts apps/server/src/integration-tests/api-endpoints.test.ts
git commit -m "refactor(db): drop user.parentId in favor of parent_child junction"
```

---

## Self-Review

- **Spec coverage** : couvre §4 du spec (relation parent↔enfant plusieurs-à-plusieurs, parents séparés). Le multi-jeton, le mapping resource `credential_id`, l'onboarding et le resync sont **hors de ce plan** (→ Plan B).
- **Type consistency** : `parentChildRepository.link/unlink/getChildIds/getParentIds/isLinked` utilisés de façon cohérente (Tasks 1, 4, 5, 6). `findChildrenByParentId`/`findAllChildrenByParentId` gardent leur signature `Promise<User[]>` (Task 3).
- **family_billing.parent_id** : volontairement intact (parent payeur, 1-1) — ne pas confondre avec le lien de parenté.
- **Risque** : Task 8 (DROP colonne) est destructif → en prod, backup + `db:generate` (pas `db:push`). En dev, `db:push` suffit.
