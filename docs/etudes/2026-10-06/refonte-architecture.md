# Refonte de l'architecture — 2026-10-06

Instantané daté, jamais mis à jour. Demandée par Victor le 2026-10-06 : revoir entièrement
l'architecture, tout supprimer et reprendre, pour une codebase de qualité production, sur des
pratiques établies plutôt qu'inventées. Elle remplace `docs/architecture.md` là où elles divergent ;
`architecture.md` est réécrit d'après elle, tranche par tranche.

## Méthode

- **Quatre audits en lecture seule** de `main` à `048676b4`, le 2026-10-06 :
  architecture du serveur ; données et sécurité ; domaine IA et évaluation ; clients, paquets,
  outillage et tests. Chaque défaut a été lu dans le code et repéré par chemin et ligne ; les
  comportements des bibliothèques ont été vérifiés dans le code installé (better-auth 1.7.5,
  postgres.js, hono 4.13.12), pas de mémoire.
- **Règle de la cible** : chaque choix renvoie à une pratique publiée (norme, documentation
  officielle, référence reconnue), citée. Ce qui n'en a pas est marqué « choix maison », avec sa
  raison, ou retiré.
- **Non vérifié** à ce jour, à vérifier dans la PR qui en dépend : le format `bun.lock` dans
  `turbo prune` ; les règles de cycle de vie par préfixe du stockage Scaleway ; la capture du
  corps de requête par `@sentry/hono` ; la portée de `moderateChat` de Mistral (dernier message
  ou conversation) ; `RateLimiterPostgres` avec postgres.js.

## Verdict

**La stack se garde** : Bun, Hono, Drizzle 0.45 (la 1.0 est en RC), better-auth, Zod, pino, Vite,
React, TanStack Router, Mistral. Aucun défaut relevé ne vient d'une brique ; tous viennent de notre
code. Cinq causes structurelles :

1. **Aucune racine de composition.** `env`, `db` et le logger sont lus à l'import
   (`platform/config/env.ts`, le Proxy de `db/connection.ts`), et 39 services sont des
   singletons. Les tests doivent donc remplacer des modules : 220 `mock.module` dans 58 fichiers,
   un lanceur maison qui isole chaque fichier (`scripts/run-tests.ts`), des mocks qui cassent
   sans erreur quand un fichier bouge.
2. **Aucun contrat d'erreur.** L'enveloppe `AppError` coexiste avec 44 corps d'erreur écrits à
   la main et 33 `success: false` ; une erreur métier non typée devient un 500 (réinitialiser la
   séance d'un autre répond 500, `chat-session.service.ts`) ; `parent.routes.ts` renvoie au
   client le message d'une erreur Postgres.
3. **Une surface HTTP faite pour l'app mobile supprimée**, que rien n'appelle : routes de séance
   qui se recouvrent, préfixes montés de trois façons, `@repo/api` sans consommateur et aux types
   réécrits à la main.
4. **Un modèle de données sans foyer ni consentement**, et des autorisations vérifiées après
   lecture plutôt que dans la requête. Trois failles en découlent (détail plus bas).
5. **Un garde-fou de fuite qui s'ouvre** dès qu'un maillon manque, un cran d'aide tenu par le
   seul prompt, et un harnais qui ne voit pas l'état du tour.

L'outillage ajoute deux risques : Renovate fusionne seul alors que le ruleset `Protect main`
n'exige ni l'e2e, ni knip, ni le build Docker, ni les contrôles de sécurité ; l'e2e du web tourne
sans l'API (`serve-web`), et `@repo/web-host` n'existe que pour lui.

## Défauts qui fondent la cible

| Défaut | Preuve | Effet |
|---|---|---|
| L'élève peut retirer à son parent le contrôle de son compte | `auth.ts` : `isActive`, `dateOfBirth` sans `input: false` ; better-auth les accepte sur `/update-user` | `isActive: false` le sort du tableau de bord et fait refuser au parent toute modification ou suppression |
| L'élève peut effacer une détresse | `distress.schema.ts` : `session_id … onDelete('cascade')`, et l'élève supprime sa séance | L'alerte au parent promise par la vision ne tient pas |
| Quotas contournés par les comptes | budget par `userId`, inscription publique sans vérification d'e-mail, enfants sans plafond | Facture Mistral ouverte |
| Contrôle de fuite fail-open | `output-check.ts` : aucune forme surveillée sans fiche, sur fiche incertaine, production rédigée ou verdict « juste » | 9 des 11 fuites du passage de fin, dès le premier message |
| Cran d'aide tenu par le prompt | `hint-ladder.ts` : contrat en texte, montée seulement sur tentative | Un exemple résolu donné à « je comprends pas » |
| Harnais aveugle | `eval/turn-parts.ts` ne garde que le texte ; analyse, fiche, cran et contrôle écrits en base mais non lus | Une fuite n'est pas explicable |
| Texte du client dans le prompt système | `firstName` reçu du corps de requête, interpolé dans `prompts/core/identity.ts` | Injection |
| Tâches perdues à l'arrêt | résumé, titre, progression lancés après le flux ; `process.exit` sans les attendre | Travail perdu à chaque déploiement |
| TLS Postgres sans vérification | `ssl: 'require'` : postgres.js pose `rejectUnauthorized = false` | Homme du milieu possible |
| Révision cassée | `fsrs.service.ts` appelle `findByUserAndId(deckId, userId)` à l'envers ; les tests mockent la base | Trois routes en 500, invisibles aux tests |

## Architecture cible

### Monorepo

- **Applications** : `apps/server`, qui sert aussi le web ; `apps/web` ; `apps/landing`, gelée
  jusqu'au lot 4 et hors de la refonte.
- **Paquets** : `tokens` (deux consommateurs, test de contraste), `ui` passé sous la CLI shadcn
  avec un `components.json` par workspace, comme l'exige sa doc pour un monorepo
  ([ui.shadcn.com/docs/monorepo](https://ui.shadcn.com/docs/monorepo)), `eslint-config`.
  **Supprimés** : `api` et `web-host`. Choix maison, par YAGNI : un paquet ne se crée qu'avec deux
  consommateurs réels.

### Serveur

- **Racine de composition** : un seul `main.ts` lit l'environnement, crée les dépendances et
  assemble l'app ; le reste du code les reçoit en paramètre et n'importe aucun état global. C'est
  la *Composition Root* de Seemann, « as close as possible to the application's entry point »
  ([blog.ploeh.dk](https://blog.ploeh.dk/2011/07/28/CompositionRoot/)). Les dépendances passent
  par des fermetures (`createChatService({ db, ai, tasks, clock })`), sans conteneur.
- **Arborescence** :
  ```
  src/
    main.ts         composition : config → infra → modules → app → Bun.serve → arrêt
    instrument.ts   OTel et Sentry, chargés par bun --preload
    config.ts       un seul schéma Zod, appelé par main.ts
    app.ts          createApp(deps) : middlewares, montage des modules, onError
    contract.ts     seul point d'entrée de build:types : AppType, codes d'erreur, types partagés
    platform/       http, db, observability, ai, storage, lifecycle
    domain/         fonctions pures sans E/S (niveaux, matières, typographie)
    modules/<m>/    index.ts, routes.ts, service.ts, repository.ts, schema.ts, errors.ts, tests
  ```
  `eval/` et `referential/` restent des outils hors du bundle.
- **Routes** : sous-apps Hono montées par `app.route()`, handlers écrits après le chemin, sans
  contrôleurs ([hono.dev/docs/guides/best-practices](https://hono.dev/docs/guides/best-practices)).
- **Règles de dépendance**, vérifiées par `eslint-plugin-boundaries` (vérifié le 2026-10-06 par
  l'audit : dépôt actif, dernier push le 2026-10-05, environ 2,2 M de téléchargements par semaine) :
  `domain` n'importe rien ; `platform` n'importe aucun module ; un module n'importe que `platform`,
  `domain` et l'`index.ts` des autres ; dans un module, routes → service → repository, et seul un
  repository touche la base.
- **Erreurs** : RFC 9457, `application/problem+json`, avec `type`, `title`, `status`, `detail` et
  des membres d'extension, que la norme permet
  ([rfc-editor.org/rfc/rfc9457](https://www.rfc-editor.org/rfc/rfc9457.html)) : `code`, union
  fermée exportée par `contract.ts`, `errors[]` pour la validation, `requestId`. Une seule classe
  d'erreur, un seul `onError`, aucun try/catch dans les routes ; le message interne ne sort jamais
  (OWASP A10:2025, CWE-209,
  [top10.owasp.org](https://top10.owasp.org/2025/A10_2025-Mishandling_of_Exceptional_Conditions)).
- **API** : redessinée à partir des parcours du web, route par route, avec la tranche qui l'appelle
  (`/api/sessions`, `/api/sessions/:id/messages`, `/api/files`…). Le corps d'un succès est la
  ressource, avec un statut explicite pour que le client typé l'infère
  ([hono.dev/docs/guides/rpc](https://hono.dev/docs/guides/rpc)).
- **Cycle de vie** : au démarrage, refus si les migrations appliquées ne sont pas celles du
  journal ; à l'arrêt, `/health/ready` en 503, `server.stop()` qui attend les requêtes en cours
  ([bun.com/docs/runtime/http/server](https://bun.com/docs/runtime/http/server)), puis le registre
  des tâches de fond, puis la base, le tout sous une échéance.
- **Logs** : pino sans surcouche ; `requestId` et `userId` ajoutés à chaque ligne par le `mixin` de
  pino ([pino, api.md](https://github.com/pinojs/pino/blob/main/docs/api.md)) et
  `hono/context-storage`. Le sérialiseur d'erreurs en liste blanche se garde.
- **État partagé** : les invariants de coût (flux concurrents, course sur le quota de la voix)
  passent en base ; le rate limit reste en mémoire tant qu'il n'y a qu'une instance, choix écrit.

### Données et autorisation

- **Le foyer au centre** : `household` porte l'abonnement ; `household_member` (gardien ou élève) ;
  `student_profile` avec le prénom ou un pseudonyme, le niveau et le mois de naissance, sans nom de
  famille. Minimisation, RGPD art. 5.1.c. Choix maison sur le découpage des tables, à faire valider.
- **Consentement** : une table `parental_consent` (périmètre, version de la notice, accord, retrait)
  et l'accusé de lecture de l'élève. La CNIL demande l'accord conjoint du parent et de l'enfant sous
  15 ans, et que l'autre parent puisse s'opposer
  ([CNIL, recommandation 4](https://www.cnil.fr/fr/recommandation-4-rechercher-le-consentement-dun-parent-pour-les-mineurs-de-moins-de-15-ans)).
- **Détresse** : rattachée à l'élève et au foyer, `ON DELETE SET NULL` sur la séance, sans score
  stocké. Un indicateur de risque sur la santé d'un mineur est une donnée de santé
  ([CNIL](https://www.cnil.fr/fr/quest-ce-ce-quune-donnee-de-sante)) : base de l'art. 9 et AIPD à
  trancher par un conseil.
- **Autorisation** : refus par défaut, vérification à chaque requête et pour chaque objet
  ([OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)) ;
  la propriété est une clause de la requête SQL, jamais une comparaison après lecture ; une seule
  fonction d'accès du gardien à l'élève, par le foyer ; une matrice de tests d'accès croisés sur une
  vraie base.
- **Durées de conservation** fixées et appliquées par une purge planifiée : messages, fichiers,
  sessions expirées, IP et user-agent. La CNIL impose de les définir selon la finalité
  ([CNIL, durées de conservation](https://www.cnil.fr/fr/les-durees-de-conservation-des-donnees)).
- **Migrations** : une nouvelle baseline issue du schéma cible (aucune base réelle à migrer) ; le
  verrou consultatif de `migrate.ts` se garde. Postgres en `verify-full`.

### Authentification

better-auth, gardé, avec : tous les champs ajoutés au `user` en `input: false` ;
`immutableUsername` ; vérification de l'e-mail et réinitialisation pour les gardiens ; comptes
élèves créés par le serveur dans une transaction ; révocation des sessions au changement de mot de
passe ; `trustedProxies` réglé et la même IP pour les deux limiteurs ; suppression du compte. Options
vérifiées dans les types installés de better-auth 1.7.5 par l'audit.

### Fichiers

Envoyés au serveur, qui vérifie la taille et la signature des octets, les écrit dans un bucket
privé sous un nom aléatoire, et les relit par une route authentifiée. Suit l'OWASP File Upload
Cheat Sheet : « The Content-Type for uploaded files is provided by the user, and as such cannot be
trusted », signature vérifiée, nom aléatoire, stockage séparé, accès par un handler applicatif
([cheatsheetseries.owasp.org](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)).
La CSP reste `'self'`, sans CORS sur le bucket ni lien de photo partageable. Remplace l'URL
présignée de `.claude/rules/server.md`. Une suppression ratée est réessayée, jamais seulement
journalisée.

### Tuteur

- **Un tour en étapes explicites** : entrée, filtre (modération et détresse), compréhension,
  ancrage (fiche), décision (diagnostic et cran, en code pur), rédaction, contrôle, validation.
  Les appels Mistral restent aux bords ; les décisions sont des fonctions testables sans modèle.
- **Contrôle de fuite fail-closed** : l'incertitude restreint l'aide, elle n'ouvre jamais le
  contrôle (fiche absente ou incertaine : cran 1 au plus, union des formes de tous les tirages).
  OWASP A10:2025 nomme cette conduite « failing closed ».
- **Enregistrement de tour** : analyse, fiche, cran, diagnostic, versions de prompt, modèle,
  constats du contrôle, issue et usage, écrits à chaque tour, sans contenu d'élève en production.
  C'est une trace au sens de Langfuse, « every operation… along with timing, inputs, outputs, and
  metadata » ([langfuse.com/docs/observability](https://langfuse.com/docs/observability/overview)).
- **Prompts** : des modules purs ; chaque tour enregistre la version des prompts utilisés, pour
  comparer les mesures d'une version à l'autre, ce que Langfuse décrit comme « tracking of metrics
  and evaluations per prompt version »
  ([langfuse.com](https://langfuse.com/docs/prompt-management/features/link-to-traces)). La
  version est une empreinte du texte rendu : choix maison, déjà en place pour le juge
  (`eval/judge-version.ts`). Pas de gestion de prompts dans Langfuse : elle permet de changer un
  prompt « without code deployments », donc sans passer l'éval.
- **Aucun texte du client dans le prompt système**, et toute entrée délimitée ; la lecture
  vocale lit un message stocké et contrôlé, par son id.

### Évaluation

Le moteur se garde (fuite par code, vérificateurs, α, empreinte du juge, cas construits). Il passe
par la route HTTP et lit en plus l'enregistrement de tour de son compte de test. La statistique et
la validation du juge suivent `refonte-evaluation.md` (Wilson, plusieurs passes, McNemar, juge
vérifié contre Victor). La télémétrie enregistre entrées et sorties en éval seulement (options
`TelemetryOptions` de l'AI SDK, données synthétiques).

### Web, tests et livraison

- **Le serveur sert le web** sur l'origine de l'API : décision gardée. Le cache `immutable`, le
  fallback réservé aux navigations et la CSP reviennent dans `platform/http`, avec leurs tests.
- **Client typé** : `hcWithType` exposé par `tomai-server/client`, `parseResponse` et
  `DetailedError` de `hono/client`, `ApplyGlobalResponse` pour typer les erreurs
  ([hono.dev/docs/guides/rpc](https://hono.dev/docs/guides/rpc)). Plus de couche maison.
- **Tests** : des tests unitaires purs pour le code pur ; pour le reste, l'app construite par sa
  fabrique, appelée par `testClient` ([hono.dev/docs/helpers/testing](https://hono.dev/docs/helpers/testing)),
  sur un vrai Postgres, avec une base par fichier copiée d'un modèle migré
  (`CREATE DATABASE … TEMPLATE`,
  [postgresql.org](https://www.postgresql.org/docs/current/manage-ag-templatedbs.html)) et un faux
  Mistral en HTTP. Zéro `mock.module`, `bun test` simple, plus de lanceur maison.
- **e2e du web** contre le serveur construit, un Postgres et le faux Mistral, lancés par les
  `webServer` multiples de Playwright ([playwright.dev](https://playwright.dev/docs/test-webserver)) ;
  traces et rapport conservés en CI.
- **CI** : un pipeline, des jobs parallèles et un job agrégé `ci-ok`, seul check requis avec les
  contrôles de sécurité ([docs.github.com, `needs` et `always()`](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-jobs)).
  L'image se construit une fois, se lance contre Postgres, et se publie au SHA.
- **Image** : dépendances de production seules, sans lint ni typecheck dans l'image, élaguée par
  `turbo prune --docker` ([turborepo.dev](https://turborepo.dev/docs/reference/prune)), sous
  réserve du format `bun.lock`.
- **Scripts** : `doctor` disparaît ; `docker compose up --wait` et la vérification des migrations
  au démarrage font son travail.

## Ce qui se porte

Le code se réécrit ; ce savoir passe dans la nouvelle arborescence, relu, jamais copié en bloc :

- **Données** : les 32 exercices vérifiés, les scénarios, les cas construits et l'échantillon
  d'accord (`eval/`) ; le référentiel (`referential/texts/*.json`, 1 172 entrées, SHA-256) ; les
  transcriptions des passages du 2026-10-03 et du 2026-10-06 (`etudes/*/donnees/`), baselines de
  non-régression.
- **Tuteur** : la réponse de détresse validée par Victor et ses deux corpus de phrases
  (`distress.ts`, `tests/distress.test.ts`) ; les cinq crans et leurs lignes de diagnostic
  (`hint-ladder.ts`) ; le schéma et le vote de la fiche avec les correctifs de #415 ; le
  diagnostic arbitré par mathjs ; `lib/leak.ts` et `lib/written-equalities.ts` ; les règles
  pédagogiques (`csen-principles.ts`) et de sécurité (`safety.ts`, règles 1 à 6) ; l'ordre du
  prompt et le rejeu du raisonnement imposés par Mistral (`chat-message-assembler.ts`).
- **Plateforme** : le sérialiseur d'erreurs en liste blanche et le nettoyage Sentry ; les règles
  de l'env (endpoint Mistral UE en production, modèles épinglés sans `-latest`) ; les retries et
  délais Mistral mesurés pendant l'incident du 2026-10-05 ; les coûts datés (`cost.ts`) ; la
  validation qui refuse un JSON sans Content-Type ; le rate limit fail-closed ; le verrou des
  migrations ; `role` et `schoolLevel` en `input: false` et l'absence de `cookieCache`, prouvés
  par test.
- **Pièges vérifiés** : `bun build` fige `process.env`, d'où `Bun.env` ; `idleTimeout: 30` pour ne
  pas couper un flux ; `requestId` toujours généré par le serveur ; un `use()` sur un sous-routeur
  s'applique à tout son préfixe.
- **Outillage** : ESLint `strictTypeChecked` sans désactivation en ligne ; TypeScript strict avec
  `exactOptionalPropertyTypes` et `noUncheckedIndexedAccess` ; actions épinglées au SHA, gitleaks,
  Semgrep, `bun audit --prod` ; âge minimal des versions (Bun, Renovate) ; navigateurs Playwright
  installés plutôt que mis en cache.

## Ce qui disparaît

`packages/api`, `packages/web-host` et `serve-web` ; les routes de séance et d'abonnement du
mobile, la table `family_billing` et les colonnes RevenueCat ; `conversation-optimizer.ts` et
`token-budget.service.ts` ; `routes/api/`, `lib/`, `shared/` et `types/`, dont le contenu rejoint
`domain/` ou son module ; les tests de prompt en `toContain` ; `api-endpoints.test.ts`, qui mocke
Drizzle ; `scripts/run-tests.ts` ; `scripts/doctor*` ; les migrations 0000 à 0003.

## Méthode de refonte : supprimer, puis reconstruire

- **Rien ne consomme le serveur** : aucun utilisateur, et le web n'appelle pas l'API. On ne fait
  donc jamais cohabiter l'ancien et le nouveau, et aucun code de transition ne s'écrit.
- **La première PR supprime l'ancien serveur**, sauf les actifs ci-dessus, qu'elle range à leur
  place définitive. Les tranches suivantes reprennent le reste depuis l'historique (`048676b4`).
  À chaque merge, une seule version de chaque chose et aucun fichier sans usage.
- **Garde-fous** : knip strict et `eslint-plugin-boundaries` dans `ci-ok`, requis ; la revue de
  fin de branche vérifie que chaque PR supprime ce qu'elle remplace et réécrit la doc qui en
  parle.
- **La limite** : pendant la refonte, `main` a un serveur incomplet, et le harnais est en pause
  jusqu'au retour du tuteur.

## Ordre des PR

1. Renovate sans fusion automatique tant que `ci-ok` n'est pas requis.
2. Suppression de l'ancien serveur et socle : config, base, erreurs, observabilité, cycle de vie,
   service du web et CSP, santé, infrastructure de test (base par fichier, faux Mistral).
3. CI en un pipeline avec `ci-ok`, e2e du web contre le vrai serveur, image réécrite et publiée.
4. Foyer et comptes : gardien, élève créé par le gardien, matrice d'accès.
5. Le tuteur porté : le tour en étapes, le contrôle fail-closed, l'enregistrement de tour, les
   séances et messages, le quota par foyer.
6. Le harnais reconstruit, mesuré contre les baselines du 2026-10-06, puis la fermeture des
   fuites restantes.
7. Le chat et la connexion dans le web.
8. La préproduction UE : étude des hébergeurs, puis compte ouvert par Victor.

Viennent ensuite, dans l'ordre du lot 3 : consentement et mention IA, photo et voix, parcours
parent, paiement. La porte avant ouverture et le lot 4 sont inchangés.

## Décisions de Victor

1. **Fermer #415** sans la merger : le code vise l'ancien tuteur ; son diagnostic et ses
   correctifs se portent à l'étape 5.
2. **Le foyer** et la minimisation de l'élève : prénom ou pseudonyme, mois de naissance, pas de
   nom de famille.
3. **Les fichiers par le serveur** plutôt que par une URL présignée.
4. **Le cran d'aide** : un élève bloqué sans tentative (deux « je sais pas ») monte d'un cran ; la
   pression seule ne fait jamais monter.
5. **Le mode prudent** sur une fiche incertaine : plus de régénérations, à mesurer.
6. **La vérification de l'e-mail des gardiens**, qui demande un fournisseur d'e-mail UE, choisi
   avec l'étape 4.
7. **Pas de score de détresse stocké**, et l'art. 9 avec l'AIPD confiés à un conseil, avant
   l'ouverture.
