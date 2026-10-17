# Suivi

Où on en est, réécrit dans chaque PR qui fait avancer ; ce qui est fini en sort (git, les PR et
`decisions.md` le gardent). L'ordre : `roadmap.md`.

## Où on en est

- **Mis à jour le** 2026-10-17.
- **La direction se retranche** : Victor doute que le produit ait un public et veut accompagner
  ce que l'IA change à l'éducation. L'étude `etudes/2026-10-17/direction.md` propose « la méthode
  de la maison pour apprendre à l'ère de l'IA » ; Victor tranche ses trois décisions, puis la
  vision se réécrit. D'ici là, le lot 1 et le plan de nettoyage du 2026-10-16 sont en pause
  (`decisions.md`) ; ensuite, une refonte en place.
- **La refonte du produit** (`decisions.md`, 2026-10-12 ; `etudes/2026-10-12/refonte-produit.md`) :
  la vision, les décisions et la roadmap réécrites ; les anciens lots 1 à 3 forment le lot 1,
  « Le produit » ; les espaces et les écrans visés sont dans `experience.md`.
- **Lot en cours : 1, le produit, étape 2** : la direction « Rive » est choisie (`decisions.md`,
  `charte.md`), le plan du lot tiré des pratiques des métiers (`roadmap.md`,
  `etudes/2026-10-12/bonnes-pratiques.md`). Les tokens Rive (2.1) sont dans le site et l'app :
  échelles générées par Leonardo, rôles, graphiques, mouvement, Bricolage Grotesque et Atkinson
  Hyperlegible Next. Les composants de `@repo/ui` (2.3) sont là, sur Base UI, sous une CSP
  stricte (`decisions.md`) : la coquille, section, liste,
  carte, état vide, squelette, bandeau, dialogue et tiroir, toast, graphique en barres, montrés
  par le catalogue `/catalogue` de l'app ; les écrans existants les prennent au lieu de leurs
  copies, champs de formulaire compris. La qualité (2.2) est la définition de « fini » d'un
  écran, vérifiée dans Chrome avant chaque merge : les suites Playwright sont supprimées
  (`decisions.md`, 2026-10-16). Reste 2.4, le logo et Tom en 2D. L'essai
  de Rive est sur la branche locale `da2/rive`, jamais poussée : une référence pour le hero du
  site, pas un code à reprendre ; sa composition des écrans n'est pas retenue.
- **Déjà construit**, aux couleurs de Rive mais sans composition : le nom Catiche dans
  l'app ; l'entrée du parent (code, clé d'accès, prénom) ; l'ajout d'un enfant, une question par
  écran ; la fiche de l'enfant ; le profil de l'élève dans l'en-tête et « Qui utilise Tom ? » avec
  chaque enfant que l'appareil tient ; le jumelage des deux côtés ; en 4e et 3e, plus d'ouverture
  de l'espace de l'enfant par le parent ; le mode accompagné, la séance, la photo, le résumé de la
  semaine. Ces flux, leurs tests et leur sécurité restent ; leur habillage se refait aux étapes 3
  et 4 du lot 1, et « Qui utilise Tom ? » y devient « Qui utilise Catiche ? » (`experience.md`).
- **Sans test automatique depuis le 2026-10-16** (suites Playwright supprimées, `decisions.md`) :
  les parcours dans un navigateur (entrée par code et par clé d'accès, foyer, jumelage, séance,
  photo, mémoire, semaine), la CSP sans violation dans un navigateur, le rechargement après un
  déploiement, la PWA et son service worker, les composants de `@repo/ui` rendus (cibles de
  44 px, clavier, défilement horizontal) ; pour la landing, le rendu sans JavaScript et sous
  mouvement réduit, la mise en page, et ce que répondent les en-têtes, redirections et 404 du
  `Caddyfile`. Restent les tests Bun du serveur, de `apps/web/src/lib` et des tokens, le
  `Caddyfile` validé en CI par le Caddy de Clever Cloud (job `check`), et la vérification dans
  Chrome avant chaque merge, puis au staging. L'âge d'un élève se compte d'une seule façon, que
  le web prend au serveur (`@repo/server/student-age`).
- **Lot 4 en attente** : le harnais `bun run eval` est mergé ; son passage unique attend le
  paiement à l'usage de Mistral (bloquant ci-dessous). Le premier essai s'est arrêté à 3
  conversations sur 104 et ne compte pas comme mesure. Référence de comparaison : 11 fuites sur
  106, le 2026-10-06 (`etudes/2026-10-06/passage-de-fin.md`, données dans
  `etudes/2026-10-06/donnees/results.json`).
- **En ligne** : le staging, https://staging.tomia.fr, déployé à chaque merge ; la landing,
  https://tomia.fr, qui ne change qu'avec la nouvelle identité (lot 1, étape 3) ou par un
  correctif d'honnêteté ou technique ; elle n'a pas encore de lien vers l'app.
- **PR ouvertes** : `gh pr list`.

## Bloquants

| Bloquant | Effet | Comment lever |
|---|---|---|
| Mistral en mode gratuit : 100 000 tokens par minute, une fiche d'exercice en prend environ 78 000 | Le harnais et deux élèves dans la même minute voient la fiche échouer | Le paiement à l'usage, que Victor reporte au lot 4 (2026-10-11) ; puis relire Admin › Limites |
| Zero Data Retention non accordé | Mistral peut garder textes et audio d'élèves | Ouvert seulement en paiement à l'usage ([centre d'aide](https://help.mistral.ai/en/articles/347612-can-i-activate-zero-data-retention-zdr)) ; sa recevabilité est demandée au support (ticket « legal request/GDPR » du 2026-10-11) |
| Clause des mineurs de Mistral (2.2(c), version du 2026-09-25) | Aucun utilisateur réel de moins de 15 ans | Réponse écrite de Mistral, demandée le 2026-10-11 dans le même ticket ; réponse attendue par e-mail |
| La marque TOM ([FR 4873204](https://data.inpi.fr/marques/FR4873204)), en vigueur en classes 9, 41 et 42 | Tout nom de produit bâti sur Tom, et peut-être Tom comme mascotte | Avis d'un conseil en propriété industrielle (`etudes/2026-10-11/nom.md`) |

## À faire par Victor

- **Catiche** : acheter catiche.fr et catiche.app ; une recherche de similarité INPI, puis le
  dépôt de la marque (classes 9, 41 et 42) ; des identifiants Instagram et TikTok (@catiche est
  pris) ; l'avis d'un conseil en propriété industrielle sur Tom face à la marque TOM.
- **Mistral** : lire la réponse du support (ticket du 2026-10-11) ; au lot 4, activer le paiement
  à l'usage avec un plafond, demander le Zero Data Retention, vérifier Admin › API ›
  Confidentialité.
- **CI** : le secret `CLAUDE_CODE_OAUTH_TOKEN` (`claude setup-token`) et l'application GitHub
  Claude sur le dépôt, pour `.github/workflows/claude.yml` ; supprimer les secrets
  `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY_CI` et `SEMGREP_APP_TOKEN`, que rien n'utilise (CodeQL, en
  configuration par défaut, remplace Semgrep).
- **Comptes à fermer** : le projet Vercel et l'application GitHub Vercel (son check échoue sur
  chaque PR), l'organisation Sentry `home-drx`, le projet Langfuse « tomai » ; vérifier que Koyeb
  ne facture plus rien ; supprimer les secrets de dépôt `KOYEB_API_TOKEN` et `DATABASE_URL`.
- **Sécurité des comptes** : la double authentification d'OVH, qui tient le domaine ; chez
  Scaleway, ce qui reste (moyen de paiement, vérification d'identité, double authentification).
- **CNIL** : écrire sur l'hébergement de données de santé, avec le texte de
  `etudes/2026-10-07/hebergement.md` ; garder une copie du DPA de Clever Cloud pour l'AIPD.
- **Dependabot** : classer `inaccurate` les alertes rattachées à `apps/ai-service/uv.lock` et
  `apps/curriculum/uv.lock`, supprimés en `8f5011f`, et signaler le bug au support GitHub.
- **Vérifications** : Tom dans le hero sur un iPhone (Safari, sans fond noir) ; un e-mail à
  contact@tomia.fr depuis une autre adresse que Gmail ; les plugins Claude Code à jour
  (`claude plugin marketplace update`, puis `claude plugin update <nom>`).

## Reporté

Constats hors du périmètre de la PR qui les a trouvés, rangés par moment ; le plan de la PR
concernée les reprend (`.claude/rules/plans-and-agents.md`).

**Avant le premier élève réel**
- Bugsink auto-hébergé, avec sa base, environ 10 à 12 € HT par mois ; les erreurs des navigateurs
  par le serveur (`tunnel`), sans contenu d'élève (`etudes/2026-10-07/hebergement.md`).
- La base du staging, joignable depuis internet : la placer dans un réseau privé Clever Cloud
  ([Network Groups](https://www.clever.cloud/developers/changelog/2026/05-12-network-groups-console)).
- Clever Cloud à éprouver : un tour long à travers le proxy (délai documenté de 180 s), le délai
  de grâce réel au SIGTERM contre `SHUTDOWN_DEADLINE_MS`, la sonde pour `DRAIN_MS`, le PITR et son
  prix, Postgres 18.4 chez eux contre 18.6 en dev et en CI.
- Les durées de conservation que la politique de confidentialité annonce pour l'ouverture
  (`apps/landing/src/pages/confidentialite.astro`, § 7) : aucune purge ne tient encore celles du
  compte inactif ni des journaux.
- L'adresse de la connexion, que `clientAddress` (`platform/http/client-address.ts`) lit par
  `getConnInfo`, n'est exercée par aucun test, faute d'un vrai `Bun.serve` : `addressOf` l'est
  (`client-address.test.ts`), le middleware aussi, sous `app.request` (`rate-limit.test.ts`).
- Le préfixe `__Host-` des cookies, quand better-auth le livre
  ([#10806](https://github.com/better-auth/better-auth/issues/10806)).

**Lot 1, le produit**
- Les formules de Tom : sur Chrome de bureau, chaque formule montre des flèches de défilement
  vertical, son conteneur (`[&_.katex]:overflow-x-auto`, `components/tom-text.tsx`) débordant de
  6 px en hauteur ; vu le 2026-10-11, KaTeX 0.16 comme 0.19.
- Mémoire : les 1 053 libellés du référentiel restent ceux du programme (« Il utilise… »),
  présentés « Au programme » ; leur réécriture dans les mots de l'élève demande une relecture
  de Victor entrée par entrée, avant la bêta fermée.
- Résumé de la semaine : son arrêt à la demande de l'élève, avec le consentement (le point
  hebdomadaire par e-mail au parent est décidé, `decisions.md`).
- Appareils de l'élève : le prévenir quand un nouvel appareil est relié.
- Client web : mesures sur un vrai iPhone et un Android.
- Le réglage « Lecture aérée » (`charte.md`, `experience.md`).
- Le site, à l'étape 3 : sa composition sur la charte (il porte déjà les tokens) ; ses annotations
  d'école (surligneur, gribouillis) à repenser ; la note « c'est toi qui l'as trouvé ! », qui
  célèbre et finit par un point d'exclamation, contre la charte ; l'image Open Graph composée ;
  une application de preview par PR.
- Le paiement, avec son fournisseur : la politique de confidentialité
  (`apps/landing/src/pages/confidentialite.astro`) reprend alors la facturation (données, base
  légale, conservation).
- Aux étapes 3 et 4, avec les écrans : les séances, appareils, clés d'accès et notions qui
  résistent passent déjà par `List` ; restent en cartes les notions de `/memoire` (leur ligne
  « Au programme » et leur bouton) et les enfants du foyer, à trancher avec leur composition.

**Lot 4, Tom**
- Tom qui se dit programme : un scénario où l'élève demande s'il est humain ou parle de lui ; la
  grille de Victor a quatre questions, une cinquième se décide avec lui avant le passage.
- Référentiel : sciences, histoire-géographie et anglais ; des exercices inspirés des sujets du
  brevet (`etudes/2026-10-01/education-nationale.md`).
- Niveau de langue : trouver une mesure validée de la lisibilité d'un texte français pour
  collégiens avant de le réintroduire.
- Le juge : l'échantillon d'accord et les cas construits de l'ancien juge sont supprimés ; ils se
  récupèrent dans git (`apps/server/src/eval/`, avant le 2026-10-08) si le nouveau juge en a
  l'usage.
- Après une détresse : la revue humaine, son délai et sa trace ; ce que voit l'élève ensuite ; le
  canal du message au parent (`decisions.md`, « Ouvertes »), avec une table d'envois idempotente.
- Voix : le micro, que la `Permissions-Policy` du serveur ferme
  (`platform/http/security-headers.ts`), à ouvrir à `self` ; la transcription impose le
  français, un oral de langue déclare sa langue ; le site ne la promet qu'une fois qu'elle marche
  (`apps/landing/src/components/sections/how-it-works.astro`).

## Surveillance

Conditions à guetter, sans PR tant qu'elles ne se déclenchent pas.

- **Jeton de la CLI Clever Cloud** : il expire le 2027-10-08 ; le renouveler avant.
- **Taux de Mistral** (`MISTRAL_USD_TO_EUR`, 0,85 le 2026-10-06) : le revérifier à chaque
  facture ; un écart change chaque coût et chaque quota.
- **Configuration des agents** : élagage mensuel, le prochain le 2026-11-02.
- **TypeScript** figé à 6.0 tant que `typescript-eslint` exige `<6.1.0` ; TypeScript 7 pas avant ;
  `typescript-eslint` 8.71 active `no-unsafe-enum-assignment`. `@types/node` 24 pour les builds
  Node 24 du web et de la landing.
- **Bun 1.4.2** plante parfois sous `bun test --isolate` (oven-sh/bun#44161) : guetter un
  « Segmentation fault » en CI.
- **Override de `source-map-js`** (GHSA-68fv-2mgg-jv7q) : le retirer quand `postcss` et
  `@tailwindcss/node` déclarent 1.2.2 ou plus.
- **`@hono/bun`** : adoption faible ; la revérifier avant Hono v5.
- **Catalogs Bun** : les remettre quand renovatebot/renovate#42909 est fusionnée.
- **Bun.SQL** : écarté pour ses bugs de corruption ouverts ; réévaluer quand ils sont fermés.
