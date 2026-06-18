# Pronote B2-backend — Plan d'exécution (TDD, subagent-driven)

Conception : `docs/superpowers/specs/2026-06-15-pronote-server-side-design.md`. Cadre : `2026-06-18-pronote-increment-b2.md`. Branche : `feat/pronote-server-provider`.

## Global Constraints (lentille de revue — copier verbatim au reviewer)

- **Runner de test** : `cd apps/server && bun run test` (isolé, scanne `src/tests/`). JAMAIS `bun test src/tests/` (pollution mock.module). Intégration : `bun run test:integration`. Tests unitaires dans `src/tests/<name>.test.ts`.
- **Sécurité logs** : ne JAMAIS logger token, identifiants, PIN, payload QR. Seulement compteurs, host, `kind`, longueurs, booléens.
- **deviceUUID généré par le SERVEUR** (`crypto.randomUUID()`), stocké dans la metadata chiffrée (`PronoteMetadata.deviceUuid`), réutilisé pour tous les `loginToken`. Le mobile n'en fournit jamais.
- **Jamais le mot de passe Pronote** ne transite ni n'est stocké (token-only). `loginCredentials` reste test-only (démo).
- **pawnote hors bundle** : ce travail est 100 % serveur, aucun changement mobile.
- **Mappings confirmés contre les types installés** `node_modules/.pnpm/pawnote@1.6.2/.../dist/index.d.ts` — jamais inventés.
- **Piège `api-endpoints.test.ts`** : toute nouvelle route montée dans `app.ts` qui tire les schémas Drizzle doit y être mockée (cf. mock de `pronote-data.routes`).
- **Validation finale** : `bun run typecheck && bun run lint && bun run test` + `bun run test:integration` + monorepo `pnpm typecheck && pnpm lint`.

## Surface existante (ne pas redécouvrir)

- Adapter `pawnote-server.adapter.ts` : `connect({url,kind,username,token,deviceUuid})`, `getGrades/Homework/Timetable(session,resourceId[,day])`, `createServerFetcher()` (User-Agent PRONOTE), `use(handle,resourceId)`. Imports pawnote : `createSessionHandle, loginToken, gradesOverview, assignmentsFromIntervals, timetableFromIntervals, use`.
- `pronoteSyncService` : `upsertCredentials(userId,{token,metadata,tokenExpiresAt})→{success,credentialId}` (chiffre, clé `(userId, normalizeEstablishmentUrl(instanceUrl))`), `getCredentialById(id)`, `updateTokenById(id,token)`, `normalizeEstablishmentUrl`.
- `pronoteDataService` : `getOrCreateSession(credentialId)` (privé : cache + inflight-dedup + persist-before-cache), `resolveSession(childId)`, `primeSession(credentialId,session)`, `getGrades/Homework/Timetable(childId)`.
- Schéma : `pronote_credentials(id,userId,encryptedToken,encryptedMetadata,establishmentUrl,tokenExpiresAt)` ; `pronote_child_resources(id,parentUserId,childUserId,credentialId,resourceId)` unique `(parentUserId,childUserId)`.
- `PronoteMetadata = {instanceUrl, username, deviceUuid, accountKind}` (JSON chiffré).
- `parentChildRepository` : `link/unlink/getChildIds/getParentIds/isLinked`. `pronoteChildResourcesRepository` : `getMapping(childId)→{parentUserId,credentialId,resourceId}|null`, `upsertMapping(parent,child,credentialId,resourceId)`, `deleteByChild`.
- `parentService.createChild(parentId,{firstName,lastName,username,password,schoolLevel,dateOfBirth})→ChildInfo` (crée user student via `auth.api.signUpEmail` + email interne, link parent_child, compensation delete). `getParentChildren(parentId)→ChildInfo[]`.
- `SchoolLevel` = `schoolLevelEnum.enumValues` (lire les valeurs dans `auth.schema.ts:7`). Colonnes user `schoolLevel`/`dateOfBirth` **nullable**.
- pawnote : `geolocation({latitude,longitude},fetcher?)→GeolocatedInstance[]{url,name,latitude,longitude,postalCode,distance}` ; `loginQrCode(handle,{deviceUUID,pin,qr})→RefreshInformation{url,token,username,kind}` ; resources via `handle.user.resources: UserResource[]{id,kind,name,className?,establishmentName,tabs}`.
- Routes pattern Elysia : `.guard({auth:true})`, body `t.Object`, `assertParentOrSelf`, `mapPronoteError`. Montage `app.ts:283-284`.

## Décisions de conception (tranchées)

1. **Enfant = profil** : à l'activation, le serveur génère un `username` interne unique et un `password` aléatoire fort (jamais utilisé — accès par impersonation parent Better Auth). `dateOfBirth` = null (Pronote ne le fournit pas).
2. **schoolLevel confirmé par le parent** : `discover` *suggère* un niveau depuis `className` (helper best-effort) ; `activate` *reçoit* le `schoolLevel` final dans chaque sélection (le mobile pré-remplit la suggestion, le parent valide). Le serveur n'impose pas un mapping fragile.
3. **Fusion-confirmation par nom** : `discover` compare chaque resource Pronote aux enfants existants du parent (nom normalisé) et renvoie `existingChildId` si match → `activate` lie au lieu de créer.
4. **`createChild` étendu** (rétro-compatible) : `username`/`password`/`dateOfBirth` deviennent optionnels (générés / null si absents). Les appelants actuels (qui les passent) restent inchangés.
5. **tokenExpiresAt du QR** : pawnote ne renvoie pas d'expiry → convention `now + 365 j` (le refresh rotatif gère la validité réelle ; le champ sert au tri/diagnostic).

---

## Task 1 — Géolocalisation d'établissements

**Fichiers** : `pawnote-server.adapter.ts`, `src/routes/pronote-connect.routes.ts` (nouveau), `src/tests/pawnote-server-adapter.test.ts`, `app.ts`.

**Step 1 (test)** : dans `pawnote-server-adapter.test.ts`, mock `pawnote.geolocation` pour renvoyer 2 `GeolocatedInstance`. Assert `adapter.searchEstablishments(48.85, 2.35)` retourne `[{name,url,postalCode,distance}, ...]` (mapping fidèle, tri par distance croissante).

**Step 2 (impl)** : `searchEstablishments(latitude:number, longitude:number): Promise<{name:string;url:string;postalCode:number;distance:number}[]>` → `geolocation({latitude,longitude}, createServerFetcher())`, map, `sort((a,b)=>a.distance-b.distance)`.

**Step 3 (route)** : créer `pronote-connect.routes.ts` avec `GET /api/pronote/establishments`, `.guard({auth:true})`, query `t.Object({lat:t.Numeric(),lng:t.Numeric()})` → `{success:true,data}`. Monter dans `app.ts` à côté des autres routes pronote. **Mocker la route dans `api-endpoints.test.ts`** (pattern `pronote-data.routes`).

**Test** : `bun run test` (adapter) + typecheck. Commit.

---

## Task 2 — Capture QR server-side (connect/qr)

**Fichiers** : `pawnote-server.adapter.ts`, `src/services/pronote/pronote-connect.service.ts` (nouveau), `pronote-connect.routes.ts`, `src/tests/pronote-connect-service.test.ts`, `src/tests/pawnote-server-adapter.test.ts`.

**Contrat adapter** : `connectWithQrPayload({qr,pin}): Promise<{session:AdapterSession; metadata:{instanceUrl,username,kind,deviceUuid}; resources:DiscoveredResource[]}>` où `DiscoveredResource={resourceId:number;name:string;className:string|null;establishmentName:string}`. Le serveur génère `deviceUuid=crypto.randomUUID()`, appelle `loginQrCode(handle,{deviceUUID,pin,qr})`, lit `handle.user.resources` → map (id→resourceId via `use`/index ; **confirmer comment l'id de resource est obtenu pour `use()`** : l'index dans `handle.user.resources`).

**Contrat service** : `pronoteConnectService.connectQr(userId, {qr,pin}): Promise<{credentialId:string; children:DiscoveredChild[]}>`. Construit `metadata=JSON.stringify({instanceUrl:url,username,deviceUuid,accountKind:kind})`, `tokenExpiresAt = now+365j ISO`, `upsertCredentials(userId,{token,metadata,tokenExpiresAt})` → `credentialId`. Puis enrichit les resources en `DiscoveredChild` (cf. Task 3 helper de suggestion+dedup). `primeSession(credentialId, session)` (réutilise la session ouverte).

**Route** : `POST /api/pronote/connect/qr`, `.guard({auth:true})`, body `t.Object({qr:t.Object({jeton:t.String(),login:t.String(),url:t.String()}), pin:t.String({minLength:4,maxLength:4})})` → `{success:true,data:{credentialId,children}}`. **Aucun log de qr/pin/token.** Erreurs → `mapPronoteError`.

**Tests (unit)** : mock pawnote `loginQrCode` + `createSessionHandle` (handle.user.resources stub). Assert : deviceUuid généré (présent dans metadata passée à upsert), `upsertCredentials` appelé, `credentialId` + `children` retournés. Adapter test : mapping resources.

**Test intégration gated** : `pronote-qr.integration.test.ts`, `describe.skipIf(!process.env.PRONOTE_TEST_QR)`, alimenté par un vrai payload `{jeton,login,url}`+pin → `connectQr` → assert credentialId + ≥1 child + une lecture (prouve `loginQrCode→loginToken`). Ne logge que compteurs/host.

Commit.

---

## Task 3 — Découverte + suggestion + dedup (discover)

**Fichiers** : `pronote-connect.service.ts`, `src/lib/pronote-onboarding.ts` (helpers purs), `pronote-data.service.ts` (exposer `listResources`), `pronote-connect.routes.ts`, tests.

**Helpers purs** (`pronote-onboarding.ts`, testés isolément) :
- `splitName(fullName):{firstName,lastName}` (Pronote = "Prénom NOM" ; heuristique : premier token = prénom, reste = nom).
- `inferSchoolLevel(className:string|null): SchoolLevel|null` — regex best-effort vers `schoolLevelEnum` (lire les valeurs réelles). Retourne null si indéterminé.
- `matchExistingChild(resourceName, existingChildren:{id,firstName,lastName}[]): string|null` — normalise (minuscule, sans accents, trim) et compare → `id` si match.

**Service** : `discover(userId, credentialId): Promise<DiscoveredChild[]>` où `DiscoveredChild={resourceId,name,className,establishmentName,suggested:{firstName,lastName,schoolLevel:SchoolLevel|null}, existingChildId:string|null}`. Vérifie que le credential appartient à `userId` (via `getCredentialById` + comparer userId). `listResources(credentialId)` (nouvelle méthode publique de `pronoteDataService`, via `getOrCreateSession` → `handle.user.resources`). Charge `parentService.getParentChildren(userId)` pour le dedup.

**Route** : `GET /api/pronote/credentials/:id/children`, `.guard({auth:true})`, vérifie propriété → `{success:true,data:DiscoveredChild[]}`.

**Tests** : helpers purs (cas variés className/noms) ; service avec mocks (dedup trouve/ne trouve pas). Commit.

---

## Task 4 — Étendre createChild (champs optionnels)

**Fichiers** : `parent.service.ts`, `src/tests/parent-service.test.ts`.

**Step 1 (test)** : `createChild(parentId,{firstName,lastName,schoolLevel})` (sans username/password/dateOfBirth) crée un enfant : username interne unique généré, password aléatoire, dateOfBirth absent (null/undefined), role student, link parent. Les appels existants (avec tous les champs) restent identiques.

**Step 2 (impl)** : rendre `username?`/`password?`/`dateOfBirth?` optionnels. Si absent : `username = child_<timestamp>_<rand>`, `password = crypto.randomUUID()` (fort, jamais réutilisé), `dateOfBirth = undefined` (colonne nullable). Garder compensation delete.

**Test** : `bun run test` (parent-service). Commit.

---

## Task 5 — Activation (create/link + mappings)

**Fichiers** : `pronote-connect.service.ts`, `pronote-connect.routes.ts`, tests.

**Contrat** : `activate(parentUserId, credentialId, selections): Promise<{activated:{resourceId,childId}[]}>` où `selection={resourceId:number; firstName:string; lastName:string; schoolLevel:SchoolLevel; linkToChildId?:string}`. Vérifie propriété du credential. Pour chaque sélection :
- si `linkToChildId` : `parentChildRepository.link(parentUserId, linkToChildId)` (idempotent) ; `childId = linkToChildId`.
- sinon : `parentService.createChild(parentUserId,{firstName,lastName,schoolLevel})` → `childId`.
- puis `pronoteChildResourcesRepository.upsertMapping(parentUserId, childId, credentialId, resourceId)`.
Transactionnel par item ; si createChild échoue, ne pas écrire le mapping ; agréger les succès.

**Route** : `POST /api/pronote/credentials/:id/activate`, `.guard({auth:true})`, body `t.Object({selections:t.Array(t.Object({resourceId:t.Number(),firstName:t.String(),lastName:t.String(),schoolLevel:t.String(),linkToChildId:t.Optional(t.String())}))})` → `{success:true,data:{activated}}`.

**Tests** : mock createChild/repos. Cas create, cas link, cas mixte. Commit.

---

## Task 6 — Resync (US-12)

**Fichiers** : `pronote-connect.service.ts`, `pronote-connect.routes.ts`, tests.

**Contrat** : `resync(userId, credentialId): Promise<{added:DiscoveredChild[]; stillMapped:number[]}>`. Vérifie propriété. `listResources(credentialId)` → resources actuelles. Compare aux `pronote_child_resources` existants pour ce credential : `added` = resources non encore mappées (avec suggestion+dedup comme discover) ; `stillMapped` = resourceIds déjà mappés et toujours présents. **Idempotent**, n'écrit rien (le parent active ensuite via Task 5). Couvre le parent séparé qui rejoint un enfant déjà présent (dedup→existingChildId→link).

**Route** : `POST /api/pronote/credentials/:id/resync`, `.guard({auth:true})` → `{success:true,data}`.

**Tests** : mocks (resource ajoutée, resource déjà mappée). Commit.

---

## Task 7 — Eden types + intégration app.ts

**Fichiers** : `app.ts` (montage `pronoteConnectRoutes` si pas déjà), `api-endpoints.test.ts` (mock de la nouvelle route), `@repo/api` rebuild.

`pnpm --filter tomai-server build:types`, `pnpm typecheck` monorepo. Vérifier que les nouvelles routes sont mockées dans `api-endpoints.test.ts`. `bun run test:integration` vert. Commit.

---

## Task 8 — e2e démo (chaîne complète, zéro mock data)

**Fichiers** : `src/integration-tests/pronote-onboarding.integration.test.ts`.

`loginWithCredentials(démo)` → `primeSession` un credential réel → exerce `discover` (≥1 resource réelle) → `activate` (crée 1 profil + mapping) → lecture `getGrades(childId)` via la vraie route → assert payload non vide. Cleanup `afterAll` (users `probe-%`, credentials, mappings). Le niveau token-rotatif reste couvert par `pronote-qr.integration.test.ts` (Task 2, gated).

`bun run test:integration`. Commit.

---

## Final
Broad review (opus) sur `merge-base main HEAD`..HEAD, puis `finishing-a-development-branch`.
