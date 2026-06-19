# Pronote — Incrément 1, partie 2 (B2) : onboarding serveur + refactor mobile

**Référence de conception** : `docs/superpowers/specs/2026-06-15-pronote-server-side-design.md` (source unique de vérité).

**Principe** : Pronote est **optionnel / non bloquant**. Le cœur (RAG curriculum + chat + vocal) tourne sans. B2 branche l'amplificateur Pronote, **parent-only**, **jeton server-side**.

---

## État à l'entrée de B2 (déjà livré sur `feat/pronote-server-provider`, poussée)

- Socle lecture server-side (`PronoteProvider` + `PawnoteServerAdapter` token-based, cache session, endpoints `/api/pronote/children/:id/{grades,homework,timetable}`) — prouvé e2e sur le démo.
- Incrément 1 partie 1 — modèle : multi-jeton `(user, établissement)` (`pronote_credentials`), jonction `parent_child` N-N, mapping resource par `credential_id` (`pronote_child_resources`), resync (clé naturelle), migration `parentId` → jonction, migration prod `0023`. 59/59 unit + intégration verte, 2 revues opus.

**Surface serveur réutilisable** : `pronoteSyncService` (`upsertCredentials`/`getCredentials`/`getCredentialById`/`updateTokenById`), `pronoteDataService` (résolution par `credentialId`), `parentChildRepository`, `parent.service.createChild`, `pronoteChildResourcesRepository`, `pawnoteServerAdapter`.

---

## Invariants techniques (vérifiés doc-first 2026-06-18 — pawnote 1.6.2 + Papillon)

- **pawnote hors du bundle mobile** (GPL-3.0-or-later). Le mobile scanne le QR (caméra + `JSON.parse` de `{url, login, jeton}`) et POST au serveur — **aucun import pawnote côté mobile**. Repli permissif si besoin : `pronotepy` (MIT) en microservice Python.
- **Le serveur génère et impose le `deviceUUID`** au `connect/qr` (option B). Le jeton n'est valable que pour ce `deviceUUID` ; persisté avec le credential ; réutilisé pour tous les `loginToken`. → multi-device natif.
- **QR éphémère ~10 min** : le payload doit arriver et être consommé dans la fenêtre.
- **Rotation atomique du jeton** : `loginToken` consomme l'ancien jeton et en renvoie un nouveau → **sérialiser les refresh concurrents par `credentialId`** (verrou) + persister-avant-cache. Sinon double consommation = déconnexion.
- **PIN** = clé de déchiffrement AES (MD5) du QR, côté serveur uniquement ; jamais transmis à Pronote ni loggé.

---

## Stratégie de test e2e (la connexion Pronote, bout en bout)

La connexion prod = **capture mobile → push serveur → `loginToken` serveur**. La capture (QR/WebView) est de l'UI ; le reste est serveur et **testable sans front** :

| Niveau | Quoi | Comment | Quand |
|---|---|---|---|
| **A. Découverte / activation / lectures** | discover → activate → grades/homework/timetable | **compte démo** (`loginCredentials` marche) prime un credential, puis on exerce les vraies routes sur données réelles | **B2-backend, maintenant** (CI, sans interaction) |
| **B. Capture + token rotatif** | `loginQrCode → loginToken` (le vrai canal prod) | **`POST /api/pronote/connect/qr`** alimenté par un **vrai payload QR** (généré depuis l'app Pronote du parent) — test d'intégration gated `PRONOTE_TEST_QR` | dès qu'un payload QR réel est fourni — **indépendant du front** |
| **C. WebView (auth ENT interactive)** | capture du jeton dans l'app | vérification **manuelle** sur device | au front, fast-follow |

`loginCredentials` reste **test-only** (démo). Les vrais comptes ENT (ex. Marseilleveyre) ne peuvent pas l'utiliser → retirer ces vars de `.env` pour que le test real-account re-skip.

---

## B2-backend (indépendant du mobile)

Chaque tâche : test d'abord (Bun runner `bun run test`), implémentation, revue, commit. Mappings pawnote **confirmés contre les types installés + usage mobile** — jamais inventés.

- **T1 — Géoloc établissement.** `pawnoteServerAdapter.searchEstablishments(lat, lng)` via `pawnote.geolocation` → `{ name, url }[]` normalisé. Route `GET /api/pronote/establishments?lat&lng` (guard auth). Test unit : mock pawnote, mapping. Sert à pré-remplir l'instance avant capture.
- **T2 — Capture QR server-side.** `pawnoteServerAdapter.connectWithQrPayload({ qr, pin })` — **le serveur génère le `deviceUUID`** (option B) — via `pawnote.loginQrCode` → session + metadata (`instanceUrl`, `username`, `kind`, `deviceUuid` serveur, `resources`). Service `pronoteConnectService.connectQr(userId, payload)` → `upsertCredentials` (jeton + `deviceUuid` chiffrés, `establishmentUrl` normalisée) → renvoie `credentialId` + enfants découverts. Route `POST /api/pronote/connect/qr` (guard auth ; **fenêtre QR ~10 min** ; ne logge jamais jeton/identifiants/PIN, seulement compteurs/host/kind). **Dérisque le token rotatif** (`loginQrCode → loginToken`).
- **T3 — Découverte des enfants.** `pronoteConnectService.discover(credentialId)` : connect (cache) → `handle.user.resources` → liste `{ resourceId, name, className, establishmentName }`. Aucune écriture. Route `GET /api/pronote/credentials/:id/children`.
- **T4 — Activation.** `pronoteConnectService.activate(parentUserId, credentialId, selections[])` : pour chaque enfant choisi → **fusion-confirmation** (si un enfant existe déjà par nom+classe+établissement → lier au credential existant via `parent_child` + mapping resource, sinon `createChild` puis mapping). Écrit `pronote_child_resources` `(parent, credential, child, resourceId)`. Transaction + compensation. Route `POST /api/pronote/credentials/:id/activate`.
- **T5 — Resync (US-12).** `pronoteConnectService.resync(credentialId)` : re-découvre les resources, réconcilie par clé naturelle (enfant ajouté/retiré côté Pronote, parent séparé qui rejoint un enfant déjà présent). Idempotent. Route `POST /api/pronote/credentials/:id/resync`.
- **T6 — Eden + build types.** Rebuild `@repo/api`, typecheck monorepo, mock des nouvelles routes dans `api-endpoints.test.ts` (piège connu : toute route tirant les schémas Drizzle doit être mockée).
- **T7 — e2e démo (zéro mock sur le chemin données).** Intégration : `loginCredentials(démo)` prime un credential → `discover` → `activate` → lecture `grades`. Prouve la chaîne complète sur données réelles. Gated `PRONOTE_TEST_QR` à part pour le niveau B.

**Validation finale** : `cd apps/server && bun run typecheck && bun run lint && bun run test` + `bun run test:integration` + `pnpm typecheck && pnpm lint` (monorepo).

---

## B2-front mobile (chantier suivant — refactor ciblé, ~3-4 j)

Audit 2026-06-18 : app **saine 8,5/10**, **~87 % gardé**. Plan d'exécution détaillé à écrire (writing-plans) au démarrage de ce chantier. Périmètre chiffré :

- **Couche données** (~400 LOC, 2 fichiers) : réécrire `pronote-session.ts` + `usePronote.ts` pour consommer l'API Tom (`getTreaty()`, modèle `useLearning.ts`) au lieu de pawnote local. **Interface de `usePronote` préservée → 0 écran consommateur cassé.** Store inchangé (source change).
- **Capture** : l'écran QR existant transmet le payload `{qr, pin}` à `POST /api/pronote/connect/qr` (plus de `loginQrCode` local).
- **GPL** : retrait de `pawnote` du bundle.
- **Pivot parent-only** : jeter espace élève autonome + `child-access-store` (~1 386 LOC) ; unifier les vues Pronote dupliquées student/parent (~1 100 LOC) en composant `readOnly`.
- **Dette à combler** : tests d'écran (absents), Maestro e2e (select-child → dashboard → impersonation).

---

## Hors scope B2

Compte élève autonome, espace enseignant (pas de roster pawnote), WebView ENT (fast-follow UX), EcoleDirecte, Docaposte, front web agrégateur.
