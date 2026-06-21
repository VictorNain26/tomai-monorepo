# Onboarding Pronote serveur (QR-first complet) — Design

**Date** : 2026-06-21
**Statut** : design validé en brainstorming + revue d'architecture (4 Critical / 3 Important corrigés inline). À transformer en plan.
**Périmètre** : `apps/server` (schéma + endpoints read-model + onboarding) + `apps/mobile` (wizard + gestion + migration read-model). Branche : `feat/pronote-onboarding-server`.
**Pré-requis livrés** : sous-projet 1 (login enfant autonome, `#250`) + Phase A données (`#249`), mergés sur `main`.

Sous-projet 2 du chantier Pronote B2-front. Le **sous-projet 3** (WebView ENT + recherche établissement géoloc) est un problème technique distinct, traité après.

**Pas de demi-version.** Découverte multi-enfant, activation (création OU lien auto/manuel), échecs partiels avec reprise, jeton QR expiré, resync, multi-établissement, retrait d'établissement, reset du mot de passe enfant — tout est dans le périmètre.

---

## Problème

La chaîne serveur existe (`connect/qr` → `discover` → `activate` → `resync`) mais le mobile ne sait pas encore l'orchestrer. Pire, depuis le sous-projet 1, le mobile s'appuie encore sur un **read-model local obsolète** : `usePronote.isConnected`/`resources`/`resourceMappings` (Zustand/MMKV) — désaligné de la vérité serveur (`pronote_child_resources`) — gate l'affichage Pronote sur **plusieurs écrans** (détail enfant parent, home/profil/EDT élève) et l'injection du contexte Pronote dans le **chat**. `usePronote.connect()`/`disconnect()` sont du code mort. Il manque côté serveur les signaux de lecture (« cet enfant a Pronote », « quels établissements », nom d'établissement / classe) pour remplacer ce local.

## Objectif

1. Onboarding Pronote par **scan QR** : découverte → activation (création du login autonome **ou** lien à un enfant existant) → resync, multi-établissement.
2. **Migrer tout le read-model Pronote sur la vérité serveur** et supprimer l'état local obsolète, sans casser un seul écran.
3. Flux complets : retrait d'établissement, reprise d'échecs, reset mot de passe enfant.

---

## Partie A — Serveur

### A0. Schéma : persister les métadonnées d'affichage à l'onboarding

Aujourd'hui un credential ne stocke que `establishmentUrl` (clair) + metadata chiffrée `{instanceUrl, username, deviceUuid, accountKind}` — **pas** de nom d'établissement ; et `pronote_child_resources` ne stocke que `(parentUserId, childUserId, credentialId, resourceId)` — pas de classe ni de nom. Le nom d'établissement et la classe n'existent que sur le `DiscoveredResource` live. Pour servir les écrans sans appel Pronote à chaque lecture, on **persiste au moment de l'onboarding** :

- `pronote_credentials.establishment_name` (varchar, nullable) — écrit au `connect/qr` depuis `resources[0].establishmentName`.
- `pronote_child_resources.class_name` (varchar, nullable) + `pronote_child_resources.establishment_name` (varchar, nullable) — écrits à l'`activate` depuis le `DiscoveredResource`/`DiscoveredChild` sélectionné (`className`, `establishmentName`).
- **Contrainte d'unicité ajoutée** : `(credential_id, resource_id)` unique (empêche de mapper un même élève Pronote à deux enfants de l'app — cf. C4).

Pré-prod : `db:push` en dev + migration `db:generate` (DDL pur, pas de backfill, pas de données).

### A1. Onboarding (endpoints existants, enrichis au besoin)

Consommés tels quels, avec écriture des métadonnées A0 :
- `POST /api/pronote/connect/qr` — body `{ qr:{jeton,login,url}, pin:string(4) }` → `{ credentialId, resources: DiscoveredResource[] }`. **Écrit `establishment_name`** sur le credential.
- `GET /api/pronote/credentials/:id/children` (discover) → `DiscoveredChild[]` = `DiscoveredResource & { suggested:{firstName,lastName,schoolLevel|null}, existingChildId: string|null }`.
- `POST /api/pronote/credentials/:id/activate` — body `{ selections: ActivationSelection[] }` → `{ activated:{resourceId,childId}[], failed:{resourceId,reason}[] }`.
  - `ActivationSelection = { resourceId, firstName, lastName, schoolLevel, username(min3,/^[a-zA-Z0-9_.]+$/), password(min8), linkToChildId? }`.
  - **Écrit `class_name`+`establishment_name`** sur le mapping créé.
  - **Détection de conflit (C4)** : si `linkToChildId` fourni et que cet enfant a **déjà** un mapping Pronote → ne PAS écraser ; renvoyer cet enfant dans `failed[]` avec `reason: 'already_mapped'`. La garde d'ownership `isParentOf(parent, linkToChildId)` existe déjà (anti-IDOR) et est conservée.
- `POST /api/pronote/credentials/:id/resync` → `{ added: DiscoveredChild[], stillMapped: number[] }`.

### A2. Read-model (nouveau — c'est ce qui remplace le local mobile)

1. **`GET /api/pronote/children/:childId/status`** → `{ success, data: { hasPronote: boolean, establishmentName: string|null, className: string|null } }`. Garde `assertParentOrSelf` (un **parent** pour son enfant **ou l'élève pour lui-même**). Lit `pronote_child_resources` (jointure credential). C'est le signal unique qui remplace `isConnected`/`resources[0]` partout (parent détail + écrans élève + chat).
2. **`hasPronote: boolean` sur `GET /parent/children`** : `ChildInfo` (interface exportée, reste nommable pour `build:types`) gagne le champ. `getParentChildren` fait **une** jointure batch sur `pronote_child_resources` (pas de N+1) — `hasPronote = ∃ mapping`. La route renvoie le **tableau brut `ChildInfo[]`** (shape inchangée, le mobile `unwrap` déjà directement).
3. **`GET /api/pronote/credentials/list`** → `{ success, data: PronoteCredentialSummary[] }`, `PronoteCredentialSummary = { credentialId, establishmentName: string|null, establishmentUrl, childCount }`. `establishmentName` vient de la **colonne A0** ; `childCount` = `count(pronote_child_resources WHERE credential_id=…)`. Garde d'ownership. (L'actuel `GET /credentials` mono-record reste pour le device-first, non touché.)

### A3. Retrait d'établissement (I1)

**`DELETE /api/pronote/credentials/:id`** (credential-scopé, ownership) → supprime le credential + ses mappings `pronote_child_resources` (cascade ou suppression explicite). L'actuel `DELETE /api/pronote/credentials` (user-scopé, efface tout) est laissé pour le device-first. Les comptes enfants **ne sont pas supprimés** (ils gardent leur login autonome) ; seul le lien Pronote part — un enfant délié repasse `hasPronote=false`.

### A4. Reset mot de passe enfant (existant)

`PATCH /parent/children/:id` body `{ password }` (hash Better Auth) — réutilisé tel quel par l'écran de gestion.

---

## Partie B — Mobile : onboarding

### B1. `usePronoteConnect` (nouveau hook, machine d'état serveur-driven)

État : `step, qrData, establishment, pin, credentialId, discovered: DiscoveredChild[], selections: ChildAccessSelection[], isPending, error, results:{activated,failed}`.
Étapes : `intro → scan → pin → discovering → select → define-access → activating → result`.
Transitions clés :
- `submitPin` → `POST /connect/qr` (→ `credentialId`) → `GET /credentials/:id/children` (discover).
- `confirmSelections` → `POST /credentials/:id/activate`.
- `retryFailed` → ré-`activate` avec **uniquement** les sélections corrigées (les `activated` ne sont pas rejoués).
- jeton expiré / `BadCredentials` au `connect/qr` → message « QR expiré » + retour `scan`.

`ChildAccessSelection` (aligné `ActivationSelection`) : `{ resourceId, firstName, lastName, schoolLevel, mode: 'create'|'link', username?, password?, linkToChildId? }`.

### B2. Écran wizard `(parent)/pronote-connect.tsx`

Orchestration des composants **réutilisés tels quels** : `PronoteStepIntro`, `PronoteStepQrScan`, `PronoteStepPin`, `PronoteQrScanner`, `PronotePinEntry`, `PronoteChildImport`, `PronoteStepConnecting`, `PronoteStepSuccess` ; helpers `parseQrCode`/`extractEstablishment`/`splitPronoteName`/`pronoteUsername`/`toPronoteDedupeKey`.
**Étape « définir l'accès »** (remplace `PronoteStepChildPin`) : par enfant sélectionné —
- match serveur (`existingChildId≠null`) → carte « sera relié à <prénom> » (mode `link`, pas de saisie).
- lien manuel → le parent choisit un enfant TomAI existant (liste `useParentDashboard().children`) → mode `link`, `linkToChildId`.
- création → `ChildCredentialsFields` (username pré-rempli via `pronoteUsername`, mot de passe min 8 + robustesse, niveau suggéré).
`PronoteStepParentPin` est **supprimé** (plus de PIN parent).

### B3. `ChildCredentialsFields` (composant extrait, DRY)

Groupe username + mot de passe (robustesse) + niveau, sorti de `add-child.tsx` et partagé wizard ↔ add-child. `add-child` garde en plus prénom/nom/date de naissance (la route Zod l'exige) ; le wizard pré-remplit prénom/nom depuis `suggested` et **n'a pas** de date de naissance (`activate` passe par le service `createChild` directement, DOB optionnel — asymétrie vérifiée et assumée, cf. `TODO(product)` `parent.routes.ts`).

### B4. Écran de gestion `(parent)/pronote-manage.tsx`

Lit `GET /credentials/list`. Par établissement (carte) : nom, nombre d'enfants, **resync** (`POST /credentials/:id/resync`, affiche `added`), **retirer cet établissement** (`DELETE /credentials/:id` + confirmation). Bouton **« Connecter un autre établissement »** → wizard. Accès **reset mot de passe** par enfant (`PATCH /parent/children/:id`). 0 credential → lance directement le wizard. Erreurs isolées par carte.

---

## Partie C — Mobile : migration read-model (remplace le local, écran par écran)

**Avant toute suppression**, remplacer chaque consommateur du local par le signal serveur (même incrément → reste vert) :

| Consommateur | Lit aujourd'hui | Remplacement |
|--------------|-----------------|--------------|
| Badge dashboard `(parent)/tabs/(home)/index.tsx` | `pronote.resourceMappings[child.id]` | `child.hasPronote` (liste enfants serveur, A2.2) |
| Détail enfant `(parent)/…/child/[id]/index.tsx` | `resourceMappings[id]` (gate section Pronote) | `child.hasPronote` ; className/établissement via `GET /children/:id/status` (A2.1) |
| Home élève `(student)/(home)/index.tsx` | `pronote.isConnected` + `resources[0]` (className) | `GET /children/:selfId/status` (`hasPronote`, `className`) |
| Profil élève `(student)/(profile)/index.tsx` | `pronote.isConnected` + `resources[0]` | idem status (self) |
| EDT élève `(student)/(profile)/pronote/timetable.tsx` | `!pronote.isConnected` (empty-state) | idem status (self) |
| Chat `hooks/chat/useStreamManager.ts` | `usePronoteStore.getState().isConnected` (gate contexte) | **données Pronote en cache non vides** (`homework`/`grades`/`timetable`) — pas d'appel réseau dans le chemin d'envoi, et plus correct que `isConnected` (n'injecte pas un contexte vide) |

Puis **supprimer** de `usePronote` + `pronote-store` : `isConnected`, `resources`, `metadata`, `resourceMappings`, `setResourceMapping`, `setResources`, `setConnected`, `connect()`, `disconnect()`. `usePronote` se réduit à la **lecture** : `grades/homework/timetable` + `fetch…(childId)` (le serveur résout le mapping) + cache TTL + erreurs. Un petit hook `usePronoteStatus(childId)` (React Query sur A2.1) sert les gates.

---

## Gestion d'erreurs (exhaustive)

- **connect/qr** : PIN 4 chiffres invalide → message ciblé ; **jeton QR expiré (~10 min)** → « QR expiré, régénérez-le et rescannez » + retour scan ; réseau/timeout → retry.
- **discover** : 0 enfant → message clair (compte connecté, aucun enfant) ; réseau → retry sans reperdre le credential.
- **activate partiel** : `failed[]` → par enfant, raison affichée (`username` pris, `already_mapped`, …) ; correction (éditer username, ou re-choisir create/link) puis **ré-activer le sous-ensemble échoué**.
- **resync** : idempotent ; affiche `added` ; 0 ajout → « à jour ».
- **retrait établissement** : confirmation (action irréversible côté lien Pronote, comptes enfants conservés).
- **multi-établissement** : credentials indépendants ; erreurs isolées par carte.
- **reset mot de passe** : min 8 + robustesse ; succès → rappeler de retransmettre à l'enfant.

---

## Navigation

- Dashboard parent : empty-state (0 enfant) → « Ajouter un enfant » (manuel) **et** « Connecter Pronote ». Avec enfants → « Gérer Pronote ».
- Profil parent : section « Pronote » → `pronote-manage` (0 credential → wizard direct).
- Routes typées dans `(parent)/_layout.tsx` : `pronote-connect`, `pronote-manage`.

---

## Tests

- **Serveur** (`bun run test` + `test:integration`) :
  - Schéma A0 : écriture `establishment_name`/`class_name` au connect/activate ; unicité `(credential_id, resource_id)` (double map rejeté).
  - `GET /children/:id/status` : mappé → `{hasPronote:true, establishmentName, className}` ; non mappé → `{false,null,null}` ; **self (élève) autorisé**, parent-of autorisé, tiers 403.
  - `hasPronote` sur `getParentChildren` : batch (pas de N+1), mappé/non, pas de fuite entre parents.
  - `GET /credentials/list` : 0/1/N, `childCount` correct, `establishmentName` depuis colonne, ownership.
  - `DELETE /credentials/:id` : supprime credential + mappings, enfants conservés (`hasPronote→false`), ownership (pas le credential d'autrui).
  - `activate` conflit : `linkToChildId` déjà mappé → `failed:[{reason:'already_mapped'}]`, mapping existant intact.
  - Non-régression `discover`/`activate` IDOR + `assertParentOrSelf` + piège mock `api-endpoints.test.ts`.
- **Mobile** (`pnpm test`) :
  - `usePronoteConnect` : happy connect→discover→activate ; activate partiel + reprise ; lien (existingChildId) ; lien manuel ; resync ; jeton expiré → scan.
  - Wizard + `pronote-manage` (list, resync, delete, reset mdp).
  - `ChildCredentialsFields` (validation partagée).
  - `usePronoteStatus` + chaque écran migré (badge, détail, home/profil/EDT élève, chat) lit le serveur, plus le local.
  - `usePronote` simplifié : tests `connect`/`resourceMappings` retirés/adaptés.
- Validation avant commit : serveur `typecheck && lint && test (+ integration)` ; mobile `typecheck && lint && test`.

---

## Hors périmètre (sous-projet 3, distinct)

- **WebView ENT** (parents sans l'app Pronote, établissements ENT-gated) + **recherche établissement géoloc** (`GET /establishments`, n'a de sens qu'avec l'ENT). Recherche doc-first dédiée, hors pawnote.
- `PUT /api/pronote/credentials` + `DELETE /api/pronote/credentials` (user-scopé) device-first : laissés en place, non touchés.

## Risques / attention

- **Frontière de types Eden** : `ChildInfo.hasPronote`, le payload `status`, `PronoteCredentialSummary` doivent être **exportés/nommables** (`apps/server/CLAUDE.md`).
- **Ordre de migration C** : remplacer les gates par le signal serveur **avant** de supprimer les symboles locaux, dans le même incrément, sinon écran cassé / typecheck rouge (typedRoutes + pre-commit).
- **className élève** : vient de `pronote_child_resources.class_name` (A0). Si null (resync ancien mapping), l'écran dégrade proprement (pas de header classe).
- **Séquencement plan** (incréments testables) : (1) schéma A0 + écritures connect/activate + unicité ; (2) read-model A2/A3 (status, hasPronote, list, delete) + tests serveur ; (3) migration read-model mobile (partie C, remplace gates + supprime local + chat) ; (4) `usePronoteConnect` + wizard ; (5) `pronote-manage` (resync, delete, reset) + `ChildCredentialsFields`.
