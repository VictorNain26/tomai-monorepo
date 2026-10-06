# Suivi des travaux

Source de vérité de l'avancement. **À lire en premier en reprenant le travail**, et à
mettre à jour dans la PR qui le fait avancer (PR ouverte ou mergée, étape manuelle faite,
bloquant levé). L'historique vit dans git et les PR.

- Vision : `vision.md` (pour qui, promesse, preuves, prix).
- Roadmap : `roadmap.md`.
- Specs techniques : `architecture.md`, `tuteur.md`.
- Études datées : `etudes/`. Ce sont des instantanés, jamais mis à jour.

## Où on en est

- **Dernière mise à jour :** 2026-10-06.
- **Lots en cours :** 2 et 3 en parallèle (`roadmap.md`).
  - Lot 0 terminé (Hono, Bun, refonte en modules, lint et TypeScript stricts, #343 à #356).
  - **Lot 1 :** le harnais est jugé insuffisant par Victor et refondu sur sources
    (`etudes/2026-10-06/refonte-evaluation.md`) ; restent aussi le référentiel des autres matières et les concurrents.
  - **Lot 2 :** les points 1 à 8 sont faits (#380 à #404). Le passage de fin est mesuré
    (`etudes/2026-10-06/passage-de-fin.md`, #409) : de 9 fuites à 2 sur les mêmes conversations,
    détresse et indices en net progrès, 0,13 c par tour d'élève. Le critère zéro fuite n'est pas
    atteint : 11 fuites sur 106, toutes sur cinq exercices qui demandent un fait, un mot ou une
    forme.
  - **Lot 3 :** client web choisi (`etudes/2026-10-06/client-web.md`, #406), squelette
    `apps/web` (#408), champs en erreur dans `VALIDATION_ERROR` (#405). `@repo/ui` reste sur
    Radix : la bascule sur Base UI (#407) est fermée, car sur iOS Base UI ne verrouille pas le
    défilement derrière un panneau quand la barre de Safari est repliée.
  - Hors lot : environnement de travail nettoyé (#410).
- **Prochaine action **, ordre indicatif (direction revue avec Victor le 2026-10-06 au soir) :
  1. PR #414 (Hono sert `apps/web`, PWA) : corriger les dix constats de sa revue, listés dans la
     PR, puis merger ;
  2. lot 1, refonte du harnais : mesures avec marge d'erreur, page simple pour que Victor
     juge, messages d'erreur nettoyés avant tout export, juge vérifié contre Victor ;
  3. lot 3 : étude des hébergeurs UE et préproduction, puis chat texte dans l'app avec une
     connexion minimale, pour que Victor teste sur son téléphone ;
  4. PR #415 (brouillon) : remesurer avec le harnais refait avant de la merger ;
  5. test complet dans Chrome à la fin de chaque chantier.
- **Décisions de Victor en attente :** budgets du quota ; offre Mistral payante pour paralléliser
  l'évaluation (aujourd'hui une conversation à la fois, environ 10 h pour 300 conversations
  rejouées deux fois) ; juge d'une autre famille, seulement s'il est très bon marché. Décidé le
  2026-10-06 : Small 4 partout, pas de Medium ; Victor seul annotateur ; landing refaite au lot 4.
- **PR ouvertes :** #414 et #415 (brouillon) ; `gh pr list`.
- **Landing en ligne gelée** jusqu'au lot 4 : seuls des correctifs d'honnêteté ou techniques y entrent.
  L'identité visuelle est rejetée et se refait au lot 4.

## Reporté

Constats hors du périmètre de la PR qui les a trouvés, un par ligne, avec leur source. Chacun
nomme son lot ; quand le plan de la PR s'écrit, le point y devient une tâche ou est
explicitement renvoyé (`.claude/rules/plans-and-agents.md`). Chemins relatifs à
`apps/server/src/` sauf mention contraire.

### Lot 1 — harnais d'évaluation et observabilité

- **Référentiel** : restent sciences, histoire-géographie et anglais, et le rattachement de leurs exercices (`referential/sources.ts`).
- **Alignement aux programmes** : ajouter des exercices inspirés des sujets du brevet 2018-2026, écrits pour le jeu (`etudes/2026-10-01/education-nationale.md`, « Conséquences pour Tom », b).
- **Harnais et observabilité** : juge non validé (α < 0,800 sur tous les critères), mesure
  unique sans intervalle, élève figé, débit Mistral à une conversation à la fois, messages
  d'erreur des spans qui portent la sortie du modèle : tout est repris par
  `etudes/2026-10-06/refonte-evaluation.md`, qui fixe l'ordre des PR. La file `tom-judge-agreement`
  de Langfuse reste ouverte jusqu'au 2026-11-02.
- **Niveau de langue** : ses questions sont retirées ; avant de le réintroduire, trouver une mesure
  validée de la lisibilité d'un texte français pour collégiens (`etudes/2026-10-03/analyse-erreurs.md`).

### Lot 2 — agent qui ne cède pas, quotas et coûts

- **TTS** : une seule voix, française (`fr_marie_*`), `/api/tts` n'accepte que `fr` ; décider s'il faut d'autres voix pour les cours de langue.
- **Normalisation de la lecture vocale** : `modules/voice/speech-normalize.ts` à réévaluer avec la lecture vocale.
- **Tests réels instables** : dans `live/mistral-eu.test.ts`, la fiche garde parfois zéro notion connue (`keepKnownNotions`), et le test du juge échoue par moments ; une assertion sur une sortie de modèle doit tenir à chaque tirage, ou le test mesurer un taux.

### Lot 3 — client web

- **Après une détresse** : une nouvelle séance rend le tuteur (`distress_events` est par séance) et une photo seule n'est pas jugée ; décider avec l'alerte au parent ce que voit l'élève ensuite, et qui le lève (`modules/tutor/distress.ts`).
- **Routes de séance qui se recouvrent** (`modules/tutor/chat-session.routes.ts`) : `/chat/sessions/latest` et `POST /chat/session`, `/chat/session/new` et `/chat/session/:id/reset` ; garder celles qu'appelle le client web.
- **Conformité** : mention « vous parlez à une IA » dès la première interaction, consentement conjoint sous 15 ans, AIPD, résumé parent proportionné et connu de l'enfant, aucun lien avec un établissement sans réévaluer le haut risque (`etudes/2026-10-01/education-nationale.md`, c ; `tuteur.md` §11).
- **Facturation** : colonnes et enum RevenueCat de `modules/billing/billing.schema.ts`, restes du mobile, refaits avec le paiement web ; les routes qui ont besoin des enfants vont dans `family`, `billing` reste un module feuille (#354).
- **Hébergement** : délai de grâce SIGTERM d'au moins un tour de chat, stockage partagé du rate limit s'il y a plusieurs instances, `advanced.ipAddress.trustedProxies` de better-auth derrière le proxy de l'hébergeur.
- **Client web**, point 1 : `@repo/api` en base relative, `ai` aligné sur la version qu'épingle `@ai-sdk/react`, Hono qui sert la SPA (fallback après `/api`, cache des assets, CSP), mesures sur un vrai iPhone et un Android (`etudes/2026-10-06/client-web.md`).
- **Alerte au parent** : le push web n'atteint qu'un parent qui a installé l'app (iOS) ; l'alerte de détresse demande un canal garanti, l'e-mail par exemple, à décider avec le parcours parent.
- **Langue d'un oral** : la transcription impose le français, et un oral de langue se transcrit mal (« Yes. » bruité devient « Oui. ») ; le client déclare la langue d'un oral de langue et la route la passe à Voxtral (`modules/voice/voxtral-transcribe.service.ts`).

### Lot 4 — marque et lancement

- **CSP de la landing** (`apps/landing/vercel.json`).
- **Tests e2e qui gardent l'identité rejetée** (`signs.spec.ts`, graisse des titres dans `type.spec.ts`, place de Tom dans `hero.spec.ts`) : à revoir avec la nouvelle identité.
- **`Scribble`** (`apps/landing/components/annotations/scribble.tsx`) : erreur d'hydratation sous mouvement réduit (`initial` différent entre serveur et client) ; correctif technique permis pendant le gel.

## Surveillance

Conditions à guetter, sans PR propriétaire tant qu'elles ne se déclenchent pas.

- **TypeScript 7** : pas avant que `typescript-eslint` accepte une version au-delà de 6.0.
- **typescript-eslint 8.71** (groupe `eslint` de Renovate) : les presets typés y activent
  `no-unsafe-enum-assignment`, qui signale trois lignes (`modules/learning/fsrs.service.ts`,
  `tests/learning.service.test.ts`, mesuré le 2026-10-06) ; la PR de Renovate échouera au lint
  tant qu'elles ne sont pas corrigées. D'ici là, `@typescript-eslint/*` existe en 8.70 et en
  8.71 (la seconde tirée par `@eslint-react/eslint-plugin`, #412).
- **Taux de Mistral** (`MISTRAL_USD_TO_EUR`, `platform/ai/cost.ts`) : 0,85, lu sur la page Coûts de
  l'organisation le 2026-10-06. Le revérifier à chaque facture : un écart change chaque coût et
  chaque quota.
- **Bun 1.4.2** plante par intermittence sous `bun test --isolate` (« Segmentation fault »,
  trace dans `JSFinalizationRegistry::takeDeadHoldingsValue`) : bug de Bun, oven-sh/bun#44161,
  ouvert, aucun correctif, la 1.4.2 est la dernière version. Il touchait environ trois passages
  sur quatre en local, aussi le pre-push. Les tests tournent donc un processus par fichier
  (`apps/server/scripts/run-tests.ts`) : aucun contexte retiré, le chemin qui plante ne s'exécute
  pas. Revenir à `bun test --isolate` dès qu'une release corrige #44161.
- **Override de `source-map-js`** (`package.json`, #398) : `postcss` et `@tailwindcss/node`
  figent la 1.2.1, touchée par GHSA-68fv-2mgg-jv7q (haute) ; l'override les force en `^1.2.2`.
  Le retirer quand les deux déclarent 1.2.2 ou plus. Même audit, dépendances de
  développement seulement : `braces` 3.0.3 (GHSA-vfj7-8cjw-p6xm), par
  `@next/eslint-plugin-next` ; la porte d'audit de la CI ne regarde
  que la production.
- **Sentry v11** : `apps/landing/next.config.*` importe `withSentryConfig` depuis
  `@sentry/nextjs`, déprécié (avertissement de `next typegen`) ; passer à
  `@sentry/nextjs/config` avant de monter en v11.
- **`@hono/bun`** (#355) échoue au critère d'adoption : paquet du monorepo Hono publié le
  2026-09-28, 704 téléchargements par semaine. Gardé car c'est la voie de migration avant
  Hono v5 ; revérifier son adoption avant la v5.

- Le graphe de dépendances GitHub listait encore `apps/curriculum/uv.lock` et
  `apps/ai-service/uv.lock` (supprimés en `8f5011f`) et y rattachait des alertes ; les 70
  alertes ont été classées `inaccurate` le 2026-09-22. **Reproduit** : 8 nouvelles alertes
  ouvertes entre le 2026-09-24 et le 2026-10-01 sur ces deux chemins (litellm,
  sentence-transformers, urllib3, hpack), constaté le 2026-10-02. Action de Victor : les
  classer `inaccurate` et ouvrir un ticket au support GitHub. Dependabot ne sert qu'à
  détecter ; Renovate ouvre toutes les PR.
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

## Étapes manuelles (Victor)

| Étape | Pour | Statut |
|---|---|---|
| Juger un échantillon de conversations sur la page prévue, par courtes séances | Vérifier le juge, lot 1 | quand la page existe |
| Ouvrir le compte de l'hébergeur UE recommandé par l'étude | Préproduction, lot 3 | à faire, après l'étude |
| Langfuse : la description de la file d'annotation `tom-judge-agreement` renvoie encore à `docs/agent.md`, devenu `docs/tuteur.md` ; la corriger dans l'interface (l'API n'a pas de mise à jour de file) | Évaluation | à faire |
| Demander le Zero Data Retention : réservé au paiement à l'usage (« only with pay-as-you-go », [centre d'aide Mistral](https://help.mistral.ai/en/articles/347612-can-i-activate-zero-data-retention-zdr)), or le compte est sur l'offre gratuite (8,50 € d'API inclus par mois, paiement à l'usage désactivé, constaté le 2026-10-02). Activer le paiement à l'usage avec un plafond, puis envoyer la demande avec sa justification (mineurs, RGPD) ; vérifier ensuite Admin › API › Confidentialité. L'entraînement sur les appels API et les modèles Labs y sont désactivés | Porte avant ouverture | à faire |
| Trancher le statut juridique avec un expert-comptable : rester micro-entrepreneur ou créer une SASU (le GAR n'accepte que des personnes morales ; seuils de TVA et de la micro calculés en abonnés dans `etudes/2026-10-01/statut-juridique.md`) | Avant l'ouverture, au démarrage du lot 3 | à faire |
| Vérifier Tom dans le hero sur un iPhone (Safari : salut et respiration sans fond noir) | Landing en ligne | à faire |
| Relecture des 32 exercices : confiée à Claude le 2026-10-02 et outillée (32 citations retrouvées mot pour mot dans leur PDF officiel, 14 sources de réponse en ligne, 14 réponses recalculées par le test) ; un regard pédagogique humain sur un échantillon reste à prévoir avant de publier les mesures | Lot 1, jeu rejouable par un tiers ; lot 4 pour la publication | fait |
| Projet Langfuse « tomai » en région UE (`https://cloud.langfuse.com`, offre Hobby) et ses clés dans `apps/server/.env`, vérifiées par l'API (HTTP 200) le 2026-10-02 | Lot 1, point 2 | fait |
| Espace Mistral « ci » et sa clé `github-actions`, en secret GitHub `MISTRAL_API_KEY_CI` (2026-10-02). Sans paiement à l'usage, la dépense reste bornée par les 8,50 € inclus ; la valeur du secret se vérifie au premier passage en CI | Lot 1, point 6 | fait |
| Ajouter `E2E (Playwright)` et `Script tests` aux checks requis du ruleset `Protect main` (Settings › Rules) : ils tournent depuis #412 mais ne bloquent pas un merge | Outillage | à faire |
| Lundi 2026-10-12 : vérifier que Renovate a ouvert les mises à jour en attente du tableau de bord (#310), fenêtre élargie à tout le lundi par #412 ; sinon cocher « Create all awaiting schedule PRs at once » | Outillage | à faire |
| Mettre à jour les plugins Claude Code (`claude plugin marketplace update`, puis `claude plugin update <nom>`) | Outillage | à faire |
