# Suivi des travaux

Source de vérité de l'avancement. **À lire en premier en reprenant le travail**, et à
mettre à jour dans la PR qui le fait avancer (PR ouverte ou mergée, étape manuelle faite,
bloquant levé). L'historique vit dans git et les PR.

- Vision : `vision.md` (pour qui, promesse, preuves, prix).
- Roadmap : `roadmap.md`.
- Specs techniques : `architecture.md`, `tuteur.md`.
- Études datées : `etudes/`. Ce sont des instantanés, jamais mis à jour.

## Où on en est

- **Dernière mise à jour :** 2026-10-08.
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
  suppression qui emporte le foyer d'un gardien seul. Depuis le 2026-10-08, plus de mot de passe :
  un code envoyé à l'adresse (« Entrée sans mot de passe » ci-dessous).
- **Étape 5 faite**, le tuteur porté : la plateforme IA et le faux Mistral (#430), les contrôles
  purs (#431), les étapes du tour, qui échouent fermées (#432), les séances (#434), le tour et son
  enregistrement (#435), le quota par élève (#436, 2 c par jour pour tous tant que le paiement
  n'existe pas), le résumé de séance et le titre. Le tuteur répond par
  `POST /api/sessions/:id/messages`.
- **Étape 6 faite**, le web : le client typé et la connexion du gardien (#438), le foyer et le
  jumelage de l'appareil (#439), le chat de l'élève avec `useChat` (#441), l'appareil partagé de
  la famille (#442). Testée de bout en bout dans Chrome le 2026-10-07, avec le vrai Mistral.
- **Mémoire d'une séance à l'autre** (`etudes/2026-10-07/memoire-entre-seances.md`), décidée par
  Victor le 2026-10-07 : une mémoire d'apprentissage tirée des exercices, acceptée par le parent
  et l'enfant, visible et effaçable par l'élève, remise à zéro à la rentrée ; promise seulement
  après la mesure avec et sans mémoire. Faite : le serveur (#443, l'accord, le bloc
  `<learner_memory>`, `/api/memory`) et les écrans du parent et de l'élève (#444). Reste sa mesure
  au harnais (lot 1), avant toute promesse.
- **Le prénom et la mémoire chez Mistral** (Victor, 2026-10-07) : ils partent dans le prompt ;
  aucun vrai élève avant la réponse écrite de Mistral sur sa clause des moins de 15 ans ; s'il
  refuse, ils en sortent (`tuteur.md` § 11).
- **Hébergement unifié** (`etudes/2026-10-07/hebergement.md`), décidé par Victor le 2026-10-07 :
  tout chez Clever Cloud, région Paris ; `app.<nom>.fr` pour l'app, `<nom>.fr` pour la landing en
  Astro dans une application statique ; Bugsink à la place de Sentry ; Vercel supprimé. HDS demandé
  à la CNIL ; s'il est requis, la production naît en zone HDS ou chez Scalingo.
- **Landing en Astro** (portage fidèle, décision de Victor du 2026-10-07) : Next.js, Vercel et Sentry
  supprimés ; Astro 7 statique sans framework client (éléments natifs et personnalisés, API vanilla de
  Motion), CSP à empreintes, servie par Caddy (`apps/landing/Caddyfile`),
  contre lequel tourne la suite e2e ; pages légales alignées sur Clever Cloud. Déployée le 2026-10-08
  dans l'application statique `tomai-landing` (pico, Paris), par la CI à chaque merge ;
  `tomia.fr` pointe encore sur la version Next de Vercel jusqu'à la bascule du DNS.
- **Staging et bêta fermée** (Victor, 2026-10-07) : la préproduction de l'étape 7 devient le staging,
  avec ses propres clés et la plus petite taille qui suffit (Docker nano, 582 Mo, pour un serveur
  mesuré à 150 Mo au repos, et Postgres 18 `xxs_tny`). Un compte parent se crée sur invitation
  (`apps/server/src/platform/auth/invitation.ts`, `bun run invite`, #449), au staging comme en
  production, jusqu'au lancement public (lot 4).
- **Livraison** (Victor, 2026-10-08, `architecture.md`, « Environnements et livraison ») : `main`
  seule, chaque merge déployé en staging ; la production, avec la première vraie famille, reçoit la
  même image sur l'approbation de Victor. Clever Cloud jugé fiable pour cet usage : pannes publiées
  et suivies d'un compte rendu, la dernière à Paris le 2026-09-30 (57 min) ; Scalingo reste le plan B.
- **Staging en ligne le 2026-10-08** : https://staging.tomia.fr, chez Clever Cloud, région Paris,
  l'application `tomai-staging` (Docker nano) et sa base `tomai-staging-db` (PostgreSQL 18,
  `XXS_TNY`, disque chiffré, certificat épinglé par `DATABASE_CA`) ; déployé par la CI après chaque
  merge (#451). L'e-mail part de `mail.tomia.fr` chez Scaleway (domaine vérifié, clé IAM limitée à
  l'envoi, `tomai-staging-mail`). Les entrées DNS mortes de Koyeb sont supprimées.
- **Entrée sans mot de passe** (Victor, 2026-10-08) : pas de connexion Google, qui ferait savoir à
  une société américaine qui utilise Tom ; le parent entre par un code à 6 chiffres envoyé à son
  adresse, le premier créant son compte sur invitation, puis donne son prénom. Il peut ensuite créer
  une clé d'accès depuis son foyer et entrer par le verrouillage de son appareil
  (`@better-auth/passkey`, vérifié le 2026-10-08) ; le code reste pour un appareil neuf.
- **Test du staging par Victor, le 2026-10-08** : inscription sur invitation, code, prénom et clé
  d'accès marchent de bout en bout ; ses retours d'interface et de parcours vont au lot 3.
- **Profils sur l'appareil** (Victor, 2026-10-08) : l'appareil d'un enfant reste relié 90 jours sans
  usage ; le parent ouvre l'espace de son enfant sur son propre téléphone sans code, et revient au
  sien par sa clé d'accès ou un code ; l'enfant n'a plus de déconnexion, mais « Changer de profil ».
- **Prochaine action** : la bascule du DNS de `tomia.fr` vers Clever Cloud (`clever domain diag`
  donne les enregistrements), puis la suppression de Vercel et de Sentry.
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

- **Trous des tests, mesurés le 2026-10-08** (couverture Bun 99 % des lignes, sans branches ; mutation StrykerJS et `@hughescr/stryker-bun-runner` sur trois modules purs : 76,9 %) : comblés en TDD le jour même pour `leak.ts`, `written-equalities.ts`, `output-check.ts` (chaque mutant survivant appliqué à la main et tué ; deux restent, équivalents : `>`/`>=` sous la marge de 1e-9, le filtre des formes vides que l'énoncé écarte déjà), la réponse de détresse quand la base refuse de l'enregistrer, les mois de naissance relatifs, la matrice d'accès sans ordre, le jour du quota lu par test. Reste : l'adresse de connexion (`platform/http/client-address.ts`, `getConnInfo`) n'est exercée par aucun test, faute d'un vrai `Bun.serve`.

- **Observabilité** : les erreurs du serveur vers Bugsink, auto-hébergé avec sa base, celles des navigateurs par le serveur (`tunnel`) ; les traces OpenTelemetry attendent un besoin mesuré (`etudes/2026-10-07/hebergement.md`).
- **Cookies de session** : le préfixe `__Host-` pour ceux de better-auth, l'app et la landing étant du même site (à vérifier dans la config de better-auth).
- **Base du staging joignable depuis internet**, protégée par identifiant, mot de passe et TLS : la placer avec l'application dans un réseau privé Clever Cloud (Network Groups, [changelog](https://www.clever.cloud/developers/changelog/2026/05-12-network-groups-console)) avant la production.
- **Landing** : une application de preview par PR (`etudes/2026-10-07/hebergement.md`), au lot 4.
- **Hébergement** : délai de grâce SIGTERM d'au moins un tour de chat, et `DRAIN_MS` (`src/main.ts`, 5 s) recalé sur l'intervalle de la sonde de l'hébergeur ; stockage partagé du rate limit s'il y a plusieurs instances ; derrière le proxy de l'hébergeur, ses sauts de confiance pour la clé du rate limit, y compris celle de better-auth sur l'échange d'un code de jumelage (`advanced.ipAddress`, `platform/auth/pairing.ts`) et sur l'envoi du code de connexion (3 par minute), sans quoi tous les clients partagent un même compteur (`platform/http/rate-limit.ts`, aujourd'hui l'adresse de la connexion) et pour `trustedProxies` de better-auth ; compression des fichiers du web par le build ou par le proxy, selon l'hébergeur.
- **Appareils de l'élève** : l'élève voit ses appareils reliés sur son accueil ; reste à le prévenir sur ses appareils déjà reliés quand un nouvel appareil l'est (date, type d'appareil) ; décider, en concevant l'historique, si un appareil nouvellement relié ne montre que les séances commencées après son jumelage (revue de #425, `etudes/2026-10-07/foyer-eleve-age.md`, § 7).
- **Client web** : mesures sur un vrai iPhone et un Android (`etudes/2026-10-06/client-web.md`).
- **Clever Cloud** (`etudes/2026-10-07/hebergement.md`), à tester sur la préproduction : un tour SSE
  de 60 s à travers Sōzu (délai de 180 s documenté) ; le délai de grâce réel au SIGTERM pendant un
  redéploiement, contre `SHUTDOWN_DEADLINE_MS` (25 s, `src/main.ts`) et un tour de 60 s ; la sonde
  qui ne sert qu'au déploiement, pour `DRAIN_MS` ; le PITR
  (pgBackRest, sur demande au support) et son prix ; la dernière entrée de X-Forwarded-For comme clé
  du rate limit ; le port (3000 dans l'image, 8080 attendu par Clever Cloud : `PORT` ou
  `CC_DOCKER_EXPOSED_HTTP_PORT`) ; Postgres 18.4 chez Clever Cloud contre 18.6 en dev et en CI, à aligner.

### Lot 1 — harnais d'évaluation et observabilité

- **Référentiel** : restent sciences, histoire-géographie et anglais, et le rattachement de leurs exercices.
- **Alignement aux programmes** : ajouter des exercices inspirés des sujets du brevet 2018-2026, écrits pour le jeu (`etudes/2026-10-01/education-nationale.md`, « Conséquences pour Tom », b).
- **Niveau de langue** : avant de le réintroduire, trouver une mesure validée de la lisibilité d'un texte français pour collégiens (`etudes/2026-10-03/analyse-erreurs.md`).
- La file `tom-judge-agreement` de Langfuse reste ouverte jusqu'au 2026-11-02.

### Lot 3 — l'app entre les mains des familles

- **Interface et parcours** : Victor a relevé des défauts importants en testant le staging le 2026-10-08 (connexion, foyer, clés d'accès) ; à reprendre écran par écran avec lui, avec le parcours parent.

- **Après une détresse** : la revue humaine (Victor au départ), son délai et sa trace ; ce que voit l'élève ensuite, et qui lève la fermeture ; une photo seule n'est pas jugée (`etudes/2026-10-07/foyer-eleve-age.md`).
- **Conformité** : mention « vous parlez à une IA » dès la première interaction, consentement conjoint sous 15 ans, AIPD, résumé parent proportionné et connu de l'enfant, aucun lien avec un établissement sans réévaluer le haut risque (`etudes/2026-10-01/education-nationale.md`, c ; `tuteur.md` §11).
- **Message au parent après revue** : le push web n'atteint qu'un parent qui a installé l'app (iOS) ; un message décidé après une détresse demande un canal garanti, l'e-mail par exemple, à décider avec le parcours parent ; une table d'envois à clé unique en tient l'idempotence et la trace (`etudes/2026-10-07/email-transactionnel.md`).
- **Après la V1, primaire et lycée** : modes accompagné et autonome, transition à 15 puis 18 ans (`etudes/2026-10-07/foyer-eleve-age.md`, § 7) ; le primaire attend une mesure de la reconnaissance vocale sur des voix d'enfants français.
- **Voix** : la `Permissions-Policy` interdit le micro ; l'ouvrir à `self` avec l'enregistrement d'un oral. Une seule voix, française (`fr_marie_*`) : décider s'il en faut d'autres pour les cours de langue, et réévaluer la normalisation de la lecture vocale.
- **Langue d'un oral** : la transcription impose le français, et un oral de langue se transcrit mal (« Yes. » bruité devient « Oui. ») ; le client déclare la langue d'un oral de langue et la route la passe à Voxtral.

### Lot 4 — marque et lancement

- **Image Open Graph** : `apps/landing/public/opengraph-image.png`, capturée sur la version Next, porte le nom et le titre en dur ; à refaire avec le nom du produit (revue du portage en Astro).
- **Tests e2e qui gardent l'identité rejetée** (`signs.spec.ts`, graisse des titres dans `type.spec.ts`, place de Tom dans `hero.spec.ts`), et ceux du web (`tooling/playwright-web/tests/home.spec.ts`, nom et couleurs du manifest) : à revoir avec la nouvelle identité.

## Surveillance

Conditions à guetter, sans PR propriétaire tant qu'elles ne se déclenchent pas.

- **Jeton de la CLI Clever Cloud** (`CLEVER_TOKEN`, `CLEVER_SECRET`, environnement GitHub `staging`) :
  il expire le 2027-10-08, un an après sa création ([doc](https://www.clever.cloud/developers/doc/tools/ci-cd/)) ; le
  renouveler avant, sans quoi le déploiement du staging échoue.
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
  `eslint-plugin-boundaries` ; la porte d'audit de la CI ne regarde
  que la production.
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
  tant que le runtime est Node 24 (Node 26 LTS le 2026-10-28).
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
| Scaleway : faits le 2026-10-08, le compte, le projet « TomIA », l'offre Essential, le domaine `mail.tomia.fr` et ses DNS ; restent le moyen de paiement, la vérification d'identité, la 2FA, la clé IAM limitée à Transactional Email, et le domaine « vérifié » dans la console (`etudes/2026-10-07/email-transactionnel.md`). Le domaine définitif suivra le nom du produit | Staging, étape 7 | en cours |
| Clever Cloud : faits le 2026-10-08, l'organisation, le paiement, la 2FA ; le DPA est inclus aux conditions générales (articles 1.3 et 10.2), en garder une copie pour l'AIPD. Restent le jeton de la CLI (`clever login`) en secrets `CLEVER_TOKEN` et `CLEVER_SECRET` de l'environnement GitHub `staging`, et les secrets de l'application (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `MISTRAL_API_KEY`, `SCW_ACCESS_KEY`, `SCW_SECRET_KEY`) | Staging, étape 7 | en cours |
| Vérifier que les anciens comptes Koyeb et le projet Vercel du staging ne facturent plus rien | Hébergement unifié | à faire |
| Secrets `CLEVER_TOKEN` et `CLEVER_SECRET` de l'environnement GitHub `landing` (les mêmes que pour `staging`), sans quoi le job `deploy-landing` échoue | Landing en Astro | à faire |
| Une fois la landing en Astro en ligne chez Clever Cloud : faire pointer le DNS de `tomia.fr` vers elle, vérifier qu'elle répond, puis seulement supprimer le projet Vercel et l'organisation Sentry `home-drx` ; le domaine définitif suivra le nom du produit (`etudes/2026-10-07/hebergement.md`, « Architecture unifiée ») | Landing en Astro | à faire |
| Écrire à la CNIL sur HDS, avec le texte proposé dans `etudes/2026-10-07/hebergement.md` ; la réponse entre dans l'AIPD | Porte avant ouverture | à faire |
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
