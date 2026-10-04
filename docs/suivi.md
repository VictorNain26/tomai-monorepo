# Suivi des travaux

Source de vérité de l'avancement. **À lire en premier en reprenant le travail**, et à
mettre à jour dans la PR qui le fait avancer (PR ouverte ou mergée, étape manuelle faite,
bloquant levé).

- Vision : `vision.md` (pour qui, promesse, preuves, prix).
- Roadmap : `roadmap.md`.
- Specs techniques : `architecture.md`, `agent.md`.
- Études du 2026-10-01 et du 2026-10-02 (alignement sur les programmes, évaluation et
  observabilité, lycée) : `etudes/`. Ce sont des instantanés datés, jamais mis à jour.

## Où on en est

- **Dernière mise à jour :** 2026-10-04.
- **Lot en cours :** 2 — Agent qui ne cède pas, refondu sur sources (`roadmap.md`).
  - Du lot 1 restent la baseline, réduite aux 38 conversations de l'échantillon
    (`etudes/2026-10-04/refonte-agent.md`, « Mesure »), les concurrents et la CI.
  - Le lot 0 est terminé : serveur sur Hono et outillage sur Bun (#343 à #347), refonte du
    serveur en modules (#348 à #354), lint strict (#355) et TypeScript strict (#356).
- **Prochaine action :** refonte de l'agent (lot 2), demandée par Victor le 2026-10-04 ;
  étude `etudes/2026-10-04/refonte-agent.md`, ordre des PR dans `roadmap.md`. Point 3, première
  PR mergée (#383, analyse du tour), deuxième en cours (#384, fiche d'exercice) ; ensuite
  l'analyse de document réduite à une
  extraction. Plan d'abord dans `docs/plans/`.
  - Étape à la charge de Victor avant le point 6 : approuver le texte de la réponse fixe de
    détresse.
  - Une relecture humaine d'une partie des conversations lues par Claude reste due avant
    toute publication (lot 4).
- **PR ouvertes :** #384 (point 3b de la refonte) : revue `/code-review`, corrections, CI, merge ; son plan, `docs/plans/feat-agent-exercise-sheet.md`, se retire dans son dernier commit.
- **Landing en ligne gelée** jusqu'au lot 4 : seuls des correctifs d'honnêteté ou techniques y entrent.
  L'identité visuelle est rejetée et se refait au lot 4.

## Reporté

Constats hors du périmètre de la PR qui les a trouvés. Chacun nomme son lot ; quand le
plan de la PR s'écrit, le point y devient une tâche ou est explicitement renvoyé
(`.claude/rules/plans-and-agents.md`). Chemins relatifs à `apps/server/src/` sauf mention
contraire.

### Lot 1 — harnais d'évaluation et observabilité

- **Référentiel des programmes du collège** (point 3) : chaîne en place dans
  `apps/server/src/referential/` (`bun run referential:extract`) avec les programmes de
  mathématiques et de français de 2025 (6e) et de 2026 (5e, puis 4e en 2027 et 3e en 2028),
  798 entrées ; 1 053 avec les attendus de 2019.
  La 4e et la 3e de 2026-2027 lisent les attendus de fin d'année de 2019 (annexes 15 à 18
  de la note de service n° 2019-072) : le programme de 2020, écrit par cycle et balisé en
  façade seulement, n'est pas extrait. Le jeu de données « Compléments aux programmes du
  second degré » rattache ces annexes aux mauvaises classes (ordre inversé de la 6e à la
  3e, repères décalés d'un cycle) ; l'extraction vérifie la classe sur le texte alternatif
  de l'en-tête de chaque PDF et lit le domaine sur ses bandeaux. En programmation, seuls
  les niveaux attendus en fin de classe sont gardés (1 et 2 en 4e). Les 19 exercices de mathématiques et de français sont
  rattachés à leurs entrées et aux notions des classes suivantes à ne pas mobiliser, prises
  dans le programme en vigueur pour chaque classe en 2026-2027. Deux exercices de 4e du
  protocole relèvent d'attendus de 3e : M4 (double distributivité) et F1 (accord avec un
  COD pronom relatif). Les
  repères annuels de 2019 ne sont pas extraits : les attendus des classes suivantes donnent
  déjà ce qui n'est « pas encore vu ». Reste : sciences, histoire-géographie, anglais, et
  le rattachement de leurs exercices.
- **Métrique « alignement aux programmes »** (`etudes/2026-10-01/education-nationale.md`,
  « Conséquences pour Tom », b) : items rattachés à un objectif du référentiel, aide au
  bon niveau sans notion hors programme, jamais la réponse. Les items propres de la 6e à la
  3e existent (`eval/exercises/`, chacun cite son passage du programme). Reste à
  ajouter des exercices inspirés des sujets du brevet 2018-2026, écrits pour le jeu.
- **Règle de réutilisation** (Victor, 2026-10-02) : Sésamath, sujets d'examen, ressources
  Éduscol et toute autre source se consultent pour s'en inspirer, jamais copiées ; aucun
  texte de tiers n'entre dans le jeu, le référentiel ou le prompt, en dehors des citations
  des programmes officiels.
- **Accord du juge** (point 4) : première mesure le 2026-10-03, annotation par Claude à la
  demande de Victor (`etudes/2026-10-03/accord-juge.md`). Un seul critère d'aide atteint
  α ≥ 0,800 (`gradedHints`), et pas d'un passage du juge à l'autre ; désaccords orientés sur `oneQuestion` (juge plus sévère) et `diagnosis`
  (plus indulgent) ; alignement, fuite rédigée, ton et niveau de langue sans variation
  dans l'échantillon. Une relecture humaine d'un sous-échantillon reste due avant de
  publier une mesure du juge (lot 4) ; la file `tom-judge-agreement` de Langfuse est prête
  pour elle jusqu'au 2026-11-02.
  Reproductibilité mesurée ensuite : le juge, avec graine, change 4 notes sur 189 en trois
  passages ; reproductible sur cinq critères d'aide, et ses désaccords sur `oneQuestion`,
  `accuracy` et `level` sont stables ; non établi sur `diagnosis` et `tone`
  (`etudes/2026-10-03/reproductibilite-juge.md`).
  Avec le juge actuel (Small 4, extraction et code, #375), aucun critère n'atteint
  α ≥ 0,800, le meilleur étant `help_graded_hints` (0,417). La lecture ouverte contredit
  cette annotation sur le diagnostic : elle ne sert plus à régler ce critère.
- **Juge Small 4** (point 4) : mesuré le 2026-10-03 sur l'échantillon d'accord
  (`etudes/2026-10-03/juge-small-4.md`), il ne voit presque pas les défauts de son propre
  modèle. Sur les cas construits, le code repère désormais le calcul faux et la double
  question ; restent au modèle, et faibles, la méthode déroulée (0 ou 1 sur 2) et la
  notion d'une classe suivante (0 sur 2) (`etudes/2026-10-03/extraction-verification.md`).
  Le prompt ne se retouche plus sur un exemple : il s'ajuste sur l'échantillon annoté, en
  mesurant l'accord avant et après. Le cache, qui ne servait que 14 % de l'entrée de
  l'ancien juge, en sert 91 % depuis le préfixe et le schéma communs (#370) ; le juge
  actuel coûte environ 0,2 centime de dollar par conversation (#375). À ce débit (100 000 tokens par minute), juger le jeu
  complet prend plusieurs heures : l'API Batch de Mistral, hors limite de débit et à
  moitié prix, est à étudier pour la baseline (point 5).
- **Questions du juge** (point 4, `etudes/2026-10-04/questions-juge.md`) : rejugement des
  38 conversations.
  - L'exactitude, vérifiée phrase par phrase, trouve 3 des 5 affirmations fausses (aucune
    avant). La moitié de ses fausses alarmes sont des phrases qui donnent la réponse
    attendue ; la consigne le précise désormais, sans mesure : à mesurer au prochain
    passage.
  - `diagnosis-uses` repère les 7 erreurs non exploitées, mais n'a dit « oui » sur aucune
    conversation réelle.
  - `hints-repeats`, qui ne voyait aucune des 3 répétitions jugées, est retirée de la grille.
- **Niveau de langue** (point 4) : ses deux questions au juge sont retirées, faute de
  discriminer (`etudes/2026-10-03/analyse-erreurs.md`). Avant de le réintroduire, chercher
  une mesure validée de la lisibilité d'un texte français pour des collégiens, et la
  mesurer contre une annotation.
- **Évaluations du run dans Langfuse** (point 5) : taux de fuite et moyennes ne restent
  que dans `eval-results/` tant que l'expérience tourne sur des données locales ; un
  dataset hébergé par Langfuse les y enverrait, à décider avec la baseline.
- **Débit Mistral** (point 6) : deux conversations en parallèle déclenchent des
  HTTP 429 sur ce compte (trois conversations coupées sur deux passages) ; le harnais joue
  désormais une conversation à la fois, ce qui allonge le passage en CI.
- En cas d'erreur, le span OpenTelemetry d'un appel IA porte le message d'erreur de
  Mistral, c'est-à-dire le corps de sa réponse : vérifier qu'il ne contient pas de contenu
  d'élève avant de brancher le premier exporteur (Langfuse).

### Lot 2 — agent qui ne cède pas, quotas et coûts

- **Défauts de Tom** (lot 2) : analyse d'erreurs sur 38 conversations
  (`etudes/2026-10-03/analyse-erreurs.md`). 15 ratées :
  - réponse donnée dans 10, dont 4 sur 6 après une explication demandée ;
  - affirmation fausse dans 5, sur des règles de grammaire et un diagnostic ;
  - détresse sans 3114 et retour à l'exercice dans les 3 ;
  - fiches refusées ou ignorées dans 4 sur 6.

  Corrections rangées sous les points du lot 2 de `roadmap.md`, revus le 2026-10-04
  (`etudes/2026-10-04/refonte-agent.md`), l'agent refait comparé à l'avant d'un bloc :
  - point 1 : règle de la réponse jamais donnée, explication demandée au palier d'aide,
    fiches à la demande, portée collège ;
  - point 3 : solution de référence côté serveur, mathjs sur ses calculs ;
  - point 4 : diagnostic de l'erreur avant l'aide, palier tenu par le serveur ;
  - point 5 : contrôle avant l'envoi ;
  - point 6 : détecteur et réponse fixe approuvée par Victor, puis fin de la conversation.
- **Audit de l'agent** (2026-10-04, code du tour de chat), en plus des défauts listés ici :
  - aucun outil ni contexte pour vérifier : ni solution, ni erreur de l'élève, ni programme
    (point 3) ;
  - raisonnement seulement en 4e-3e, maths ou sciences, trois intentions, et sur toute
    réponse proposée depuis #380 (`mistral-reasoning.ts`) : 4 des 5 règles fausses étaient en
    français et en anglais ; il passe à la fiche (point 3).
- **Programme dans le contexte** : les notions de l'exercice, prises dans le référentiel,
  entrent dans la fiche (point 3), plutôt que le programme entier de la matière
  (`etudes/2026-10-04/refonte-agent.md`, « Contexte et mémoire »). Les consignes chiffrées
  sans source de `modules/tutor/prompts/adaptation/by-level.ts` sont retirées (#380).
- **Outil de calcul** (même étude, § 6) : mathjs, déjà adopté par le harnais (#373), pour
  vérifier les calculs de la solution de référence ; sa résolution d'équations et
  l'équivalence restent à lire dans sa documentation avant tout usage.
- **Défauts de coût** relevés par `etudes/2026-10-01/couts.md` sur le code du 2026-10-01 :
  - la synthèse vocale (`/api/tts`, `modules/voice/voice.routes.ts`) n'a aucun quota, seulement le
    rate limit global : c'est le seul poste non borné ;
  - l'outil `generate_flashcards` du chat (`modules/tutor/chat-tools.ts`) n'a ni contrôle
    de plan ni quota de cartes, alors que la route `/api/learning/generate` réserve les
    fiches au Complet ;
  - le résumé de conversation se relance à chaque tour après le 10e
    (`modules/tutor/summarization.service.ts` : le seuil de 10 nouveaux messages se compte
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
  (`.url()`) et `propertyNames` (`z.record`) de `modules/learning/cards-domain.schema.ts` (400, code 3051).
  Revoir ce schéma pour repasser en strict, et unifier au passage les trois définitions des
  types de cartes (enum `card_type`, `modules/learning/card-generation.types.ts`, schémas Zod
  de `cards.schema.ts`).
- **Forfaits absents** : aucune migration ni aucun seed n'insère de ligne dans
  `subscription_plans`. Sur une base neuve, `ensureUserSubscription`
  (`modules/billing/quota.ts`) lève « Free plan not found in database » à chaque fin de
  tour : la consommation n'est jamais comptée au quota (constaté par `bun run eval` le
  2026-10-02). Les insérer par migration avec la correction du quota.
- **Quota** : `needsMonthlyReset` (`modules/billing/quota-config.ts`) passe par `Intl.DateTimeFormat` alors que les bornes du
  jour et de la semaine passent par date-fns. Une seule méthode.
- `modules/voice/speech-normalize.ts` à réévaluer avec la lecture vocale.

### Lot 3 — client web

- **Niveaux** : l'inscription accepte encore les niveaux de la primaire et du lycée
  (`lib/education-levels.ts`), que le chat refuse depuis #380. Les retirer avec les comptes
  du client web.

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
- **Tableaux de bord** : aucun code n'écrit la table `progress`, donc `conceptsLearned` de
  `/api/progress/dashboard` vaut toujours 0 ; l'alimenter ou supprimer table, dépôt et champ
  avec le tableau de bord du client web. La table `parent_restore_token` (bascule rapide du
  mobile) n'est plus lue ni écrite : la supprimer par migration (#353).
- **Facturation** : colonnes `revenuecat_customer_id` et `revenuecat_subscription_id` de
  `family_billing`, enum `billing_status` et commentaires RevenueCat de
  `modules/billing/billing.schema.ts`, restes du mobile, refaits avec le paiement web. Ses
  routes qui ont besoin des enfants ou du lien parent-enfant vont dans `family`, comme
  `/api/subscriptions` : `billing` reste un module feuille, sinon `billing`, `family` et
  `tutor` s'importent en boucle (#354).
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

- **Bun 1.4.2** plante par intermittence sous `bun test --isolate` (« Segmentation fault »,
  « bug in Bun, not your code ») : deux fois sur onze passages en local, puis en CI le
  2026-10-02 (run 37003790891 de #360, trace dans `JSFinalizationRegistry::takeDeadHoldingsValue`).
  Bug déjà suivi chez Bun : oven-sh/bun#44161, ouvert, même trace, aucun correctif ; la
  1.4.2 est la dernière version. En attendant : relancer le job en échec après avoir vérifié
  dans le log que toutes les assertions passent et que la sortie est ce plantage. Monter
  de version dès qu'une release le corrige.
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
| Après le merge de #344 : `rm -rf node_modules && bun install` à la racine du clone local (les `node_modules` actuels viennent de pnpm) | Outillage | à faire |
| Base de dev locale : `bun run setup` (applique les migrations 0028 et 0029, qui suppriment les tables de la liste d'attente et de Pronote ; le doctor signale 28/30) | Outillage | à faire |
| Entretiens de parents : remplacés par la recherche documentaire (`etudes/2026-10-01/parents.md`), décision de Victor le 2026-10-02 ; prix, appareil du soir et canaux restent des hypothèses (`vision.md`, « Questions ouvertes ») | Questions ouvertes de la vision | fait |
| Demander le Zero Data Retention : réservé au paiement à l'usage (« only with pay-as-you-go », [centre d'aide Mistral](https://help.mistral.ai/en/articles/347612-can-i-activate-zero-data-retention-zdr)), or le compte est sur l'offre gratuite (8,50 € d'API inclus par mois, paiement à l'usage désactivé, constaté le 2026-10-02). Activer le paiement à l'usage avec un plafond, puis envoyer la demande avec sa justification (mineurs, RGPD) ; vérifier ensuite Admin › API › Confidentialité. L'entraînement sur les appels API et les modèles Labs y sont désactivés | Porte avant ouverture | à faire |
| Retirer `NEXT_PUBLIC_SERVER_URL` du projet Vercel `tomai-landing` : absente du projet, constaté le 2026-10-02 | Lot 0, liste d'attente | fait |
| Trancher le statut juridique avec un expert-comptable : rester micro-entrepreneur ou créer une SASU (le GAR n'accepte que des personnes morales ; seuils de TVA et de la micro calculés en abonnés dans `etudes/2026-10-01/statut-juridique.md`) | Avant l'ouverture, au démarrage du lot 3 | à faire |
| Vérifier Tom dans le hero sur un iPhone (Safari : salut et respiration sans fond noir) | Landing en ligne | à faire |
| Relecture des 32 exercices : confiée à Claude le 2026-10-02 et outillée (32 citations retrouvées mot pour mot dans leur PDF officiel, 14 sources de réponse en ligne, 14 réponses recalculées par le test) ; un regard pédagogique humain sur un échantillon reste à prévoir avant de publier les mesures | Lot 1, jeu rejouable par un tiers ; lot 4 pour la publication | fait |
| Projet Langfuse « tomai » en région UE (`https://cloud.langfuse.com`, offre Hobby) et ses clés dans `apps/server/.env`, vérifiées par l'API (HTTP 200) le 2026-10-02 | Lot 1, point 2 | fait |
| Espace Mistral « ci » et sa clé `github-actions`, en secret GitHub `MISTRAL_API_KEY_CI` (2026-10-02). Sans paiement à l'usage, la dépense reste bornée par les 8,50 € inclus ; la valeur du secret se vérifie au premier passage en CI | Lot 1, point 6 | fait |
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
  (#350). Module `learning` ; le tuteur lit les signaux de révision par le service du
  module au lieu d'interroger ses tables (#351). Module `tutor` : le classeur de séance
  passe de `documents` au tuteur, la purge RGPD quitte `platform`, et le contrôle de
  migrations de la CI couvre enfin les schémas des modules (#352). Modules `auth` et
  `family` : les comptes élèves passent par `auth`, le tableau de bord parent lit les
  statistiques du tuteur, et le code qui exposait au parent le texte des séances est
  supprimé avec le reste du code mort (#353). Module `billing` : module feuille, les routes
  de statut et d'usage d'abonnement passent dans `family`, et `/api/subscriptions/usage` ne
  révèle plus quels comptes existent (#354). Lint strict : configuration ESLint typée stricte
  partagée, plus aucun `eslint-disable`, `noUncheckedIndexedAccess` activé, image Docker du
  serveur réparée et bâtie en `NODE_ENV=production`, révision FSRS bornée aux quatre notes
  (#355).
  TypeScript strict : toutes les options du profil le plus strict, dont
  `exactOptionalPropertyTypes`, qui a révélé une option better-auth mal typée masquant la
  connexion par identifiant ; premiers tests de `@repo/api` (#356). Lot 0 terminé.
- **2026-10-02** : jeu d'évaluation, 32 exercices de la 6e à la 3e et six scénarios, chaque
  exercice cité contre le programme en vigueur, réponses recalculées ou sourcées (#358).
  Étude de l'alignement sur les programmes, de l'évaluation et de l'observabilité, et du
  lycée ; roadmap refondue : référentiel du collège et observabilité au lot 1, programme
  dans le contexte et outil de calcul au lot 2, lycée après la V1, RAG vectoriel écarté par
  la mesure (#359).
  Exécuteur de l'évaluation : `bun run eval` joue les scénarios par la vraie route de chat,
  détecte la réponse dans le texte, les sorties d'outils et les fiches, et écrit une
  expérience Langfuse ; premiers passages réduits, trois fuites réelles ; forfaits absents
  de `subscription_plans` relevés pour le lot 2 (#362).
  Référentiel des programmes : extraction des annexes balisées du BO par l'arbre de
  structure de pdf.js, fractions et exposants reconstruits et vérifiés à l'œil ; 798
  entrées de mathématiques et de français, 6e de 2025, 5e à 3e de 2026 (#363).
  Attendus de fin d'année de 2019 pour la 4e et la 3e, classe vérifiée sur le PDF malgré
  les liens inversés du jeu de données officiel ; 1 053 entrées (#364). Exercices rattachés
  au référentiel et aux notions des classes suivantes à ne pas mobiliser (#365).
- **2026-10-03** : juge daté (`mistral-medium-2604`), un appel par critère, citations
  vérifiées dans la transcription, fuite rédigée comptée avec la fuite déterministe ;
  premier passage réduit à environ 1 centime par conversation (#366).
  Annotation à l'aveugle et accord du juge : échantillon fixe de 38 conversations, file
  d'annotation Langfuse, α de Krippendorff avec intervalle ; première mesure annotée par
  Claude, un seul critère d'aide au seuil et sans robustesse (#367).
  Juge avec graine et reproductibilité mesurée sur trois passages : 4 notes sur 189
  changent ; reproductible sur cinq critères d'aide (#368).
  Étude de la refonte du harnais, Small 4 pour tout rôle de LLM (#369). Juge Small 4 en
  questions oui/non, cinq tirages, erreur de l'élève en référence, questions critiques en
  sécurité, cache à 91 %, limite de débit ; il ne voit presque pas les défauts de son
  propre modèle (#370). Étude du juge en extraction et vérification (#371).
  Cas construits, une conversation saine et sa version fautive par défaut, pour mesurer ce
  que le juge repère (#372). Le code répond à ce qui se vérifie : égalités écrites
  recalculées par mathjs, questions relevées par Small 4 puis comptées, 3114 cherché dans
  le texte ; calcul faux et deux questions repérés là où le modèle ne les voyait pas, sans
  fausse alarme sur les cas construits (#373).
  Nettoyage du harnais : une table par critère, version du juge calculée sur ce que lit
  son modèle et commit dans chaque sortie, plus de relance cachée hors limite de débit,
  données des études sorties de `src/` (#374).
  Analyse d'erreurs sur les 38 conversations de l'échantillon (#375) :
  - 15 ratées : réponse donnée dans 10, affirmation fausse dans 5, détresse sans 3114
    dans les 3 ;
  - le juge rate les affirmations fausses, dont 3 jamais soumises à `accuracy`, ainsi que
    le retour à l'exercice après la détresse ;
  - corrections du juge puis de Tom décidées sur sources, dans l'ordre de la roadmap.
  Le harnais joue ce que fait la production (#376) :
  - S4 confirme les fiches et demande l'explication au micro ;
  - fuite de S4, fiches créées et question après la détresse répondues par le code ;
  - balises et gabarits comptés ;
  - questions qui ne discriminaient pas retirées.

  Premier passage S4 et S5 :
  - fuite par la voix dans 2 sur 6, et dans les fiches de M1 ;
  - fiches non créées dans 2 sur 6 (un refus, un report) ;
  - détresse sans 3114 dans les 3.
- **2026-10-04** : questions du juge au modèle, puis rejugement des 38 conversations
  (#377) :
  - exactitude vérifiée phrase par phrase dans tous les scénarios : 3 des 5 affirmations
    fausses trouvées, contre aucune ;
  - diagnostic posé contre l'erreur de l'élève : les 7 erreurs non exploitées repérées ;
  - répétition sans progression essayée puis retirée, faute d'en repérer aucune ;
  - puce de liste lue comme un signe moins par le code des calculs, corrigée.

  Épisodes de mémoire limités à l'élève (#378) :
  - le filtre rendait `user_id = $1 and ttl_until IS NULL OR ttl_until > NOW()` : les
    épisodes non expirés de tous les élèves entraient dans le prompt ;
  - trouvé par l'audit de la refonte, testé sur postgres avec deux élèves ;
  - index vectoriel retiré, jamais utilisé par la requête, qui parcourt exactement les
    épisodes de l'élève ;
  - en CI, un test d'intégration échoue au lieu d'être sauté quand la base ne répond pas.

  Refonte de l'agent décidée sur sources (#379) : quatre recherches (conception d'un
  tuteur, Small 4 et AI SDK 7, exactitude et garde-fous, autres appels IA) ; un workflow
  tenu par le serveur (fiche d'exercice, diagnostic, palier, contrat du tour, contrôle avant
  l'élève) ; spec corrigée (`toolApproval` au lieu de `needsApproval`, déprécié ; contrôle
  avant l'élève et non après la génération ; ordre du contexte pour le cache) ; ordre du
  lot 2 revu, deux passages au harnais.
  Point 1 de la refonte, prompt et outils (#380) :
  - prompt réécrit pour le collège, sans ce qui poussait à affirmer ni à dérouler la méthode ;
  - consignes de tour corrigées : la pression ne fait pas monter d'un palier, une réponse
    proposée se vérifie avant tout ;
  - `get_student_profile` et `get_app_help` supprimés, styles d'apprentissage retirés
    (colonne comprise), écriture de profil échouée remontée ;
  - plus de plafond de tokens sur un tour qui raisonne (décision de Victor), et un tour qui
    raisonne sans écrire compte au quota ;
  - une réponse proposée se vérifie en raisonnement, quels que soient la classe et la
    matière, en attendant la fiche (point 3) ;
  - le chat refuse un niveau hors collège, que le prompt ne sert pas ;
  - balises du prompt toutes neutralisées dans le texte de l'élève, vérifié par un test.
  Point 2 de la refonte, première PR, socle du tour (#381) :
  - historique rejoué tel que le modèle l'a produit, raisonnement et appels d'outils
    compris (`messages.model_messages`) ; un appel réel à Mistral accepte le raisonnement
    rejoué en bloc `thinking` (`live/mistral-eu.test.ts`) ;
  - seul le dernier message de la fenêtre garde son raisonnement, pour le coût ; un tour
    coupé, ou qui finit sur un résultat d'outil, se rejoue en texte ;
  - routes de lecture limitées au texte vu par l'élève, sous test ;
  - un seul message `user` par tour, le résumé dans le premier message de la fenêtre ;
  - bloc de la matière dans le message du tour : le prompt système ne change plus d'un tour à
    l'autre.
  Point 2 de la refonte, seconde PR (#382) :
  - outils en mode strict, acceptés par Mistral et remplis par un appel réel ;
  - chaque appel au modèle terminé compte exactement, même si le tour est coupé ensuite ; un
    appel coupé en cours est estimé, et le tour, marqué coupé, ne garde pas les messages du
    modèle ni ne donne de titre ;
  - un tour coupé pendant la création de fiches n'enregistre pas de paquet ;
  - l'usage arrive dans le flux sans `stream_options`, vérifié par un appel réel ;
  - renommages de l'AI SDK 7 : `instructions`, `onEnd`, option `timeout`.
  Point 3 de la refonte, première PR, analyse du tour (#383) :
  - une analyse en sortie structurée stricte remplace le classifieur d'intention : matière,
    nouvel exercice apporté, réponse proposée, demandes de solution, d'explication ou de
    fiches, en booléens sans recopie ; messages longs coupés en tête et en queue ; un appel
    réel vérifie le schéma ;
  - elle donne la consigne du tour, le routage du raisonnement et l'accord pour les fiches :
    `toolApproval` refuse une création que l'élève n'a pas demandée ni acceptée, avec une
    raison transmise au modèle (distincte quand l'analyse a échoué), puis retire l'outil pour
    le reste du tour ;
  - le transcript d'évaluation ne compte plus un appel refusé comme un outil appelé.
