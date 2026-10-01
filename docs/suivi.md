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
- **Lot en cours :** 0 — Assainissement, élargi le 2026-10-01 : Victor a demandé de
  remplacer par Bun tout ce qu'il remplace proprement et une refonte complète du serveur.
  Le serveur tourne sur Hono (#343). Restent, dans cet ordre (`roadmap.md`, lot 0), chacune
  avec son plan écrit au démarrage contre `main` à jour :
  - **refonte du serveur** : socle sous `src/platform/` (#348), module `voice` (#349),
    module `documents` (#350) ;
    restent, dans l'ordre, `learning`, `tutor`, `auth` et `family`, `billing`
    (rangement cible : `architecture.md`, « Monolithe modulaire ») ;
  - **lint strict** (détail dans « Reporté »).
- **Prochaine action :** refonte du module `learning`, sur une branche courte dont le plan
  s'écrit d'abord dans `docs/plans/` (`.claude/rules/plans-and-agents.md`).
- **PR ouvertes :** aucune.
- **Landing en ligne gelée** jusqu'au lot 4 : seuls des correctifs d'honnêteté ou techniques y entrent.
  L'identité visuelle est rejetée et se refait au lot 4.

## Reporté

Constats hors du périmètre de la PR qui les a trouvés. Chacun nomme son lot ; quand le
plan de la PR s'écrit, le point y devient une tâche ou est explicitement renvoyé
(`.claude/rules/plans-and-agents.md`). Chemins relatifs à `apps/server/src/` sauf mention
contraire.

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

- **Métrique « alignement aux programmes »** (`etudes/2026-10-01/education-nationale.md`,
  « Conséquences pour Tom », b) : items rattachés à un objectif du référentiel, aide au
  bon niveau sans notion hors programme, jamais la réponse. Corpus : sujets du brevet
  2018-2026, parties produites par le ministère seulement (les documents de tiers sont
  exclus de la réutilisation, CRPA L. 321-2 c) ; items propres pour la 6e, la 5e et la 4e.
- En cas d'erreur, le span OpenTelemetry d'un appel IA porte le message d'erreur de
  Mistral, c'est-à-dire le corps de sa réponse : vérifier qu'il ne contient pas de contenu
  d'élève avant de brancher le premier exporteur (Langfuse).

### Lot 2 — agent qui ne cède pas, quotas et coûts

- **Référentiel des programmes** (même étude, a) : une version par rentrée, extraite des
  annexes PDF du BO (aucune donnée structurée officielle à jour), une entrée par objectif
  d'apprentissage avec NOR, n° et date du BO, empreinte du PDF et rentrée d'application,
  relue par un humain, injectée par notion à chaque tour. En 2026-2027 coexistent les
  programmes de 2025 (6e), de 2026 (5e, français et mathématiques) et de 2020 (4e, 3e).
- **Défauts de coût** relevés par `etudes/2026-10-01/couts.md` sur le code du 2026-10-01 :
  - la synthèse vocale (`/api/tts`, `modules/voice/voice.routes.ts`) n'a aucun quota, seulement le
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
- **TTS** : une seule voix, française (`fr_marie_*`) ; `/api/tts` n'accepte et n'annonce
  plus que `fr` (#349). Décider s'il faut d'autres voix pour les cours de langue.
- **Cartes** en `json_schema` non strict : le mode strict de Mistral refuse `format: uri`
  (`.url()`) et `propertyNames` (`z.record`) de `lib/ai/schemas/cards-domain.schema.ts` (400, code 3051).
  Revoir ce schéma pour repasser en strict.
- **Quota** : `needsMonthlyReset` (`services/quota/quota-config.ts`) passe par `Intl.DateTimeFormat` alors que les bornes du
  jour et de la semaine passent par date-fns. Une seule méthode.
- `modules/voice/speech-normalize.ts` à réévaluer avec la lecture vocale.

### Lot 3 — client web

- **Conformité** (même étude, c) : mention « vous parlez à une IA » dès la première
  interaction (AI Act, art. 50, applicable depuis le 2 août 2026) ; consentement conjoint
  élève et parent sous 15 ans (loi Informatique et Libertés, art. 45) ; AIPD ; résumé
  parent proportionné et connu de l'enfant ; aucun lien avec un établissement (GAR,
  tableau enseignant, notes transmises) sans réévaluer le classement « haut risque »
  (annexe III, point 3, applicable le 2 décembre 2027).
- **Erreurs de validation** : le 400 `VALIDATION_ERROR` du gestionnaire global
  (`platform/http/error-handler.ts`) renvoie toujours le même message générique,
  sans dire quel champ est faux. Les formulaires d'enfant en auront besoin : exposer les
  champs en erreur dans l'enveloppe, pour toutes les routes.
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

- **À ne jamais écrire sur la landing** (même étude, c) : « conforme au cadre d'usage de
  l'IA du ministère », « agréé » ou « recommandé par l'Éducation nationale », « aligné sur
  les programmes » sans la métrique publiée, « fait les devoirs ».
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
- **Catalogs Bun** : retirés à la bascule (#344) parce que Renovate ne les met pas à jour.
  Les remettre quand renovatebot/renovate#42909 est fusionnée.
- **Bun.SQL** à la place de postgres.js : écarté le 2026-10-01. 34 bugs Postgres ouverts
  dans oven-sh/bun, dont des corruptions silencieuses (`text[]` stocké en JSON, `uuid[]`
  non parsé, entiers au-delà de 2^51 envoyés en flottant), et dans le driver `bun-sql` de
  Drizzle (JSON non sérialisé, millisecondes tronquées, fuseau horaire faux). À réévaluer
  quand ces bugs sont fermés.
- **S3 de Bun** à la place du SDK AWS : écarté le 2026-10-01. Le presign de Bun ne signe ni
  `Content-Length` ni `Content-Type` en requête (`S3FilePresignOptions` : `expiresIn`,
  `method`, `acl`, `type`), alors que l'upload direct en dépend pour borner la taille. À
  réévaluer si Bun l'ajoute.
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
| Après le merge de #344 : `rm -rf node_modules && bun install` à la racine du clone local (les `node_modules` actuels viennent de pnpm) | Outillage | à faire |
| Base de dev locale : `bun run setup` (applique les migrations 0028 et 0029, qui suppriment les tables de la liste d'attente et de Pronote ; le doctor signale 28/30) | Outillage | à faire |
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
  E2 découpé en trois PR ; la première retire le cache et le moniteur mémoire, le limiteur
  de pool, la double validation des routes enfant et les variables mortes, et passe le rate
  limit sur rate-limiter-flexible (#342).
  Serveur passé d'Elysia à Hono, sur Bun, après comparaison chiffrée ; Python écarté pour
  le serveur (#343).
  `bun install` remplace pnpm, lockfile migré à versions identiques (#344).
  Scripts et tests de scripts sous Bun, attentes et `CREATE EXTENSION` en double retirés,
  CI allégée, liste « outillage » soldée (#346). `appleWebApp` de la landing abandonné :
  il émet `mobile-web-app-capable` au lieu de `apple-mobile-web-app-capable`.
  Logger sur pino (même API, `LOG_LEVEL` appliqué, erreurs loggées avec leur stack sous
  `err`) (#347).
  Refonte du serveur commencée : socle sous `src/platform/` (#348), module `voice` (#349),
  module `documents`, premier module qui porte ses tables ; une suppression de fichier
  garde la ligne quand le stockage échoue, au lieu de laisser un objet d'élève orphelin
  (#350).
