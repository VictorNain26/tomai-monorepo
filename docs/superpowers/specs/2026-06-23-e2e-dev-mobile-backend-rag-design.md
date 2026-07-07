# Tester l'app de bout en bout en dev — mobile ↔ backend ↔ RAG

> **STATUT (2026-07-07) : LIVRÉ** via le plan jumeau (PR #253). Photo de design
> datée : les références à `apps/web` sont caduques (supprimée le 2026-07-06).

**Date** : 2026-06-23
**Statut** : design validé, prêt pour plan d'implémentation
**Scope** : permettre à n'importe quel dev de lancer le stack complet en local et de tester le parcours réel de l'app mobile contre backend + RAG réels — à la main et via une suite e2e automatisée.

## Objectif

Aujourd'hui le socle dev est bon (`pnpm dev` lève Docker postgres+qdrant+ai-service puis server+web+landing ; `pnpm setup` bootstrap ; `pnpm doctor` fait un roundtrip RAG). Mais **le mobile est hors boucle** : il tourne à part, pointe `localhost:3000` en dur, et un device physique ne joint donc jamais le backend. Il n'existe ni seed de comptes, ni parcours e2e contre un backend local réel.

Cible : un dev clone, lance le stack, lance le mobile sur **son** téléphone, et teste le vrai parcours (login → chat avec RAG → learning → onboarding). Puis une suite Maestro rejoue ce parcours automatiquement contre le backend local.

## Principe directeur — portabilité

**Aucun code spécifique à un OS.** Tous les devs ne sont pas sous le même environnement (macOS, Linux natif, Windows natif, WSL). La solution vit dans le repo et doit marcher partout, sans branche `if (wsl)`. Les particularités d'un poste (ex. réseau WSL en mode NAT) se règlent **côté poste** et relèvent de la doc/troubleshooting, jamais de l'architecture.

Le levier qui rend ça portable : **le device dérive l'URL du backend au runtime, depuis l'IP par laquelle il a déjà joint Metro** (`Constants.expoConfig.hostUri`). Pas d'IP en dur, pas de `.env` à éditer par dev.

Sources doc-first :
- Expo `Constants.expoConfig.hostUri` contient `LAN_IP:8081` en dev — [docs.expo.dev/versions/latest/sdk/constants](https://docs.expo.dev/versions/latest/sdk/constants/).
- Better Auth Expo override d'Origin (`@better-auth/expo`) — vérifié dans `node_modules` + `apps/server/src/lib/auth.ts:196`.

## Principe directeur — preuve réelle, zéro faux positif

**Un signal vert ne vaut que si le vrai chemin s'est réellement exécuté et a été observé.** Trois interdits, sans exception, dans tout ce que ce chantier ajoute :

1. **Pas de réponse mockée qui simule un système qui marche.** En dev/e2e, le chat appelle réellement Mistral, le RAG interroge réellement Qdrant Cloud + ai-service. On ne renvoie jamais une réponse fabriquée qui ferait croire que le pipeline a tourné.
2. **Pas de fallback silencieux qui masque une dépendance manquante.** Si une dépendance du parcours e2e (Mistral, Qdrant, ai-service, DB) est absente ou répond mal, le test/diagnostic **échoue bruyamment** (exit code ≠ 0, message explicite). La résilience prod (répondre même si Qdrant tombe) reste légitime *en prod* mais ne doit **jamais** faire passer un test e2e au vert.
3. **Pas de faux positif.** Un check `pnpm doctor` ou un flow Maestro vert ⇒ le vrai chemin a été parcouru et asserté sur la vraie réponse. Conséquences concrètes :
   - En mode e2e strict, un `SKIP` ou un statut serveur `degraded` (ex. `MISTRAL_API_KEY` absent) compte comme **échec**, pas comme succès.
   - Le seed **garantit** l'état attendu (et vérifie qu'un login réel passe) au lieu de skipper si le compte « existe déjà ».
   - Tout stub résiduel (Pronote) est **étiqueté** comme ne validant pas l'intégration réelle, et doublé d'un vrai test d'intégration séparé — pas de trou non testé caché derrière un test vert.

Ce principe prime sur la commodité : mieux vaut un e2e qui refuse de tourner sans creds réels qu'un e2e qui passe en trompe-l'œil.

## État actuel (références file:line)

| Sujet | Fichier | Constat |
|---|---|---|
| URL API mobile | `apps/mobile/src/lib/api.ts:17` | `EXPO_PUBLIC_API_URL \|\| 'http://localhost:3000'` (casse sur device) |
| URL auth mobile | `apps/mobile/src/lib/auth.ts:20` | même défaut `localhost:3000` |
| Bind serveur | `apps/server/src/index.ts:29` | `hostname: '0.0.0.0'` ✅ |
| Auth / trustedOrigins | `apps/server/src/lib/auth.ts:88,109,110`, `config/env.ts:229` | `tomia://` + `exp://` (dev), `sameSite lax`, `secure=isProduction()` ✅ |
| CORS | `apps/server/src/app.ts:47` | whitelist `getCorsOrigins()` ; mobile natif sans `Origin` non bloqué |
| Seed | — | **inexistant** |
| Seam e2e | `apps/mobile/src/hooks/usePronoteConnect.ts`, `services/pronote/pronote-e2e-stubs.ts`, `eas.json:42` | `EXPO_PUBLIC_E2E=1` (preview) stub **uniquement** Pronote |
| Flows Maestro | `apps/mobile/e2e/*.yaml` | auth/chat/learning déjà réels ; attendent comptes `E2E_*` |

## Architecture — deux phases

### Phase 1 — Socle (dev manuel e2e)

#### A. Résolution automatique de l'URL backend (mobile)

Nouveau helper `apps/mobile/src/lib/api-url.ts` exportant `resolveApiUrl()`, source unique consommée par `api.ts` **et** `auth.ts` :

1. Si `process.env.EXPO_PUBLIC_API_URL` défini → l'utiliser (override explicite : tunnel, staging, prod).
2. Sinon, en `__DEV__` → dériver de `Constants.expoConfig?.hostUri` : `host = hostUri.split(':')[0]` ; retourner `http://${host}:3000`.
3. Sinon (`__DEV__` sans hostUri) → `http://localhost:3000`.
4. Sinon (prod) → `https://api.tomia.fr`.

Conséquence, sans aucune config par dev :
- device physique → `http://192.168.x.x:3000` ✅
- émulateur Android → `http://10.0.2.2:3000` ✅
- simulateur iOS → `http://localhost:3000` ✅

Le port backend (`3000`) est une constante partagée. `api.ts:17` et `auth.ts:20` perdent leur `localhost` codé en dur.

L'URL résolue est **loggée au boot** (le fallback `localhost` n'est jamais silencieux) : sur un device, tomber sur `localhost` signale immédiatement que `hostUri` n'a pas fourni d'IP joignable, au lieu d'un échec réseau opaque plus loin.

#### B. Backend joignable — vérification, ajustement minimal

- Bind `0.0.0.0` : déjà OK.
- **Auth : aucun changement.** Documenté ici pour éviter une « correction » à tort : le plugin expo réécrit l'`Origin` en `tomia://`, déjà dans `trustedOrigins` ; cookies `lax`/non-secure en dev. Le device par IP passe.
- **CORS : aucun changement par défaut.** Le mobile natif n'émet pas d'`Origin` → non filtré. (Autoriser dynamiquement les plages LAN privées en dev pour le *web* par IP est noté en fast-follow, hors scope.)

#### C. Seed déterministe — `pnpm seed`

Nouveau `apps/server/src/scripts/seed-dev.ts`, exposé `bun run seed` (server) + `pnpm seed` (racine).

Crée de façon **idempotente** (upsert par email/username) :
- 1 **parent** : email + mot de passe connus.
- 1 **élève** lié, **login autonome** : username + mot de passe connus, `role student`, `schoolLevel troisieme`.
- Données minimales pour itérer : 1 deck d'exemple (learning). Rien de plus (YAGNI).

Voie (éprouvée) : `auth.api.signUpEmail` (hash PBKDF2 géré par Better Auth) → `usersRepository.update` (champs métier) → `parentChildRepository.link`.

Idempotence qui **garantit l'état** (pas un skip masquant) : si le compte existe, réaligner mot de passe + champs métier au lieu de passer outre — sinon un compte dans un état faux ferait échouer le login e2e mystérieusement. En fin de seed, le script **vérifie** que parent et élève se loggent réellement (`auth.api.signInEmail` / `signInUsername`) et **échoue** sinon. Un seed qui ne prouve pas le login est un faux positif.

Garde-fous :
- **Refuse de tourner si `NODE_ENV=production`.**
- Credentials lus depuis env avec défauts dev explicites (`SEED_PARENT_EMAIL`, `SEED_PARENT_PASSWORD`, `SEED_CHILD_USERNAME`, `SEED_CHILD_PASSWORD`) — pas de secret « réel », juste des valeurs dev.
- **Mêmes valeurs que les variables `E2E_*`** attendues par Maestro → un seul jeu de comptes sert le test manuel et l'e2e automatisé.

#### D. Env clair et cohérent

- `apps/server/.env.example` : `AI_SERVICE_URL=http://localhost:8001` (host, **pas** `ai-service:8000` qui est l'adresse intra-Docker), bloc `QDRANT_*` Cloud + `QDRANT_ENABLED=true` commenté, bloc `SEED_*`.
- `apps/mobile/.env.example` : documenter `EXPO_PUBLIC_API_URL` comme **optionnel** — laissé vide active l'auto-résolution ; à renseigner seulement pour tunnel/staging.
- Aucun nouveau secret ; uniquement de la clarté.

#### E. Diagnostic et doc

- **Mode e2e strict** du doctor (`pnpm doctor --e2e` ou équivalent) : `SKIP` et `degraded` deviennent des **échecs**. Il exige et **prouve par un vrai roundtrip** que chaque maillon du parcours répond : postgres, ai-service (`/health` avec modèles chargés), Qdrant Cloud (search réel), Mistral (le serveur ne doit pas être `degraded`), embed→Qdrant→rerank de bout en bout. Exit code ≠ 0 au moindre maillon absent. C'est la porte d'entrée de `pnpm e2e:local`.
- `pnpm doctor` standard (non strict) garde son comportement actuel pour l'itération quotidienne, mais affiche en plus l'IP LAN détectée et l'URL backend que le device utilisera. (Un check « le device joint l'API » est impossible sans device branché ; on se borne à informer.)
- Doc dev : section « Tester sur device physique » — paragraphe portable + une ligne troubleshooting (pare-feu du poste ; sous WSL, activer `networkingMode=mirrored`). Hors archi.

### Phase 2 — E2E automatisé réel (local)

#### F. Matrice réel / stub (clarifiée, pas de régression)

| Domaine | E2E local | Justification |
|---|---|---|
| Auth (parent + élève) | **réel** | déjà le cas |
| Chat (SSE + RAG + Mistral) | **réel** | déjà le cas |
| Learning (decks) | **réel** | déjà le cas |
| Pronote QR / discovery / activation | **stub, explicitement étiqueté** | dépend d'un vrai ENT/collège, non déterministe |

Le seed (pièce C) fournit les comptes `E2E_*` → les flows Maestro existants tournent **tels quels** contre le backend local.

**Anti-faux-positif sur Pronote.** Le flow Maestro stubbé valide l'UI d'onboarding, **pas** l'intégration Pronote réelle — et ça doit être visible : le flow est nommé/commenté sans ambiguïté (« onboarding UI, Pronote stubbé »), et il n'autorise aucune conclusion sur la connectivité Pronote. Pour fermer le trou, on ajoute un **vrai** test d'intégration serveur séparé : pawnote contre un serveur de démo Index Education réel (les démos publiques `*.index-education.net`), qui exécute réellement `loginQrCode` / lecture de notes. Il skippe proprement **et bruyamment** (log explicite « Pronote demo unreachable — integration NOT verified ») si la démo est injoignable — jamais un vert trompeur. Faisabilité du serveur de démo à confirmer en début de Phase 2 (doc-first pawnote) ; si infaisable, le trou est documenté noir sur blanc plutôt que masqué.

#### G. Orchestration e2e locale — `pnpm e2e:local`

Script qui enchaîne : (1) vérifie stack up (`pnpm doctor`), (2) `pnpm seed`, (3) app lancée via **Metro local** (l'auto-résolution de la pièce A fait pointer l'app sur le backend local — pas besoin d'un build EAS dédié), (4) `maestro test apps/mobile/e2e/`, (5) rapport. Tear-down laissé au dev (stack persiste).

Extension CI (e2e contre backend éphémère) : **fast-follow**, hors scope immédiat — le Maestro preview Android sur PR reste le signal actuel.

## Découpage des unités (isolation)

- `resolveApiUrl()` — pure, testable seule (entrée : env + `hostUri` mockés ; sortie : URL). Aucun consommateur ne lit `hostUri` directement ailleurs.
- `seed-dev.ts` — script autonome, idempotent, n'expose pas d'API runtime ; réutilise repositories + `auth.api`.
- Orchestration `e2e:local` — script shell/node, ne contient pas de logique métier.

## Risques et mitigations

| Risque | Mitigation |
|---|---|
| Sous WSL en NAT, `hostUri` peut renvoyer l'IP NAT (172.x) au lieu du LAN | Réglage **côté poste** (mirrored). Expo détecte déjà l'IP LAN nativement sur macOS/Linux/Windows. **Pas de detection custom** (resterait OS-spécifique). |
| RAG Cloud sans creds | **Pas de mode dégradé en e2e.** Le doctor strict échoue (exit ≠ 0) et `pnpm e2e:local` refuse de démarrer. Les creds réels sont une précondition assumée, pas un détail contournable. |
| Seed lancé en prod | Garde-fou `NODE_ENV=production` → refus. |
| `seed-dev.ts` importé par la chaîne `app.ts`/`server-lifecycle.ts` casse `api-endpoints.test.ts` (mock Drizzle partiel) | Script **isolé**, jamais importé par l'app runtime. Voir piège dans `.claude/rules/testing-and-commits.md`. |
| **Pronote — loginToken et loginQrCode non couverts en e2e automatisé** | La connectivité Pronote réelle est couverte en deux couches : (1) `pronote-demo.integration.test.ts` (opt-in `PRONOTE_DEMO_E2E=1`) prouve `geolocation()` (unauthenticated, Index Education directory API) + `loginCredentials()` + lecture de notes contre le serveur de démo public (`demo.index-education.net`, `demonstration/pronotevs`) — sans base de données, ne peut jamais être silencieusement vert. (2) `pronote-real-account.integration.test.ts` (opt-in `PRONOTE_TEST_*`) prouve le cycle loginToken avec un vrai compte. **Gap résiduel documenté** : `loginQrCode` ne peut pas être prouvé en automatisé — il exige un QR scanné depuis un device mobile réel. Ce chemin est **vérifié manuellement avec un vrai compte lors de chaque release**. Le flow Maestro onboarding Pronote est UI-only (stubbé) et n'autorise aucune conclusion sur la connectivité Pronote réelle. |

## Tests

- **Unit (jest mobile)** : `resolveApiUrl()` — override env, device LAN, émulateur 10.0.2.2, fallback localhost, prod.
- **Integration (bun server)** : `seed-dev` crée un parent + un élève login-able (réutilise le pattern de `username-login.integration.test.ts`) ; idempotence (2ᵉ run ne duplique pas).
- **E2E (Maestro)** : flows existants verts contre backend local seedé.

## Hors scope (YAGNI)

- Qdrant local seedé (on utilise Cloud, source de vérité unique).
- CI e2e contre backend éphémère (fast-follow).
- Émulateur Android sous WSL (cas tordu ; device physique privilégié).
- Tunnel par défaut (l'override `EXPO_PUBLIC_API_URL` reste dispo si besoin).
- Autorisation CORS dynamique des plages LAN pour le web dev par IP (fast-follow).

## Critères de succès

1. Un dev sur n'importe quel OS lance `pnpm dev` + `pnpm dev:mobile`, ouvre l'app sur son téléphone, se logge avec les comptes seedés, et obtient une réponse de chat **réellement** enrichie par le RAG (vrai appel Qdrant + Mistral, observable) — **sans éditer d'IP**.
2. `pnpm seed` est idempotent, garantit l'état, et **prouve** que parent + élève se loggent réellement (échoue sinon).
3. `pnpm e2e:local` rejoue les flows Maestro contre le backend local seedé, au vert — et **refuse de démarrer** (exit ≠ 0) si une dépendance réelle du parcours manque, plutôt que de passer en trompe-l'œil.
4. Aucune ligne de code OS-spécifique introduite.
5. **Zéro faux positif** : chaque signal vert correspond à un vrai chemin parcouru ; chaque stub résiduel est étiqueté et doublé d'un vrai test ou d'un trou documenté.
