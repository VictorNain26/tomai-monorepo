# Suivi des travaux

Source de vérité de l'avancement. **À lire en premier en reprenant le travail**, et à
mettre à jour dans la PR qui le fait avancer (PR ouverte ou mergée, étape manuelle faite,
bloquant levé).

- Vision : `vision.md` (pour qui, promesse, preuves, prix).
- Roadmap : `roadmap.md`.
- Specs techniques : `architecture.md`, `agent.md`.
- Études du 2026-10-01 : `etudes/`. Ce sont des instantanés datés, jamais mis à jour.

## Où on en est

- **Dernière mise à jour :** 2026-10-01.
- **Lot en cours :** 0 — Assainissement, dernière ligne droite. Pronote et la liste
  d'attente sont sortis du code (#341). Restent deux PR, dans cet ordre (`roadmap.md`,
  « Découpage en PR »), dont le plan s'écrit au démarrage, contre `main` à jour :
  - **E2 — infra serveur et outillage** (détail dans « Reporté ») ;
  - **lint strict** : plus aucun `eslint-disable` (détail dans « Reporté »).
- **Prochaine action :** E2, sur une branche courte dont le plan s'écrit d'abord dans
  `docs/plans/` (`.claude/rules/plans-and-agents.md`).
- **PR ouvertes :** aucune.
- **Landing en ligne gelée** jusqu'au lot 4 : seuls des correctifs d'honnêteté ou techniques y entrent.
  L'identité visuelle est rejetée et se refait au lot 4.

## Reporté

Constats hors du périmètre de la PR qui les a trouvés. Chacun nomme son lot ; quand le
plan de la PR s'écrit, le point y devient une tâche ou est explicitement renvoyé
(`.claude/rules/plans-and-agents.md`). Chemins relatifs à `apps/server/src/` sauf mention
contraire.

### Lot 0 — E2, infra serveur et outillage

Constats vérifiés sur `main` le 2026-09-22 et le 2026-09-23.

- **Logger** : `lib/observability.ts` sérialise par `JSON.stringify` (une `Error` devient
  `{}`, un BigInt ou une référence circulaire fait lever l'appel de log) et ignore
  `LOG_LEVEL`, validée par `config/env.ts` mais lue nulle part. À remplacer par pino, même
  signature d'appel, puis codemod du motif
  `_error: x instanceof Error ? x.message : String(x)` (116 sites dans 49 fichiers le
  2026-09-23), qui perd la stack.
- **Code mort** : `services/memory-cache.service.ts` (son `healthCheck()` répond toujours
  `healthy`, `/health` est son seul consommateur ; `setInterval` dès l'import) ;
  `middleware/memory-monitor.middleware.ts` (ne fait que `global.gc()` et des logs, branché
  dans `initializeServices` et dans l'étape `stopMonitoring` de `createGracefulShutdown`) ;
  `db/pool-limiter.ts` et `p-limit` (postgres-js met déjà en file au-delà de `max` ; seul
  consommateur `services/parent/parent-dashboard.service.ts`).
- **Validation** : une seule validation TypeBox par route parent ; `schemas/validation.ts`
  (double validation Zod de `routes/api/parent.routes.ts`) et son test disparaissent.
  Depuis D, une erreur de validation répond 400
  `{ error: { code: 'VALIDATION_ERROR', message }, requestId }`, pas 422.
- **Variables mortes** de `config/env.ts` : `RATE_LIMIT_WINDOW_MS`,
  `RATE_LIMIT_MAX_REQUESTS_API`, `RATE_LIMIT_MAX_REQUESTS_CHAT`, `DEBUG`, `POSTHOG_API_KEY`
  et `TRUSTED_ORIGINS` (better-auth lit `BETTER_AUTH_TRUSTED_ORIGINS`). `LOG_LEVEL` reste.
- **Rate limit** : `middleware/rate-limit.middleware.ts` tient une fenêtre fixe dans une
  seule `Map` partagée par tous les limiteurs (deux limiteurs aux plafonds différents
  incrémentent la même clé), `setInterval` à l'import, presets `auth`, `upload` et `public`
  sans consommateur, `skipSuccessfulRequests` jamais lu. À remplacer par
  `rate-limiter-flexible`, un compteur par limiteur. La connexion enfant `/sign-in/username`
  est déjà couverte par la règle par défaut de better-auth sur `/sign-in` : aucune règle à
  ajouter.
- **Déclarations mortes** : `IAppUser.parentId` (`packages/api/src/types.ts`) et
  `ElysiaAuthenticatedUser.parentId` (`types/index.ts`) ; `ignoreBinaries` et entrées
  `scripts/**` de l'espace `apps/server` du `knip.json` racine ; montage
  `./apps/server/scripts` du service `backend` de `docker-compose.yml` (dossier supprimé).
- **Scripts** (racine) : `scripts/dev.mjs` enchaîne trois attentes, une seule suffit
  (`docker compose up --wait`) ; `CREATE EXTENSION vector` est refait par `scripts/setup.mjs`
  et par `ci.yml` alors que `apps/server/src/db/migrate.ts` la crée sous verrou, et le check
  d'extension de `scripts/doctor-checks.mjs` renvoie à `pnpm run setup` au lieu du
  migrateur ; `parseEnvFile` du doctor garde le commentaire en ligne dans la valeur,
  `util.parseEnv` de Node le remplace.
- **CI** : boucle `pg_isready` redondante (le runner attend déjà le service `healthy`) ;
  `pnpm test:scripts` ne tourne nulle part ; `TURBO_TOKEN` et `TURBO_TEAM` absents des
  secrets et « Remote caching disabled » dans les logs (vérifié le 2026-09-23) : retirer ces
  variables de `ci.yml` et garder la seule couche `actions/cache`.
- **Landing** : option typée `appleWebApp` de la Metadata API à la place du bloc `other` de
  `apps/landing/app/layout.tsx` (changement technique, compatible avec le gel).
- **Lockfile** : `pnpm dedupe --check` échoue ; `react@19.2.3` et un second `next` restent
  résolus sous le serveur comme pairs optionnels de better-auth.
- **Doc que E2 rend fausse**, à corriger dans la même PR : `apps/server/README.md`
  (`MemoryCacheService`, moniteur mémoire), `apps/server/CLAUDE.md` (exception Zod de
  `src/schemas/`), `.claude/skills/dev-bootstrap/SKILL.md` (`CREATE EXTENSION` à la main
  avant `db:migrate`).

### Lot 0 — lint strict

- `eslint-disable` antérieurs dans `apps/server/src` (repositories learning,
  `parent.service.ts`, `education-levels.ts`, `seed-dev.ts`,
  `routes/chat-message.routes.ts` (`no-control-regex` dans `sanitizePrompt`)), à remplacer
  par une forme de code qui ne déclenche pas la règle.
  Configuration visée (relevée dans l'ancien plan d'E2) : config
  partagée `strictTypeChecked` et `stylisticTypeChecked`, `noInlineConfig`,
  `reportUnusedDisableDirectives: 'error'`, `only-warn` retiré) : c'est la quatrième PR
  du lot 0 dans la roadmap.

### Lot 1 — harnais d'évaluation

- En cas d'erreur, le span OpenTelemetry d'un appel IA porte le message d'erreur de
  Mistral, c'est-à-dire le corps de sa réponse : vérifier qu'il ne contient pas de contenu
  d'élève avant de brancher le premier exporteur (Langfuse).

### Lot 2 — agent qui ne cède pas, quotas et coûts

- **Défauts de coût** relevés par `etudes/2026-10-01/couts.md` sur le code du 2026-10-01 :
  - la synthèse vocale (`/api/tts`, `routes/tts.routes.ts`) n'a aucun quota, seulement le
    rate limit global : c'est le seul poste non borné ;
  - l'outil `generate_flashcards` du chat (`services/chat/chat-tools.ts`) n'a ni contrôle
    de plan ni quota de cartes, alors que la route `/api/learning/generate` réserve les
    fiches au Complet ;
  - le résumé de conversation se relance à chaque tour après le 10e
    (`services/chat/summarization.service.ts` : le seuil de 10 nouveaux messages se compte
    depuis le dernier message résumé, alors que 10 messages restent toujours hors du
    résumé) ;
  - le quota compte `usage.totalTokens` (`ChatOrchestrationService.finishTurn`) : les tokens
    en cache au prix plein alors qu'ils coûtent 10 %, raisonnement compris ; le préfixe fixe
    consomme 63 % de la fenêtre gratuite ;
  - classifieur d'intention, titre, résumé, analyse de photo, cartes, embeddings, STT et
    TTS n'écrivent rien dans `cost_tracking` : seul le tour de chat y est tracé ;
  - `cost_tracking.cost_cents` est un entier : un tour (environ 0,05 centime) s'arrondit
    à 0.
- **TTS** : `language` de `/api/tts` accepté mais ignoré, toutes les langues lues avec
  `fr_marie_neutral` ; `/api/tts/voices` annonce `es` et `de`, qui n'ont pas de voix.
- **Cartes** en `json_schema` non strict : le mode strict de Mistral refuse `format: uri`
  (`.url()`) et `propertyNames` (`z.record`) de `lib/ai/schemas/cards-domain.schema.ts` (400, code 3051).
  Revoir ce schéma pour repasser en strict.
- **Quota** : `needsMonthlyReset` (`services/quota/quota-config.ts`) passe par `Intl.DateTimeFormat` alors que les bornes du
  jour et de la semaine passent par date-fns. Une seule méthode.
- `lib/text/speech-normalize.ts` à réévaluer avec la lecture vocale.

### Lot 3 — client web

- **Tableau de bord parent** : `ParentDashboardService.getSessionMessages`
  (`services/parent/parent-dashboard.service.ts`), relayée par
  `ParentService.getSessionMessages`, renvoie le texte complet des messages d'une séance de
  l'enfant. Aucune route ne l'expose sur `main` depuis la suppression du mobile, mais le
  service existe : à supprimer, le parent ne voit que le résumé et l'alerte de détresse.
- **Facturation** : colonnes `revenuecat_customer_id` et `revenuecat_subscription_id` de
  `family_billing`, enum `billing_status` et commentaires RevenueCat de
  `db/schema/billing.schema.ts`, restes du mobile, refaits avec le paiement web.
- `config/app-guide/app-guide-data.ts` (outil `get_app_help`) décrit l'application mobile
  et l'abonnement : à réécrire avec la navigation web.
- **Hébergement** : délai de grâce SIGTERM au moins égal à un tour de chat (`app.stop()`
  attend les flux SSE) ; stockage partagé du rate limit s'il y a plusieurs instances ;
  `advanced.ipAddress.trustedProxies` de better-auth derrière le proxy de l'hébergeur.

### Lot 4 — marque et lancement

- CSP de la landing.
- Tests e2e de la landing qui gardent l'identité rejetée (`signs.spec.ts`, graisse des
  titres dans `type.spec.ts`, place de Tom dans `hero.spec.ts`) : à revoir avec la nouvelle
  identité.
- `Scribble` (`apps/landing/components/annotations/scribble.tsx`) provoque une erreur
  d'hydratation sous mouvement réduit (`initial` différent entre serveur et client).
  Correctif technique permis pendant le gel ; disparaît de toute façon avec l'identité du
  lot 4.

## Surveillance

Conditions à guetter, sans PR propriétaire tant qu'elles ne se déclenchent pas.

- Le graphe de dépendances GitHub listait encore `apps/curriculum/uv.lock` et
  `apps/ai-service/uv.lock` (supprimés en `8f5011f`) et y rattachait des alertes ; les 70
  alertes ont été classées `inaccurate` le 2026-09-22. Si une alerte réapparaît sur ces
  chemins, ouvrir un ticket au support GitHub. Dependabot ne sert qu'à détecter ; Renovate
  ouvre toutes les PR.
- Plafonds de version à lever à la main (Renovate ne les proposera pas) : TypeScript
  `<6.1.0` tant que `typescript-eslint` exige `typescript <6.1.0` ; `@types/node` `<25.0.0`
  tant que le runtime est Node 24 (Vercel ne propose que 24.x, 22.x et 20.x ; Node 26 LTS le
  2026-10-28).
- date-fns est gardé alors que Bun 1.4.2 expose `Temporal` : à réévaluer quand le typage de
  TypeScript le couvre.

## Bloquants

| Bloquant | Effet | Qui | Comment lever |
|---|---|---|---|
| Zero Data Retention non demandé | Mistral peut conserver textes et audio d'élèves selon sa rétention par défaut ; bloque tout utilisateur réel, pas le merge | Victor | Étape manuelle ci-dessous |
| Entretiens parents non faits | Prérequis du lot 4 : prix, appareil du soir et canaux restent des hypothèses | Victor | Étape manuelle ci-dessous |

## Étapes manuelles (Victor)

| Étape | Pour | Statut |
|---|---|---|
| Mener 8 à 10 entretiens de parents, dont des familles modestes (guide dans `etudes/2026-10-01/parents.md`) | Questions ouvertes de la vision, lot 4 | à faire |
| Demander le Zero Data Retention au support Mistral, puis vérifier Admin › API › Privacy | Porte avant ouverture | à faire |
| Retirer `NEXT_PUBLIC_SERVER_URL` du projet Vercel `tomai-landing` | Lot 0, liste d'attente | à faire |
| Trancher le statut juridique avec un expert-comptable : rester micro-entrepreneur ou créer une SASU (le GAR n'accepte que des personnes morales ; seuils de TVA et de la micro calculés en abonnés dans `etudes/2026-10-01/statut-juridique.md`) | Avant l'ouverture, au démarrage du lot 3 | à faire |
| Vérifier Tom dans le hero sur un iPhone (Safari : salut et respiration sans fond noir) | Landing en ligne | à faire |
| Mettre à jour les plugins Claude Code (`claude plugin marketplace update`, puis `claude plugin update <nom>`) | Outillage | à faire |

## Historique

- **Lot 0** (2026-09-22 et 23) : specs, roadmap et plans réécrits (#306) ; GitHub Actions
  sur leur dernière majeure (#307) ; A, `apps/mobile` et le billing RevenueCat supprimés
  (#308) ; B, dépendances et outillage à jour, Renovate auto-hébergé (#309) ; C, Mistral
  Small 4 sur l'endpoint UE (#313) ; D, bugs corrigés avec tests de non-régression (#315) ;
  doc réalignée (#317) ; E1, appels IA sur l'AI SDK et le SDK Mistral (#318). Outillage
  Claude Code en règles natives (#327).
- **Landing** (2026-09-23 au 30) : une direction « cahier » (#319 à #321) puis une première
  identité (#323 à #326, #329, #331, #332), toutes deux abandonnées ; liste d'attente
  retirée (#333, #335) ; échange d'exemple et sections (#336, #337) ; correctifs de
  dépendances (#330, #334).
- **2026-10-01** : études, vision produit validée et nouvelle roadmap. Pronote sort de la
  V1, l'identité visuelle est rejetée et se refait au lot 4, la landing en ligne est gelée.
  Landing présentée « en préparation », sans affirmation fausse (#338) ; doc refondue sous
  `docs/` (#339) ; fichiers d'instructions allégés (#328).
  Étude du statut juridique (#340). Pronote, la liste d'attente et leurs tables retirés du
  code, contexte Pronote de l'agent compris (#341).
