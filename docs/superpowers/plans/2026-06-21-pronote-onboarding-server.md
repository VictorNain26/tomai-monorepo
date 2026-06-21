# Plan — Onboarding Pronote serveur (QR-first complet)

**Spec** : `docs/superpowers/specs/2026-06-21-pronote-onboarding-server-design.md`
**Branche** : `feat/pronote-onboarding-server`
**Périmètre** : `apps/server` (schéma A0 + read-model A2/A3 + conflit activate) puis `apps/mobile` (migration read-model partie C + wizard onboarding + gestion).

L'ingénieur connaît TS/Elysia/Drizzle/Eden + React Native/Expo/NativeWind, **pas** ce codebase. Chaque tâche est indépendamment testable et **verte au commit**.

---

## Global Constraints (verbatim — à respecter sur CHAQUE tâche)

- **Pré-prod, zéro donnée** : le schéma évolue via `db:push` en dev **+** une migration `db:generate` (DDL pur, **pas de backfill**, pas de données à migrer).
- **VERT À CHAQUE COMMIT** : lefthook pre-commit lance `typecheck` ; mobile `typedRoutes:true`. Ordonner les étapes pour qu'aucun commit n'ait une route ou un symbole dangling. Migration du read-model : **basculer chaque gate sur le signal serveur AVANT de supprimer les symboles locaux**, dans la même tâche.
- **Gate serveur** : `cd apps/server && bun run typecheck && bun run lint && bun run test` ; pre-push ajoute `bun run test:integration`. **Piège mock** : `src/tests/api-endpoints.test.ts` mocke partiellement `drizzle-orm` — tout nouveau module qui tire les schémas Drizzle via `app.ts` doit être mocké là (pattern : voir le mock de `retention-purge.service`).
- **Gate mobile** : `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`. Zéro `any` ; NativeWind uniquement ; primitives `@/components/ui/` ; a11y (`accessibilityRole`/`accessibilityLabel`) ; tokens `@repo/tokens` ; ≤ 400 lignes / fichier.
- **Serveur** : validation TypeBox `t` sur les routes, logique dans les services, accès DB via repositories Drizzle. Commits conventionnels, staging explicite (jamais `git add .`), scopes `pronote`/`server`/`mobile`/`db`.

---

### Task 1 : Schéma A0 — colonnes d'affichage + unicité `(credential_id, resource_id)`

**Files**
- `apps/server/src/db/schema/pronote.schema.ts` (modifier)
- `apps/server/drizzle/*` (généré par `db:generate`)
- `apps/server/src/tests/pronote-schema.test.ts` (nouveau — TDD)

**Interfaces**
- Consomme : tables `pronoteCredentials`, `pronoteChildResources` existantes.
- Produit : colonnes `pronote_credentials.establishment_name` (varchar 255, nullable), `pronote_child_resources.class_name` (varchar 255, nullable), `pronote_child_resources.establishment_name` (varchar 255, nullable) ; contrainte `unique(credential_id, resource_id)`.

**Steps**
1. **RED** — créer `src/tests/pronote-schema.test.ts`. Insérer un `pronoteCredentials` + deux `pronoteChildResources` partageant `(credentialId, resourceId)` mais des `childUserId` différents, attendre un rejet d'unicité Postgres :
   ```ts
   import { describe, it, expect, beforeAll } from 'bun:test';
   import { db } from '../db/connection';
   import { pronoteCredentials, pronoteChildResources } from '../db/schema';
   // crée user parent + 2 enfants via les helpers de test existants (cf. autres *.test.ts du dossier)
   it('rejects a duplicate (credential_id, resource_id)', async () => {
     await db.insert(pronoteChildResources).values({ parentUserId, childUserId: childA, credentialId, resourceId: 42 });
     const dup = db.insert(pronoteChildResources).values({ parentUserId, childUserId: childB, credentialId, resourceId: 42 });
     await expect(dup).rejects.toThrow();
   });
   ```
   Lancer `cd apps/server && bun run test pronote-schema` → échoue (colonne/contrainte absentes).
2. **GREEN** — dans `pronote.schema.ts`, ajouter à `pronoteCredentials` (après `establishmentUrl`, L34) : `establishmentName: varchar('establishment_name', { length: 255 }),`. Ajouter à `pronoteChildResources` (après `resourceId`, L84) : `className: varchar('class_name', { length: 255 }),` et `establishmentName: varchar('establishment_name', { length: 255 }),`. Dans le builder de contraintes de `pronoteChildResources` (L88-98), ajouter à côté de `parentChildUnique` :
   ```ts
   credentialResourceUnique: unique('pronote_child_resources_credential_resource_unique').on(
     table.credentialId,
     table.resourceId,
   ),
   ```
3. Appliquer en dev : `cd apps/server && bun run db:push` (Postgres doit tourner : `docker compose up -d postgres` depuis la racine).
4. Générer la migration DDL : `cd apps/server && bun run db:generate`. Vérifier que le SQL produit est **purement** `ALTER TABLE … ADD COLUMN` + `ADD CONSTRAINT UNIQUE`, sans `UPDATE`/backfill. Ne PAS éditer le `.sql` ni `_journal.json` à la main.
5. **GATE** : `cd apps/server && bun run typecheck && bun run lint && bun run test`. Le test de l'étape 1 doit passer (vert).
6. Stager + commit : `git add apps/server/src/db/schema/pronote.schema.ts apps/server/drizzle apps/server/src/tests/pronote-schema.test.ts` puis `git commit -m "feat(db): persist Pronote display metadata + (credential,resource) uniqueness"`.

---

### Task 2 : Écrire `establishment_name` au `connectQr`, `class_name`+`establishment_name` à l'`activate`

**Files**
- `apps/server/src/services/pronote-sync.service.ts` (étendre `UpsertInput` + écriture)
- `apps/server/src/services/pronote/pronote-connect.service.ts` (threader les métadonnées)
- `apps/server/src/db/repositories/pronote-child-resources.repository.ts` (`upsertMapping` reçoit className/establishmentName)
- `apps/server/src/tests/pronote-connect.service.test.ts` (étendre — TDD)

**Interfaces**
- `upsertCredentials(userId, input)` : `input` gagne `establishmentName?: string | null`.
- `upsertMapping(parentUserId, childUserId, credentialId, resourceId, className: string | null, establishmentName: string | null)`.

**Steps**
1. **RED** — dans le test du service connect (ou nouveau bloc), après un `connectQr` mocké (l'adapter renvoie `resources` avec `establishmentName`), asserter que la ligne `pronoteCredentials` persistée porte `establishmentName === resources[0].establishmentName`. Après un `activate` réussi, asserter que la ligne `pronoteChildResources` porte `className`/`establishmentName` issus du `DiscoveredResource` sélectionné. Lancer → échoue (colonnes non écrites).
2. **GREEN — sync service** : dans `pronote-sync.service.ts`, étendre `interface UpsertInput` (L29) avec `establishmentName?: string | null;`. Dans `upsertCredentials`, propager dans le `.values({...})` (L87-93) et le `set` du `onConflictDoUpdate` (L96-101) : `establishmentName: input.establishmentName ?? null`.
3. **GREEN — connect service** : dans `connectQr` (`pronote-connect.service.ts` L86-95), passer `establishmentName: resources[0]?.establishmentName ?? null` dans l'objet d'`upsertCredentials`.
4. **GREEN — activate** : l'`activate` (L195-247) dispose du `selection.resourceId` mais **pas** du `DiscoveredResource` (className/establishmentName). Avant la boucle, charger la liste enrichie une fois : `const discovered = await this.discover(parentUserId, credentialId);` puis `const byId = new Map(discovered.map((d) => [d.resourceId, d]));`. Dans la boucle, après avoir résolu `childId`, récupérer `const res = byId.get(selection.resourceId);` et passer à `upsertMapping(parentUserId, childId, credentialId, selection.resourceId, res?.className ?? null, res?.establishmentName ?? null)`.
5. **GREEN — repo** : dans `pronote-child-resources.repository.ts`, étendre la signature `upsertMapping` avec `className: string | null, establishmentName: string | null` ; ajouter ces deux champs au `.values({...})` et au `set` du `onConflictDoUpdate`.
6. **GATE** serveur (typecheck + lint + test). Vérifier le piège mock : `discover` est déjà importé via la chaîne `app.ts` ; si un nouveau module Drizzle apparaît dans `api-endpoints.test.ts`, le mocker comme `retention-purge.service`.
7. Stager + commit : scope `feat(pronote): write establishment/class metadata at connect and activate`.

---

### Task 3 : Conflit `activate` — `linkToChildId` déjà mappé → `failed[{reason:'already_mapped'}]`

**Files**
- `apps/server/src/services/pronote/pronote-connect.service.ts` (branche `linkToChildId`)
- `apps/server/src/db/repositories/pronote-child-resources.repository.ts` (lecture du mapping existant par childUserId — `getMapping` existe déjà)
- `apps/server/src/tests/pronote-connect.service.test.ts` (étendre — TDD)

**Interfaces**
- Consomme : `pronoteChildResourcesRepository.getMapping(childUserId)` (existant, renvoie le mapping ou null).
- Produit : un item `failed` `{ resourceId, reason: 'already_mapped' }`, **sans** écrasement du mapping existant.

**Steps**
1. **RED** — test : créer un enfant déjà mappé (insert direct `pronoteChildResources`), puis `activate` avec `linkToChildId = cet enfant`. Asserter `result.failed` contient `{ resourceId, reason: 'already_mapped' }`, `result.activated` est vide, et la ligne `pronoteChildResources` d'origine est **intacte** (même `resourceId`/`credentialId`). Lancer → échoue (l'`upsertMapping` écrase aujourd'hui).
2. **GREEN** — dans `activate`, branche `if (selection.linkToChildId)` (L200-204), après la garde `isParentOf` :
   ```ts
   const existing = await pronoteChildResourcesRepository.getMapping(selection.linkToChildId);
   if (existing) {
     failed.push({ resourceId: selection.resourceId, reason: 'already_mapped' });
     continue;
   }
   ```
   La garde `isParentOf(parent, linkToChildId)` → `PronoteChildNotOwnedError` (anti-IDOR) est **conservée** intacte.
3. **GATE** serveur.
4. Stager + commit : `feat(pronote): reject activate link to an already-mapped child (already_mapped)`.

---

### Task 4 : Read-model A2.1 — `GET /api/pronote/children/:childId/status`

**Files**
- `apps/server/src/db/repositories/pronote-child-resources.repository.ts` (nouvelle lecture `getStatusByChild`)
- `apps/server/src/services/pronote/pronote-connect.service.ts` (ou nouveau `pronote-readmodel.service.ts`) — méthode `getChildStatus`
- `apps/server/src/routes/pronote-data.routes.ts` (nouvelle route + `assertParentOrSelf` réutilisé)
- `apps/server/src/tests/pronote-data.routes.test.ts` (étendre — TDD authz)

**Interfaces**
- Produit (exporté/nommable pour Eden — cf. `apps/server/CLAUDE.md`) :
  ```ts
  export interface PronoteChildStatus { hasPronote: boolean; establishmentName: string | null; className: string | null; }
  ```
- Route : `GET /api/pronote/children/:childId/status` → `{ success: true, data: PronoteChildStatus }`.

**Steps**
1. **RED** — dans `pronote-data.routes.test.ts`, trois cas : (a) enfant mappé via parent → `{hasPronote:true, establishmentName, className}` ; (b) enfant non mappé → `{false,null,null}` ; (c) **self** (l'élève appelle pour lui-même) autorisé ; (d) tiers (autre parent) → 403. Lancer → échoue (route absente).
2. **GREEN — repo** : ajouter `getStatusByChild(childUserId: string): Promise<PronoteChildStatus>`. Une requête : jointure `pronoteChildResources` (sur `childUserId`) → la ligne porte déjà `className`/`establishmentName` (Task 1). `hasPronote = rows.length > 0`. Renvoyer `{hasPronote:false,establishmentName:null,className:null}` si pas de ligne. Exporter `PronoteChildStatus` depuis un module nommable (ex. `pronote/provider.types.ts` ou le repo).
3. **GREEN — route** : dans `pronote-data.routes.ts`, réutiliser le helper `assertParentOrSelf(caller, childId)` (déjà présent dans ce fichier, ~L31-40, parent-of OU self) :
   ```ts
   .get('/api/pronote/children/:childId/status', async ({ params, user, status }) => {
     const ok = await assertParentOrSelf(user.id, params.childId);
     if (!ok) return status(403, { error: 'Access denied', code: 'forbidden' });
     const data = await pronoteChildResourcesRepository.getStatusByChild(params.childId);
     return { success: true, data };
   }, { params: t.Object({ childId: t.String() }) })
   ```
4. **GATE** serveur (+ vérifier piège mock `api-endpoints.test.ts` si la chaîne d'import change).
5. Stager + commit : `feat(pronote): GET children/:id/status read-model (parent-or-self)`.

---

### Task 5 : Read-model A2.2 — `hasPronote` sur `GET /parent/children` (batch, pas de N+1)

**Files**
- `apps/server/src/services/parent/parent-types.ts` (champ `hasPronote` sur `ChildInfo`)
- `apps/server/src/db/repositories/pronote-child-resources.repository.ts` (lecture batch `getMappedChildIds`)
- `apps/server/src/services/parent.service.ts` (`getParentChildren` enrichit en batch)
- `apps/server/src/tests/parent.service.test.ts` (étendre — TDD batch + isolation)

**Interfaces**
- `ChildInfo` (interface **exportée**, reste nommable pour `build:types`) gagne `hasPronote: boolean;`.
- `getMappedChildIds(childIds: string[]): Promise<Set<string>>` — **une** requête `IN (...)`, pas de boucle.
- La route `GET /parent/children` renvoie toujours le **tableau brut `ChildInfo[]`** (shape inchangée — le mobile `unwrap` directement).

**Steps**
1. **RED** — test `parent.service.test.ts` : parent P1 avec 2 enfants, un seul mappé → `getParentChildren(P1)` renvoie `hasPronote:true` pour le mappé, `false` pour l'autre. Vérifier **une seule** requête de mapping (spy sur le repo, pas N appels). Parent P2 avec un enfant mappé sur son propre credential ne fuit pas chez P1. Lancer → échoue (champ absent).
2. **GREEN — type** : ajouter `hasPronote: boolean;` à `ChildInfo` (`parent-types.ts` L1-12).
3. **GREEN — repo** : `getMappedChildIds(childIds: string[]): Promise<Set<string>>` — `select({ childUserId }).from(pronoteChildResources).where(inArray(pronoteChildResources.childUserId, childIds))` ; renvoyer `new Set(rows.map(r => r.childUserId))`. Court-circuit `if (childIds.length === 0) return new Set();`.
4. **GREEN — service** : dans `getParentChildren` (`parent.service.ts` L25-52), après le `.map(...)` qui construit `result`, faire **un** appel batch :
   ```ts
   const mapped = await pronoteChildResourcesRepository.getMappedChildIds(result.map((c) => c.id));
   return result.map((c) => ({ ...c, hasPronote: mapped.has(c.id) }));
   ```
   (et ajouter `hasPronote` au shape construit ; importer le repo en tête de fichier).
5. **GATE** serveur (+ piège mock : `parent.service` est déjà dans la chaîne `app.ts` ; le repo pronote tire `pronoteChildResources` — vérifier qu'`api-endpoints.test.ts` ne casse pas, mocker si besoin comme `retention-purge.service`).
6. Stager + commit : `feat(pronote): add hasPronote to parent children (batch, no N+1)`.

---

### Task 6 : Read-model A2.3 — `GET /api/pronote/credentials/list`

**Files**
- `apps/server/src/db/repositories/pronote-child-resources.repository.ts` (compte par credential) OU nouveau repo credentials
- `apps/server/src/services/pronote-sync.service.ts` (méthode `listCredentialSummaries`)
- `apps/server/src/routes/pronote-sync.routes.ts` (nouvelle route, ownership via `user.id`)
- `apps/server/src/tests/pronote-sync.routes.test.ts` (étendre — TDD)

**Interfaces**
- Produit (exporté/nommable Eden) :
  ```ts
  export interface PronoteCredentialSummary { credentialId: string; establishmentName: string | null; establishmentUrl: string; childCount: number; }
  ```
- Route : `GET /api/pronote/credentials/list` → `{ success: true, data: PronoteCredentialSummary[] }`.

**Steps**
1. **RED** — test : user avec 0 / 1 / 2 credentials ; `childCount` correct par credential ; `establishmentName` lu depuis la **colonne A0** (pas un appel Pronote) ; un autre user ne voit pas ces credentials (ownership). Lancer → échoue.
2. **GREEN — service** : `listCredentialSummaries(userId)` : `select` sur `pronoteCredentials` filtré `userId`, gauche-jointé/agrégé avec `count(pronoteChildResources.id)` groupé par `credentialId`. Mapper vers `PronoteCredentialSummary` (`establishmentName` depuis la colonne, `establishmentUrl` depuis `establishmentUrl`). Une requête agrégée, pas de N+1.
3. **GREEN — route** : dans `pronote-sync.routes.ts`, `GET /api/pronote/credentials/list` sous le `.guard({ auth: true })` existant, `data = await pronoteSyncService.listCredentialSummaries(user.id)`. **Ne pas toucher** l'actuel `GET /api/pronote/credentials` mono-record (device-first).
4. **GATE** serveur.
5. Stager + commit : `feat(pronote): GET credentials/list (per-establishment summaries)`.

---

### Task 7 : Read-model A3 — `DELETE /api/pronote/credentials/:id` (retrait d'établissement)

**Files**
- `apps/server/src/services/pronote-sync.service.ts` (méthode `deleteCredentialById`)
- `apps/server/src/routes/pronote-sync.routes.ts` (nouvelle route credential-scopée)
- `apps/server/src/tests/pronote-sync.routes.test.ts` (étendre — TDD)

**Interfaces**
- `deleteCredentialById(userId, credentialId): Promise<boolean>` — ownership vérifié, supprime credential + mappings, **garde** les comptes enfants.
- Route : `DELETE /api/pronote/credentials/:id` → `{ success: true }` ou 403/404.

**Steps**
1. **RED** — test : credential + 1 mapping + 1 compte enfant. `DELETE /credentials/:id` → credential supprimé, mapping supprimé, **compte enfant conservé** (le user existe toujours, son `getStatusByChild` repasse `hasPronote:false`). Ownership : un autre user → 403, credential supprimé d'autrui = non. Lancer → échoue.
2. **GREEN — service** : `deleteCredentialById(userId, credentialId)` : charger le credential (`getCredentialById`), si absent → false (route 404), si `userId !== owner` → lever `PronoteCredentialForbiddenError` (route 403). Le FK `pronote_child_resources.credential_id` est `onDelete('cascade')` (cf. schema L93-97) → la suppression du credential supprime les mappings automatiquement ; donc `db.delete(pronoteCredentials).where(eq(id, credentialId))`. **Ne pas** supprimer les `user` enfants. Ne **pas** toucher l'actuel `DELETE /api/pronote/credentials` user-scopé.
3. **GREEN — route** : `DELETE /api/pronote/credentials/:id`, mapper `PronoteCredentialForbiddenError → 403`, absent → 404, sinon `{ success: true }`. Réutiliser le pattern d'error-mapping des autres routes du fichier.
4. **GATE** serveur (+ `test:integration` couvre la chaîne — vérifier piège mock).
5. Stager + commit : `feat(pronote): DELETE credentials/:id (drop link, keep child accounts)`.

---

### Task 8 : Mobile — `usePronoteStatus(childId)` (React Query sur A2.1) + bascule des gates parent

**Files**
- `apps/mobile/src/hooks/usePronoteStatus.ts` (nouveau)
- `apps/mobile/src/app/(parent)/tabs/(home)/index.tsx` (badge → `child.hasPronote`)
- `apps/mobile/src/app/(parent)/tabs/(home)/child/[id]/index.tsx` (gate → `child.hasPronote` + status pour className/établissement)
- `apps/mobile/__tests__/hooks/usePronoteStatus.test.ts` (nouveau — TDD)

**Interfaces**
- `usePronoteStatus(childId: string)` → `{ data: { hasPronote, establishmentName, className } | undefined, isLoading, error }` via `getTreaty().api.pronote.children({ childId }).status.get()`.
- Cette tâche ne supprime encore **rien** du store : elle ajoute le hook serveur et bascule **uniquement** les écrans parent qui ont déjà `child.hasPronote` (A2.2) à disposition.

**Steps**
1. **RED** — `__tests__/hooks/usePronoteStatus.test.ts` : mock du treaty renvoyant `{ success:true, data:{hasPronote:true, establishmentName:'X', className:'4eB'} }`, asserter que le hook expose `data.hasPronote === true`. Mock 403/erreur → `error` défini, `hasPronote` non assumé true. Lancer `cd apps/mobile && pnpm test usePronoteStatus` → échoue.
2. **GREEN — hook** : `useQuery({ queryKey: ['pronote','status',childId], queryFn: async () => unwrap(await getTreaty().api.pronote.children({ childId }).status.get()).data, enabled: !!childId })`. Type de retour issu du contrat Eden (zéro `any`).
3. **GREEN — badge dashboard** (`(parent)/tabs/(home)/index.tsx` L55-69) : remplacer `const isMapped = pronote.resourceMappings[child.id] !== undefined;` par `const isMapped = child.hasPronote;` (le champ vient de `useParentDashboard().children`, A2.2). Retirer `pronote.resourceMappings` de la dépendance du `useMemo` (garder grades/homework pour les agrégats tant que `usePronote` lecture existe).
4. **GREEN — détail enfant** (`(parent)/…/child/[id]/index.tsx` L62-76) : remplacer le gate `resourceMappings[id]` par `child.hasPronote` (depuis la liste serveur) ; pour className/établissement afficher via `usePronoteStatus(id).data?.className` / `.establishmentName` (dégrade proprement si `null`).
5. **GATE** mobile (`pnpm typecheck && pnpm lint && pnpm test`). `typedRoutes` reste vert (aucune route supprimée).
6. Stager + commit : `feat(mobile): usePronoteStatus hook + migrate parent gates to server signal`.

---

### Task 9 : Mobile — bascule des gates élève + chat sur le signal serveur

**Files**
- `apps/mobile/src/app/(student)/(home)/index.tsx` (gate `isConnected`+`resources[0]` → status self)
- `apps/mobile/src/app/(student)/(profile)/index.tsx` (idem)
- `apps/mobile/src/app/(student)/(profile)/pronote/timetable.tsx` (empty-state `!isConnected` → status self)
- `apps/mobile/src/hooks/chat/useStreamManager.ts` (gate contexte → données cache non vides)
- `apps/mobile/__tests__/...` (étendre les tests d'écran existants)

**Interfaces**
- Élève : `usePronoteStatus(selfId)` (selfId = id de l'utilisateur courant) remplace `pronote.isConnected` + `pronote.resources[0].className`.
- Chat : remplacer `pronoteState.isConnected` par « données Pronote en cache non vides » — pas d'appel réseau dans le chemin d'envoi.

**Steps**
1. **RED** — étendre les tests d'écran : home/profil/EDT élève lisent `usePronoteStatus(selfId)` (mock) et non plus le store ; chat construit le contexte ssi `homework`/`grades`/`timetable` non vides. Lancer → échoue.
2. **GREEN — home élève** (`(student)/(home)/index.tsx` L159,196) : remplacer `pronote.isConnected && pronote.resources[0]?.className` par `status?.className` (où `const { data: status } = usePronoteStatus(selfId)`), et le gate des sections Pronote (`pronote.isConnected ?`) par `status?.hasPronote`.
3. **GREEN — profil élève** (`(student)/(profile)/index.tsx` L88-108,184) : même bascule via `usePronoteStatus(selfId)`.
4. **GREEN — EDT élève** (`(student)/(profile)/pronote/timetable.tsx` L173) : empty-state piloté par `!status?.hasPronote`.
5. **GREEN — chat** (`hooks/chat/useStreamManager.ts` L204-208) : remplacer
   ```ts
   const pronoteContext = pronoteState.isConnected ? buildPronoteChatContext(pronoteState) : undefined;
   ```
   par un gate sur les données en cache :
   ```ts
   const hasData = pronoteState.homework.length > 0 || pronoteState.grades.length > 0 || pronoteState.timetable.length > 0;
   const pronoteContext = hasData ? buildPronoteChatContext(pronoteState) : undefined;
   ```
   (plus correct : n'injecte jamais un contexte vide, et ne touche pas `isConnected` qu'on s'apprête à supprimer).
6. **GATE** mobile. À ce stade **tous** les consommateurs du local sont basculés — Task 10 peut supprimer les symboles.
7. Stager + commit : `feat(mobile): migrate student screens + chat gate to server-backed signal`.

---

### Task 10 : Mobile — supprimer le read-model local obsolète de `usePronote` + `pronote-store`

**Files**
- `apps/mobile/src/hooks/usePronote.ts` (réduire à la lecture)
- `apps/mobile/src/stores/pronote-store.ts` (retirer état/actions obsolètes)
- `apps/mobile/__tests__/...usePronote...` + `...pronote-store...` (retirer/adapter les tests `connect`/`resourceMappings`/`isConnected`)

**Interfaces**
- `usePronote(userId)` se réduit à : `grades`, `homework`, `timetable`, `errors`, `upcomingHomework`, `averageGrade`, `fetchGrades/Homework/Timetable(childId)`.
- À **supprimer** du store + hook : `isConnected`, `resources`, `metadata`, `resourceMappings`, `setResourceMapping`, `setResources`, `setConnected`, `connect()`, `disconnect()`.

**Steps** (ordre : aucun consommateur ne lit plus ces symboles depuis Task 8-9 ; sinon ne pas faire cette tâche)
1. Vérifier l'absence de consommateurs résiduels :
   ```bash
   cd apps/mobile && grep -rn "\.isConnected\|\.resources\b\|resourceMappings\|setResourceMapping\|setResources\|setConnected\|pronote\.connect\|pronote\.disconnect" src
   ```
   Doit ne renvoyer que les définitions dans `usePronote.ts`/`pronote-store.ts` (sinon basculer le consommateur d'abord — Task 8/9).
2. **store** : retirer de `PronoteState` (L29-47) `isConnected`, `metadata`, `resources`, `resourceMappings` et les actions `setConnected`/`setResources`/`setResourceMapping` ; retirer leurs valeurs initiales (L53-56) et implémentations (L71-80). Garder `homework`/`grades`/`timetable` + leurs setters + `errors` + `reset`.
3. **hook** : dans `usePronote.ts`, retirer les sélecteurs `isConnected`/`resources`/`resourceMappings`/`storeSetConnected`/`storeSetResources`/`storeSetResourceMapping`, les callbacks `connect`/`disconnect`/`setResourceMapping`, et ces clés de l'objet retourné. Retirer l'import `QrCodeData`/`PronoteConnectionResult`/`PronoteResource` devenus inutiles.
4. **tests** : retirer/adapter les tests `usePronote` qui couvraient `connect`/`resourceMappings`/`isConnected`. Conserver les tests `fetch*`/cache TTL/erreurs.
5. **GATE** mobile (`pnpm typecheck && pnpm lint && pnpm test`). Le grep de l'étape 1 doit être **clean** après suppression (zéro référence hors définitions supprimées).
6. Stager + commit : `refactor(mobile): drop obsolete local Pronote read-model (server is source of truth)`.

---

### Task 11 : Mobile — `ChildCredentialsFields` extrait de `add-child` (DRY, partagé wizard ↔ add-child)

**Files**
- `apps/mobile/src/components/parent/ChildCredentialsFields.tsx` (nouveau)
- `apps/mobile/src/app/(parent)/add-child.tsx` (consomme le composant extrait)
- `apps/mobile/__tests__/components/ChildCredentialsFields.test.tsx` (nouveau — TDD validation partagée)

**Interfaces**
- `ChildCredentialsFields` props : `{ username, password, schoolLevel, onChange(field, value), errors }` — groupe **username** (min 3, `^[a-zA-Z0-9_.]+$`) + **password** (min 8, lower+upper+digit, indicateur de robustesse) + **niveau** (`LevelPicker`).
- `add-child` garde en plus **prénom / nom / date de naissance** (la route Zod `createChildSchema` les exige). Le wizard, lui, n'aura **pas** de date de naissance (`activate` passe par `createChild` service, DOB optionnel — asymétrie assumée).

**Steps**
1. **RED** — `__tests__/components/ChildCredentialsFields.test.tsx` : rendu, saisie d'un username invalide (`a b`) → message d'erreur ; password faible → indicateur faible ; password fort → indicateur fort. Lancer → échoue (composant absent).
2. **GREEN — extraire** : créer `components/parent/ChildCredentialsFields.tsx` à partir des champs username/password/level de `add-child.tsx` (L34-78 pour la logique de validation username/password ; `LevelPicker` importé depuis `(parent)/add-child-level-picker`). Primitives `@/components/ui/` (`Input`, `Label`, `Text`), NativeWind, a11y, tokens `@repo/tokens`. ≤ 400 lignes.
3. **GREEN — recâbler add-child** : remplacer dans `add-child.tsx` le bloc username/password/level par `<ChildCredentialsFields username=… password=… schoolLevel=… onChange=… errors=… />`. Conserver firstName/lastName/dateOfBirth dans `add-child` (toujours requis par `createChildSchema`). La validation locale `validate()` reste, mais déléguer username/password à la même source que le composant (importer les regex partagées si extraites).
4. **GATE** mobile.
5. Stager + commit : `refactor(mobile): extract ChildCredentialsFields (shared add-child ↔ wizard)`.

---

### Task 12 : Mobile — `usePronoteConnect` (machine d'état serveur-driven)

**Files**
- `apps/mobile/src/hooks/usePronoteConnect.ts` (nouveau)
- `apps/mobile/__tests__/hooks/usePronoteConnect.test.ts` (nouveau — TDD machine d'état)

**Interfaces**
- État : `{ step, qrData, establishment, pin, credentialId, discovered: DiscoveredChild[], selections: ChildAccessSelection[], isPending, error, results: { activated, failed } }`.
- `step` ∈ `intro | scan | pin | discovering | select | define-access | activating | result`.
- `ChildAccessSelection = { resourceId, firstName, lastName, schoolLevel, mode: 'create'|'link', username?, password?, linkToChildId? }`.
- Transitions : `submitPin` → `POST /connect/qr` (→ `credentialId`) → `GET /credentials/:id/children` ; `confirmSelections` → `POST /credentials/:id/activate` ; `retryFailed` → ré-`activate` du **sous-ensemble échoué** uniquement (les `activated` ne sont pas rejoués) ; jeton expiré / `BadCredentials` au `connect/qr` → erreur « QR expiré » + retour `scan`.

**Steps**
1. **RED** — `__tests__/hooks/usePronoteConnect.test.ts` (mock du treaty), couvrir : happy `connect→discover→activate` ; `activate` partiel (1 failed) puis `retryFailed` ré-active **seulement** le failed (assert : 2e appel `activate` ne contient pas les `activated`) ; lien `existingChildId≠null` (mode `link`, pas de saisie) ; lien manuel (`linkToChildId` choisi) ; jeton expiré au `connect/qr` → `step === 'scan'` + `error` « QR expiré ». Lancer → échoue.
2. **GREEN** — implémenter le `useReducer`/state machine. `submitPin` : `getTreaty().api.pronote.connect.qr.post({ qr, pin })` → stocke `credentialId` → `getTreaty().api.pronote.credentials({ id }).children.get()` → `discovered`. `confirmSelections` : mappe `ChildAccessSelection[]` → `ActivationSelection[]` (drop `mode`, garder `linkToChildId` si `mode==='link'`) → `credentials({ id }).activate.post({ selections })` → `results`. `retryFailed(corrected)` : ré-`activate` avec **uniquement** les sélections corrigées correspondant aux `failed`. Mapper le code d'erreur `pronote_reauth_required` (connect/qr 409) → message « QR expiré » + `dispatch({ type:'reset-to-scan' })`. Zéro `any` (types depuis le contrat Eden).
3. **GATE** mobile.
4. Stager + commit : `feat(mobile): usePronoteConnect onboarding state machine`.

---

### Task 13 : Mobile — wizard `(parent)/pronote-connect.tsx` + route typée

**Files**
- `apps/mobile/src/app/(parent)/pronote-connect.tsx` (nouveau)
- `apps/mobile/src/app/(parent)/_layout.tsx` (enregistrer la route)
- `apps/mobile/src/components/parent/pronote/PronoteStepParentPin.tsx` (**supprimer**)
- `apps/mobile/__tests__/...` (étendre — wizard happy path + étape define-access)

**Interfaces**
- L'écran orchestre `usePronoteConnect` + les composants **réutilisés tels quels** : `PronoteStepIntro`, `PronoteStepQrScan`, `PronoteStepPin`, `PronoteQrScanner`, `PronotePinEntry`, `PronoteChildImport`, `PronoteStepConnecting`, `PronoteStepSuccess` ; helpers `parseQrCode`/`extractEstablishment`/`splitPronoteName`/`pronoteUsername`/`toPronoteDedupeKey` (`lib/pronote-helpers.ts`).
- **Étape « définir l'accès »** (remplace `PronoteStepChildPin`) : par enfant — match serveur (`existingChildId≠null`) → carte « sera relié à <prénom> » (mode `link`) ; lien manuel → choisir un enfant TomAI existant (liste `useParentDashboard().children`) → mode `link`, `linkToChildId` ; création → `ChildCredentialsFields` (username pré-rempli via `pronoteUsername`, password min 8, niveau suggéré).

**Steps**
1. Supprimer `components/parent/pronote/PronoteStepParentPin.tsx` (plus de PIN parent) ; vérifier qu'il n'est importé nulle part : `cd apps/mobile && grep -rn "PronoteStepParentPin" src` → vide après suppression de l'import dans l'ancien flux.
2. **wizard** : `pronote-connect.tsx` — switch sur `state.step`, branchant les `PronoteStep*` existants ; à `select`/`define-access` rendre une carte par `discovered`, câblée sur l'API de Task 12. Réutiliser `ChildCredentialsFields` (Task 11) pour le mode `create`. Header/back via Expo Router. NativeWind, a11y, tokens, ≤ 400 lignes.
3. **route** : dans `(parent)/_layout.tsx` (après L29) ajouter `<Stack.Screen name="pronote-connect" options={{ title: 'Connecter Pronote' }} />`. `typedRoutes:true` exige que le fichier existe → l'ajouter dans le **même commit**.
4. **CTAs d'entrée** : dashboard parent empty-state (0 enfant) → « Connecter Pronote » (en plus de « Ajouter un enfant ») ; avec enfants → « Gérer Pronote » (pointera vers Task 14). Router.push(`/(parent)/pronote-connect`).
5. **GATE** mobile (`typedRoutes` vert : route enregistrée + fichier présent + `PronoteStepParentPin` n'est plus référencé).
6. Stager + commit : `feat(mobile): Pronote onboarding wizard screen + typed route`.

---

### Task 14 : Mobile — gestion `(parent)/pronote-manage.tsx` (list, resync, delete, reset mdp)

**Files**
- `apps/mobile/src/app/(parent)/pronote-manage.tsx` (nouveau)
- `apps/mobile/src/app/(parent)/_layout.tsx` (enregistrer la route)
- `apps/mobile/__tests__/...` (étendre — list/resync/delete/reset)

**Interfaces**
- Lit `GET /api/pronote/credentials/list` (Task 6). Par établissement (carte) : nom, `childCount`, **resync** (`POST /credentials/:id/resync`, affiche `added`), **retirer cet établissement** (`DELETE /credentials/:id` + confirmation). Bouton **« Connecter un autre établissement »** → wizard. **Reset mdp** par enfant via `PATCH /parent/children/:id` (`useParentDashboard().updateChild` ou treaty direct). 0 credential → lance directement le wizard. Erreurs **isolées par carte**.

**Steps**
1. **RED** — étendre tests : liste rendue depuis `credentials/list` (mock) ; resync affiche `added` ; delete demande confirmation puis appelle `DELETE`, la carte disparaît ; reset mdp appelle `PATCH /parent/children/:id` avec `{ password }` ; 0 credential → redirige vers le wizard. Lancer → échoue.
2. **GREEN** — `pronote-manage.tsx` : `useQuery` sur `credentials/list` ; carte par credential ; resync → mutation `credentials({ id }).resync.post()` + toast `added.length` (« à jour » si 0) ; delete → confirmation (`Alert`/dialog) puis `credentials({ id }).delete()` + invalidation de la query ; reset mdp → champ password (réutiliser la robustesse de `ChildCredentialsFields`) + `useParentDashboard().updateChild({ childId, password })`, succès → rappeler de retransmettre à l'enfant ; bouton « Connecter un autre établissement » → `router.push('/(parent)/pronote-connect')`. Erreurs isolées par carte (état d'erreur local par credential). ≤ 400 lignes.
3. **route** : `(parent)/_layout.tsx` → `<Stack.Screen name="pronote-manage" options={{ title: 'Gérer Pronote' }} />`. Brancher le CTA « Gérer Pronote » (Task 13.4) dessus.
4. **GATE** mobile.
5. Stager + commit : `feat(mobile): Pronote management screen (list, resync, delete, reset password)`.

---

## Self-Review

### Couverture spec → tâche

| Exigence spec | Tâche(s) |
|---|---|
| **A0** — colonnes `establishment_name` (cred), `class_name`+`establishment_name` (child_resources), unicité `(credential_id, resource_id)`, migration DDL pure | Task 1 |
| **A0** — écriture `establishment_name` au `connect/qr`, `class_name`+`establishment_name` à l'`activate` | Task 2 |
| **A1 — détection de conflit (C4)** `linkToChildId` déjà mappé → `failed[{reason:'already_mapped'}]`, mapping intact, garde `isParentOf` conservée | Task 3 |
| **A2.1** — `GET /children/:childId/status` (`hasPronote`/`establishmentName`/`className`), garde `assertParentOrSelf` (parent-of OU self) | Task 4 |
| **A2.2** — `hasPronote` sur `GET /parent/children`, jointure **batch** (pas de N+1), `ChildInfo` exporté/nommable, tableau brut inchangé | Task 5 |
| **A2.3** — `GET /credentials/list` → `PronoteCredentialSummary[]` (childCount, establishmentName colonne A0, ownership) | Task 6 |
| **A3** — `DELETE /credentials/:id` (credential-scopé, ownership, supprime mappings via cascade, **garde** comptes enfants → `hasPronote=false`) ; device-first non touché | Task 7 |
| **A4** — reset mdp `PATCH /parent/children/:id` (existant, réutilisé) | Task 14 |
| **Partie C** — badge dashboard (`child.hasPronote`) ; détail enfant (`hasPronote` + status) | Task 8 |
| **Partie C** — home/profil/EDT élève (status self) ; chat (cache non vide, plus `isConnected`) | Task 9 |
| **Partie C** — suppression `isConnected`/`resources`/`metadata`/`resourceMappings`/setters/`connect`/`disconnect` ; `usePronoteStatus` ; `usePronote` réduit à la lecture | Task 8 (hook) + Task 10 (suppression) |
| **B3** — `ChildCredentialsFields` extrait (DRY, partagé), asymétrie DOB assumée | Task 11 |
| **B1** — `usePronoteConnect` machine d'état (connect→discover→activate, retryFailed sous-ensemble, create/link auto/manuel, jeton expiré→scan) | Task 12 |
| **B2** — wizard `(parent)/pronote-connect.tsx`, `PronoteStep*` réutilisés, **étape define-access**, `PronoteStepParentPin` supprimé, route typée, CTAs d'entrée | Task 13 |
| **B4** — gestion `(parent)/pronote-manage.tsx` (list, resync `added`, delete+confirm, reset mdp, multi-établissement isolé, 0 credential→wizard) | Task 14 |
| **Gestion d'erreurs** — PIN invalide / jeton expiré→scan / réseau retry (connect) | Task 12 |
| **Gestion d'erreurs** — 0 enfant discover / réseau sans reperdre le credential | Task 12 |
| **Gestion d'erreurs** — activate partiel `failed[]` par enfant + reprise du sous-ensemble | Task 3 (serveur) + Task 12 (UI reprise) |
| **Gestion d'erreurs** — resync idempotent, 0 ajout « à jour » | Task 14 |
| **Gestion d'erreurs** — retrait établissement avec confirmation | Task 14 |
| **Gestion d'erreurs** — reset mdp robustesse + rappel de retransmettre | Task 14 |
| **Tests serveur** (schéma, status authz, batch, list, delete, conflit, IDOR, piège mock) | Tasks 1-7 (TDD chacune) |
| **Tests mobile** (usePronoteConnect, wizard, manage, ChildCredentialsFields, usePronoteStatus, usePronote simplifié) | Tasks 8-14 (TDD chacune) |

### Note green-at-commit (ordonnancement)

L'ordre **1→14** respecte la contrainte « vert à chaque commit » :

- **Serveur d'abord (1→7)** : chaque endpoint/champ est ajouté **avant** que le mobile le consomme. Aucune route supprimée ; `ChildInfo`/`PronoteChildStatus`/`PronoteCredentialSummary` exportés → `build:types` reste vert (frontière Eden).
- **Migration read-model en deux temps (8→9 puis 10)** : on **bascule chaque gate sur le signal serveur (Tasks 8-9) AVANT de supprimer les symboles locaux (Task 10)** — le grep de Task 10.1 prouve qu'aucun consommateur ne lit plus le local avant suppression. Inverser casserait `typedRoutes`/typecheck pre-commit.
- **Onboarding ensuite (11→14)** : `ChildCredentialsFields` (11) précède le wizard (13) et la gestion (14) qui le réutilisent ; `usePronoteConnect` (12) précède le wizard (13) qui l'orchestre ; `pronote-connect` route (13) précède le CTA « Connecter un autre établissement » de `pronote-manage` (14). `PronoteStepParentPin` n'est supprimé qu'en Task 13, dans le même commit que le wizard qui rend l'ancien flux obsolète → jamais de référence dangling.
