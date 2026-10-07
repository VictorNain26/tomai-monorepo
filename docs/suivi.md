# Suivi des travaux

Source de vérité de l'avancement. **À lire en premier en reprenant le travail**, et à
mettre à jour dans la PR qui le fait avancer (PR ouverte ou mergée, étape manuelle faite,
bloquant levé). L'historique vit dans git et les PR.

- Vision : `vision.md` (pour qui, promesse, preuves, prix).
- Roadmap : `roadmap.md`.
- Specs techniques : `architecture.md`, `tuteur.md`.
- Études datées : `etudes/`. Ce sont des instantanés, jamais mis à jour.

## Où on en est

- **Dernière mise à jour :** 2026-10-07.
- **Lot en cours : 0, la refonte** (`roadmap.md`). Victor a demandé le 2026-10-06 de reprendre toute
  la codebase sur des pratiques établies, sans rien garder de l'ancienne architecture. Quatre
  audits et l'architecture cible : `etudes/2026-10-06/refonte-architecture.md` (#418), sept
  décisions de Victor prises le même jour. Les lots 1 à 3 reprennent sur le nouveau socle, chacun
  à son étape.
  - Acquis avant la refonte, à porter : le savoir du lot 2 (de 9 fuites à 2 sur les mêmes
    conversations, `etudes/2026-10-06/passage-de-fin.md` ; 11 fuites sur 106, sur cinq exercices
    qui demandent un fait, un mot ou une forme, diagnostiquées par #415), la refonte de
    l'évaluation (`etudes/2026-10-06/refonte-evaluation.md`), le client web (#406, #408, #414).
- **Étape 2 faite** : l'ancien serveur, `packages/api` et `packages/web-host` supprimés ; le socle
  en place (composition, erreurs RFC 9457, better-auth, base et migrations, logs, santé, arrêt,
  service du web), testé sur une vraie base, frontières vérifiées au lint ; la suite de bout en
  bout du web tourne contre le serveur construit (`tooling/playwright-web`).
- **Étape 3** : un seul workflow, `ci.yml`, réuni par `ci-ok` ; l'image ne contient plus que Bun,
  les bundles, les migrations et le web (261 Mo au lieu de 1,23 Go), lancée en CI contre
  Postgres et publiée sur GHCR au SHA sur `main`.
- **Le foyer et l'âge, revus le 2026-10-07** (`etudes/2026-10-07/foyer-eleve-age.md`, décisions de
  Victor) : trois façons d'accompagner l'élève, du CP à la terminale, la V1 en mode guidé au
  collège ; le parent ne connaît aucun identifiant de son enfant, qui relie son appareil par un code ;
  l'élève voit le résumé de son parent ; la détresse est relue par un humain avant tout message au
  parent.
- **Étape 4** : le foyer, l'élève en mode guidé, son jumelage d'appareil et la matrice d'accès
  (#425) ; l'e-mail des gardiens chez Scaleway TEM (`etudes/2026-10-07/email-transactionnel.md`) :
  adresse vérifiée avant toute connexion, réinitialisation qui ferme toutes les sessions,
  suppression confirmée par le mot de passe qui emporte le foyer d'un gardien seul.
- **Étape 5 en cours**, le tuteur porté, en quatre PR : la plateforme IA et le faux Mistral (#430),
  le cœur pur du tuteur, les séances et le tour complet, le quota par élève. L'étude des hébergeurs
  UE avance en parallèle.
  L'ordre complet est dans l'étude. Test complet dans Chrome à la fin de chaque étape, la première
  à l'étape 6 avec les écrans.
- **Rentabilité et quotas** (`etudes/2026-10-07/rentabilite.md`) : le gratuit décide de la
  rentabilité, la distribution est le vrai risque ; quotas proposés de 2 c (Gratuit) et 10 c
  (Complet) par élève et par jour, voix comprise, remis à zéro à 4 h, et l'année scolaire à 69 €
  payée d'avance, sans renouvellement : recommandations retenues par Victor le 2026-10-07.
- **Décisions de Victor en attente**, au moment de l'étape qui en dépend : offre Mistral payante pour paralléliser l'évaluation et juge d'une autre famille,
  seulement s'il est très bon marché (étape 8).
- **PR ouvertes :** `gh pr list`.
- **Landing en ligne gelée** jusqu'au lot 4, hors de la refonte : seuls des correctifs d'honnêteté
  ou techniques y entrent. L'identité visuelle est rejetée et se refait au lot 4.

## Reporté

Constats hors du périmètre de la PR qui les a trouvés, un par ligne, avec leur source. Chacun
nomme son étape de refonte ou son lot ; quand le plan de la PR s'écrit, le point y devient une
tâche ou est explicitement renvoyé (`.claude/rules/plans-and-agents.md`). Ce que la refonte
supprime ou que l'étude couvre n'y figure plus.

### Refonte — préproduction (étape 7)

- **Observabilité** : OpenTelemetry et Sentry côté serveur, avec une destination dans l'UE contrainte par la config (`refonte-architecture.md`, « Données et autorisation »).
- **Postgres de l'hébergeur** : `verify-full` vérifie le certificat contre les CA du système ; une CA privée demande l'option `ssl` avec `ca` (`platform/db/client.ts`).
- **Hébergement** : délai de grâce SIGTERM d'au moins un tour de chat, et `DRAIN_MS` (`src/main.ts`, 5 s) recalé sur l'intervalle de la sonde de l'hébergeur ; stockage partagé du rate limit s'il y a plusieurs instances ; derrière le proxy de l'hébergeur, ses sauts de confiance pour la clé du rate limit, y compris celle de better-auth sur l'échange d'un code de jumelage (`advanced.ipAddress`, `platform/auth/pairing.ts`), sans quoi tous les clients partagent un même compteur (`platform/http/rate-limit.ts`, aujourd'hui l'adresse de la connexion) et pour `trustedProxies` de better-auth ; compression des fichiers du web par le build ou par le proxy, selon l'hébergeur.
- **Appareils de l'élève, avec les écrans (étape 6)** : prévenir l'élève sur ses appareils déjà reliés quand un nouvel appareil l'est (date, type d'appareil), ce qui rend réelle la transparence du jumelage ; décider, en concevant l'historique, si un appareil nouvellement relié ne montre que les séances commencées après son jumelage (revue de #425, `etudes/2026-10-07/foyer-eleve-age.md`, § 7). Les pages du web pour les liens de vérification et de réinitialisation.
- **Client web** : `ai` aligné sur la version qu'épingle `@ai-sdk/react`, avec l'étape 6 ; mesures sur un vrai iPhone et un Android (`etudes/2026-10-06/client-web.md`).
- **Connexion** : la page d'erreur de better-auth (`/api/auth/error`) a un `<style>` en ligne que la CSP bloque ; `onAPIError.errorURL` vers une page du web, avec l'étape 6.

### Lot 1 — harnais d'évaluation et observabilité

- **Référentiel** : restent sciences, histoire-géographie et anglais, et le rattachement de leurs exercices.
- **Alignement aux programmes** : ajouter des exercices inspirés des sujets du brevet 2018-2026, écrits pour le jeu (`etudes/2026-10-01/education-nationale.md`, « Conséquences pour Tom », b).
- **Niveau de langue** : avant de le réintroduire, trouver une mesure validée de la lisibilité d'un texte français pour collégiens (`etudes/2026-10-03/analyse-erreurs.md`).
- La file `tom-judge-agreement` de Langfuse reste ouverte jusqu'au 2026-11-02.

### Lot 3 — l'app entre les mains des familles

- **Après une détresse** : la revue humaine (Victor au départ), son délai et sa trace ; ce que voit l'élève ensuite, et qui lève la fermeture ; une photo seule n'est pas jugée (`etudes/2026-10-07/foyer-eleve-age.md`).
- **Conformité** : mention « vous parlez à une IA » dès la première interaction, consentement conjoint sous 15 ans, AIPD, résumé parent proportionné et connu de l'enfant, aucun lien avec un établissement sans réévaluer le haut risque (`etudes/2026-10-01/education-nationale.md`, c ; `tuteur.md` §11).
- **Message au parent après revue** : le push web n'atteint qu'un parent qui a installé l'app (iOS) ; un message décidé après une détresse demande un canal garanti, l'e-mail par exemple, à décider avec le parcours parent ; une table d'envois à clé unique en tient l'idempotence et la trace (`etudes/2026-10-07/email-transactionnel.md`).
- **Après la V1, primaire et lycée** : modes accompagné et autonome, transition à 15 puis 18 ans (`etudes/2026-10-07/foyer-eleve-age.md`, § 7) ; le primaire attend une mesure de la reconnaissance vocale sur des voix d'enfants français.
- **Voix** : la `Permissions-Policy` interdit le micro ; l'ouvrir à `self` avec l'enregistrement d'un oral. Une seule voix, française (`fr_marie_*`) : décider s'il en faut d'autres pour les cours de langue, et réévaluer la normalisation de la lecture vocale.
- **Langue d'un oral** : la transcription impose le français, et un oral de langue se transcrit mal (« Yes. » bruité devient « Oui. ») ; le client déclare la langue d'un oral de langue et la route la passe à Voxtral.

### Lot 4 — marque et lancement

- **CSP de la landing** (`apps/landing/vercel.json`).
- **Tests e2e qui gardent l'identité rejetée** (`signs.spec.ts`, graisse des titres dans `type.spec.ts`, place de Tom dans `hero.spec.ts`), et ceux du web (`apps/web/tests/home.spec.ts`, nom et couleurs du manifest) : à revoir avec la nouvelle identité.
- **`Scribble`** (`apps/landing/components/annotations/scribble.tsx`) : erreur d'hydratation sous mouvement réduit (`initial` différent entre serveur et client) ; correctif technique permis pendant le gel.

## Surveillance

Conditions à guetter, sans PR propriétaire tant qu'elles ne se déclenchent pas.

- **TypeScript 7** : pas avant que `typescript-eslint` accepte une version au-delà de 6.0.
- **typescript-eslint 8.71** (groupe `eslint` de Renovate) : les presets typés y activent
  `no-unsafe-enum-assignment`, qui signalait trois lignes de l'ancien serveur le 2026-10-06 ;
  le nouveau code doit passer cette règle avant la montée. D'ici là, `@typescript-eslint/*` existe en 8.70 et en
  8.71 (la seconde tirée par `@eslint-react/eslint-plugin`, #412).
- **Configuration des agents** : élagage mensuel de CLAUDE.md, `.claude/rules/` et
  `.claude/skills/` (`.claude/rules/plans-and-agents.md`, « L'élagage ») ; prochain le 2026-11-02.
- **Taux de Mistral** (`MISTRAL_USD_TO_EUR`, `platform/ai/cost.ts`) : 0,85, lu sur la page Coûts de
  l'organisation le 2026-10-06. Le revérifier à chaque facture : un écart change chaque coût et
  chaque quota.
- **Bun 1.4.2** plante par intermittence sous `bun test --isolate` (« Segmentation fault »,
  trace dans `JSFinalizationRegistry::takeDeadHoldingsValue`) : bug de Bun, oven-sh/bun#44161,
  ouvert, aucun correctif, la 1.4.2 est la dernière version. Il touchait environ trois passages
  sur quatre en local, aussi le pre-push. Le lanceur qui isolait chaque fichier est parti avec les
  `mock.module` (étape 2) : `bun test` simple, cinq passages de suite sans plantage le 2026-10-06.
  Guetter un « Segmentation fault » en CI.
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
| Clause des mineurs des conditions de Mistral (usages interdits, (c)) : pas de données personnelles d'enfants sous l'âge du consentement numérique, 15 ans en France ; lue à la lettre, presque tout le collège | Bloque tout utilisateur réel de moins de 15 ans, pas le merge | Victor | Clarification écrite de Mistral, demandée avec le ZDR (`etudes/2026-10-07/foyer-eleve-age.md`, § 1) |

## Étapes manuelles (Victor)

| Étape | Pour | Statut |
|---|---|---|
| Recréer la base locale, qui porte l'ancien schéma : `docker compose down -v` puis `bun run setup` (skill `dev-bootstrap`) ; et dans `apps/server/.env`, `BETTER_AUTH_URL=http://localhost:3002` | Refonte, étape 2 | à faire |
| Juger un échantillon de conversations sur la page prévue, par courtes séances | Vérifier le juge, lot 1 | quand la page existe |
| Ouvrir une Organisation Scaleway pour l'e-mail (moyen de paiement, identité, projet dédié, clé IAM limitée à Transactional Email) ; publier SPF, DKIM, DMARC (`p=none` d'abord) et MX du sous-domaine d'envoi, puis vérifier le domaine dans la console (`etudes/2026-10-07/email-transactionnel.md`). Le domaine dépend du nom du produit | Préproduction, étape 7 | à faire |
| Ouvrir le compte de l'hébergeur UE recommandé par l'étude | Préproduction, lot 3 | à faire, après l'étude |
| Langfuse : la description de la file d'annotation `tom-judge-agreement` renvoie encore à `docs/agent.md`, devenu `docs/tuteur.md` ; la corriger dans l'interface (l'API n'a pas de mise à jour de file) | Évaluation | à faire |
| Demander le Zero Data Retention : réservé au paiement à l'usage (« only with pay-as-you-go », [centre d'aide Mistral](https://help.mistral.ai/en/articles/347612-can-i-activate-zero-data-retention-zdr)), or le compte est sur l'offre gratuite (8,50 € d'API inclus par mois, paiement à l'usage désactivé, constaté le 2026-10-02). Activer le paiement à l'usage avec un plafond, puis envoyer la demande avec sa justification (mineurs, RGPD), et dans le même envoi la question sur la clause (c) des conditions commerciales : un service pour des 10-15 ans, avec l'accord de leurs parents, est-il permis ; vérifier ensuite Admin › API › Confidentialité. L'entraînement sur les appels API et les modèles Labs y sont désactivés | Porte avant ouverture | à faire |
| Trancher avec un expert-comptable, en une consultation : rester micro-entrepreneur (recommandé, `etudes/2026-10-07/rentabilite.md`) ou créer une SASU (le GAR n'accepte que des personnes morales, `etudes/2026-10-01/statut-juridique.md`) ; BIC ou BNC ; taux de TVA de Tom, normal ou 5,5 % ; CFP ; accès au versement libératoire selon le revenu fiscal de référence de 2024 | Avant l'ouverture, au démarrage du lot 3 | à faire |
| Vérifier Tom dans le hero sur un iPhone (Safari : salut et respiration sans fond noir) | Landing en ligne | à faire |
| Relecture des 32 exercices : confiée à Claude le 2026-10-02 et outillée (32 citations retrouvées mot pour mot dans leur PDF officiel, 14 sources de réponse en ligne, 14 réponses recalculées par le test) ; un regard pédagogique humain sur un échantillon reste à prévoir avant de publier les mesures | Lot 1, jeu rejouable par un tiers ; lot 4 pour la publication | fait |
| Projet Langfuse « tomai » en région UE (`https://cloud.langfuse.com`, offre Hobby) et ses clés dans `apps/server/.env`, vérifiées par l'API (HTTP 200) le 2026-10-02 | Lot 1, point 2 | fait |
| Espace Mistral « ci » et sa clé `github-actions`, en secret GitHub `MISTRAL_API_KEY_CI` (2026-10-02). Sans paiement à l'usage, la dépense reste bornée par les 8,50 € inclus ; la valeur du secret se vérifie au premier passage en CI | Lot 1, point 6 | fait |
| Ruleset `Protect main` : seul `ci-ok` est exigé (2026-10-07), la fusion automatique de Renovate rétablie | Outillage | fait |
| GHCR : l'ancien paquet `tomai-server`, publié à la main et rattaché à aucun dépôt, bloquait la publication (`permission_denied: write_package`) ; supprimé avec `tomai-ai-service` le 2026-10-07, la CI a recréé `tomai-server` rattaché au dépôt | Image publiée, étape 3 | fait |
| Lundi 2026-10-12 : vérifier que Renovate a ouvert les mises à jour en attente du tableau de bord (#310), fenêtre élargie à tout le lundi par #412 ; sinon cocher « Create all awaiting schedule PRs at once ». Les mineures et correctifs se mergent seuls quand `ci-ok` est vert, les majeures à la main | Outillage | à faire |
| Mettre à jour les plugins Claude Code (`claude plugin marketplace update`, puis `claude plugin update <nom>`) | Outillage | à faire |
