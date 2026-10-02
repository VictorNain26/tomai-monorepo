# Aligner Tom sur les programmes, mesurer et observer : état au 2 octobre 2026

Étude demandée par Victor : partir du besoin, sans reprendre les décisions passées, choisir
les outils, et dire si le lycée entre dès maintenant. Chaque fait cite sa source ou la
mesure faite le 2026-10-02 ; ce qui n'a pas été vérifié est dit. Cinq recherches en lecture
seule (programmes en vigueur, extraction et sélection, évaluation, sources de cours et de
méthodes, lycée) et les mesures ci-dessous.

Les pages HTML d'education.gouv.fr et d'Éduscol renvoient 403 aux robots : les textes ont
été lus dans leurs PDF, dans des captures web.archive.org datées, ou sur Légifrance.

## 1. Le besoin

Tom aide un collégien sans faire l'exercice à sa place, et on n'affirme que ce qu'on peut
prouver (`vision.md`). Être « cohérent avec l'Éducation nationale » se décompose ainsi :

1. **Le bon périmètre.** L'aide n'emploie que les notions et méthodes du niveau de
   l'élève. Exemples vérifiés dans les textes en vigueur en 2026-2027 :
   - en 6e, « la technique du "produit en croix" n'est pas enseignée » (programme de
     mathématiques du cycle 3, BO n° 16 du 17 avril 2025) ;
   - Thalès en configuration papillon relève de la 3e, les triangles emboîtés de la 4e
     (repères annuels de mathématiques du cycle 4) ;
   - la double distributivité est placée en 3e par ces mêmes repères ;
   - le present perfect n'entre en 4e qu'en 2027 (programme d'anglais du collège, BO
     n° 22 du 29 mai 2025).
2. **La bonne version.** Les programmes changent par classe et par rentrée : en
   2026-2027, ceux de 2025 en 6e, de 2026 en 5e pour le français et les mathématiques,
   de 2020 en 4e et 3e ; la 4e bascule en 2027, la 3e en 2028
   (`etudes/2026-10-01/education-nationale.md`, § 1).
3. **Le bon libellé et les bonnes méthodes.** Les mots, notations et méthodes de la classe,
   pas une paraphrase ni une méthode d'un autre système scolaire.
4. **L'exactitude.** Ce que Tom affirme, et ce qu'il valide dans la réponse de l'élève,
   est juste.
5. **Une langue adaptée à l'âge.**
6. **Ne pas régresser, et s'améliorer.** Chaque changement de l'agent est mesuré avant
   d'être gardé, et la production signale ce qui se dégrade.
7. **La preuve.** « Aligné sur les programmes » est interdit sur la landing tant que la
   métrique n'est pas publiée (`suivi.md`, « Lot 4 »).

## 2. Ce que fait Tom aujourd'hui

Lu dans le code de `main` le 2026-10-02 :

- **Niveau** : `modules/tutor/prompts/adaptation/by-level.ts` envoie un bloc par cycle.
  5e, 4e et 3e reçoivent le même bloc, qui cite « Pythagore, Thalès » : un élève de 5e
  reçoit les notions de 4e et de 3e. Les consignes chiffrées (« Phrases de 15-20 mots »,
  « 4-5 éléments ») ne citent aucune source précise, et la règle « PAS de variables (x,
  y) » du cycle 3 n'est pas vérifiée contre le programme de 2025.
- **Programme, cours, méthodes** : rien n'est donné à l'agent ; tout vient du modèle.
- **Exactitude** : aucun outil de calcul ; le prompt demande de « vérifier le résultat »
  (`by-subject.ts`). Outils du chat : `generate_flashcards`, `get_student_profile`,
  `update_student_profile`, `get_app_help`.
- **Matière** : le classifieur d'intention la détecte déjà (`intent-classifier.service.ts`).
- **Observabilité** : l'AI SDK émet des spans OpenTelemetry sans contenu d'élève
  (`recordInputs: false`, `recordOutputs: false`), exportables en OTLP
  (`platform/observability/otel.ts`), mais aucun outil ne les reçoit. Sentry reçoit les
  erreurs ; seul le tour de chat écrit dans `cost_tracking`.
- **L'ancien RAG** (supprimé en #294) indexait un corpus de programmes dans Qdrant avec
  des embeddings BGE-M3 et une ingestion en Python. Jamais déployé, donc jamais mesuré :
  son retrait ne dit rien de l'utilité d'ancrer Tom dans le programme.

**Constat** : les besoins 1 à 3 ne sont pas couverts, le 4 repose sur le modèle seul, le
5 sur des consignes non sourcées, le 6 sur rien.

## 3. Ce qu'on peut savoir, et ce qu'on ne peut pas avoir

**Le programme n'est pas un cours.** Il fixe des objectifs, pas des leçons. Aucune source
ne donne des cours complets, à jour et réutilisables dans un produit payant :

| Source | Couverture | Licence, usage commercial |
|---|---|---|
| Programmes publiés au BO | Objectifs de chaque classe | Textes réglementaires : domaine public selon la jurisprudence française (note de recherche de la CJUE, [2025-01](https://curia.europa.eu/site/upload/docs/application/pdf/2025-01/ndr_protection_par_le_droit_dauteur_des_textes_officiels_et_des_normes_techniques-fr.pdf), § 5-8) |
| Éduscol, « Exemples pour la mise en œuvre des programmes » 2025-2026 (maths cycle 4 : 51 p.), livret maths 6e, attendus et repères de 2019, guide « Résolution de problèmes mathématiques au collège » (2021, 213 p.) | Documents pour l'enseignant : attendus, notations, exemples, séquences ; pas de leçon pour l'élève | etalab-2.0 hors contenus de tiers (mentions légales Éduscol, capture du 2026-07-02 ; c'était CC BY-NC 4.0 avant mars 2026 : garder la preuve datée de chaque téléchargement) |
| « La grammaire du français. Terminologie grammaticale » (Éduscol, 2021) | Terminologie et notations de référence jusqu'au lycée | etalab-2.0 |
| Sésamath : cahiers 6e (2025) et 5e (2026) à jour ; manuels 4e, 3e et lycée sur les anciens programmes ; cahier 4e annoncé pour 2027 | Mathématiques seulement : cours résumés, méthodes, exercices | CC BY-SA 2.0 FR et GNU FDL, usage commercial permis, partage à l'identique ([FAQ](https://manuel.sesamath.net/?page=faq)) |
| Lelivrescolaire.fr, manuels libres de la région Île-de-France, Khan Academy, Lumni, annales de l'APMEP, Édubase | Plusieurs disciplines | Non commerciales, ou réutilisation interdite (Lumni s'oppose explicitement à l'entraînement d'IA) : **exclues** |

**Conclusion.** Pour les mathématiques de 6e et de 5e, on peut s'appuyer sur des textes à
jour. Partout ailleurs, Tom s'appuie sur ce que sait le modèle. On ne peut donc pas être
« sûr d'avoir tous les cours » ; on peut, en revanche, **mesurer** que Tom reste dans le
programme et ne se trompe pas, sur un jeu construit à partir des textes officiels. C'est le
rôle du harnais, et ce n'est pas une option.

**Points juridiques ouverts** : la portée du partage à l'identique de Sésamath sur un texte
généré qui s'en inspire ; le statut des sujets d'examen hébergés sur education.gouv.fr,
dont les mentions légales exigent une licence pour un usage commercial alors que la
jurisprudence range les sujets d'examen dans les textes officiels. Avis d'un juriste avant
d'afficher un contenu qui en vient ; rien n'empêche de s'en servir pour **évaluer**.

## 4. Donner le programme à l'agent

### Taille mesurée du corpus

Annexes téléchargées le 2026-10-02 (HTTP 200), texte extrait par `pdftotext` :

| Texte | Pages | Mots |
|---|---|---|
| Mathématiques cycle 4, 2026 (5e, 4e, 3e) | 20 | 10 928 |
| Français cycle 4, 2026 (5e, 4e, 3e) | 19 | 12 337 |
| Mathématiques cycle 3, 2025 (CM1, CM2, 6e) | 28 | 18 317 |
| Programme du cycle 4 de 2020, toutes disciplines | 139 | 63 716 |

Pour un couple (niveau, matière), le programme tient en quelques milliers de mots.

### Options

- **RAG vectoriel.** Il sert quand le corpus ne tient pas dans le contexte. Ici, il
  tient : la recherche n'ajouterait que des erreurs de rappel et une infrastructure.
  **Écarté, pour cette raison de taille.** Il ne redevient pertinent que pour chercher
  dans un corpus trop grand pour le contexte (manuels entiers, toutes classes confondues).
- **Classer chaque tour vers un objectif précis.** Sur 385 standards du Common Core, le
  meilleur pipeline publié atteint 31,3 % de correspondance exacte
  ([BEA 2026](https://aclanthology.org/2026.bea-1.15/)) ; les LLM confondent les standards
  voisins ([MathFish, EMNLP 2024](https://aclanthology.org/2024.findings-emnlp.323/)).
  **Écarté au moment du tour** ; utile hors ligne pour étiqueter les conversations du
  harnais.
- **Injecter tout le référentiel du couple (niveau, matière).** Déterministe. Constant
  pendant la séance : placé après le système statique, il est relu depuis le cache à partir
  du 2e tour, à 10 % du prix d'entrée (`etudes/2026-10-01/couts.md`). Pour N tokens, le
  coût est N × 0,165 $ par million au premier tour (0,15 $ × 1,1 pour l'endpoint UE), puis
  N × 0,0165 $ par million ; pour N = 10 000 : 0,165 centime, puis 0,0165 centime par
  tour. N se mesure au tokenizer Tekken à l'extraction. **Retenu.**

### Recommandation

1. Injecter, pour la matière de la séance, les objectifs et automatismes du niveau avec
   leur libellé exact, les notations de la classe (terminologie grammaticale en français),
   et les intitulés des sous-thèmes des niveaux suivants sous la mention « pas encore
   vus ». Sans matière connue, ne rien injecter.
2. Prérequis : le quota compte aujourd'hui les tokens en cache au prix plein (`suivi.md`,
   « Lot 2 ») ; le corriger d'abord, sinon le bloc consomme la fenêtre gratuite.
3. Garder seulement si le harnais le justifie : même jeu, avec et sans injection,
   comparaison appariée sur la fuite et sur l'alignement.
4. Réécrire `by-level.ts` à partir du référentiel, par niveau et non par cycle ; retirer les
   consignes chiffrées sans source.

## 5. Construire le référentiel

- **Source** : les annexes de programme sont des PDF balisés (`pdfinfo` : « Tagged:
  yes » pour les quatre annexes du collège et cinq annexes du lycée testées) ; les BO
  complets ne le sont pas, il faut partir des annexes. L'arbre de structure de l'annexe de
  mathématiques sépare domaines, niveaux, sous-thèmes, automatismes et objectifs (21 titres
  H1, 58 H2, 58 H3, 215 éléments de liste).
- **Extraction** : lire cet arbre avec pdf.js, déjà présent via `unpdf` (v1.8.1 du
  2026-08-13, MIT ; pdf.js v6.3.289 du 2026-08-29, Apache-2.0, 54 k étoiles ;
  `page.getStructTree()` et `getTextContent({ includeMarkedContent: true })` existent dans
  [les types de pdfjs-dist](https://unpkg.com/pdfjs-dist@6.3.289/types/src/display/api.d.ts)).
  Déterministe, libellé exact, numéro de page, sans nouvelle dépendance ni Python.
- **Piège vérifié** : les formules disparaissent de la couche texte. Ligne extraite de
  l'annexe de mathématiques : « Entretenir l'écriture décimale des fractions simples comme
  ; ; ; ; ; ; ; ; . ». Ces objectifs se complètent à la main à la relecture ; Mistral
  OCR 4.1 (`mistral-ocr-4-1`, 4 $ pour 1 000 pages, [doc](https://docs.mistral.ai/models/ocr-4-1))
  sert de contrôle croisé sur ces pages, pas de source, car il génère son texte.
- **PDF non balisé** : Docling (MIT, v2.132.0 du 2026-10-01, 68 k étoiles), en script
  hors ligne.
- **Format** : un JSON par texte officiel, versionné dans git, validé par Zod, chargé en
  mémoire. Clé d'entrée : niveau, puis **enseignement** et non simple matière, pour que
  « mathématiques, spécialité de première » ou « droit-économie, STMG » entrent plus tard
  sans refonte. Identifiants stables ; NOR, BO, SHA-256 du PDF et page par entrée. Le diff
  de la PR compare deux BO et porte la relecture humaine. Pas de table en base.
- **Textes de 2020** (4e, 3e) : écrits par cycle. En mathématiques et en français, les
  repères annuels de 2019 situent la notion par classe ; ailleurs, l'entrée reste au
  niveau du cycle, et c'est dit.
- **Standards** : CASE (1EdTech) sert de vocabulaire de conception ; ScoLOMFR ne couvre
  pas les programmes de 2026. Aucun n'est consommé par un tiers aujourd'hui.

## 6. Exactitude

Un outil de calcul côté serveur vérifie une réponse numérique ou algébrique de l'élève
avant que Tom la valide (principe P1 d'`agent.md`).

| Brique | Version, date | Adoption | Licence | Note |
|---|---|---|---|---|
| mathjs | 15.2.0, 2026-04-07 ; dernier commit 2026-08-10 | 4,5 M téléchargements par semaine, 15 k étoiles | Apache-2.0 | calcul numérique, simplification |
| Compute Engine (cortex-js) | 0.146.0, 2026-10-02 | 320 k par semaine, 478 étoiles | MIT | lit le LaTeX, que Tom écrit déjà en KaTeX |
| nerdamer, Algebrite | dernières versions en 2021 | — | MIT | échouent au critère de maintenance |

**Non vérifié** : la résolution d'équations et le test d'équivalence de ces deux briques
sur des cas de collège ; à lire dans leur documentation et à tester sur le jeu avant de
choisir.

## 7. Langue adaptée à l'âge

- Pas de formule de lisibilité comme note : Kandel-Moles obtient un F1 de 0,25 sur neuf
  niveaux scolaires ([LREC 2022](https://aclanthology.org/2022.lrec-1.130.pdf)) ; ces
  formules sont instables sur des textes courts
  ([PMC12919665](https://pmc.ncbi.nlm.nih.gov/articles/PMC12919665/)). Aucune
  bibliothèque JavaScript française maintenue.
- Un critère du juge, « adapté au niveau », sur trois crans avec un exemple par niveau,
  calibré sur la relecture humaine.
- Deux signaux suivis sans notation : mots par phrase, part de mots hors des plus
  fréquents de [Lexique](https://lexique.org/) (CC BY-SA 4.0).

## 8. Évaluation et observabilité

Objectif : qu'aucun changement ne fasse régresser Tom sans qu'on le voie, et que la
production dise où l'améliorer, sans jamais sortir un texte d'élève.

### Outil

**Langfuse** pour les jeux, les expériences, les traces et l'annotation humaine : cœur
sous MIT, v4.50.0 du 2026-10-02, 35 k étoiles ; SDK `@langfuse/client` 5.11.1 (5,6 M
téléchargements par mois). Datasets, expériences et files d'annotation sont inclus en
auto-hébergement ([doc](https://langfuse.com/pricing-self-host)). Région UE du cloud en
Irlande ; l'auto-hébergement demande au moins 4 cœurs et 16 Gio.

Écartés : promptfoo (doublon ; racheté par OpenAI le 2026-03-09) ; Evalite, Ragas,
openai/evals (critère de maintenance) ; DeepEval, Inspect AI (Python d'abord) ;
`langfuse/experiment-action` (16 étoiles, critère d'adoption).

### Hors ligne : le harnais

- `bun run eval` rejoue les scénarios du jeu (`apps/server/src/eval/`) contre l'agent
  avec `langfuse.experiment.run` ([doc](https://langfuse.com/docs/evaluation/experiments/experiments-via-sdk)) :
  évaluateurs par item (fuite déterministe, juge), évaluateurs du run (taux, vote
  majoritaire, McNemar).
- Entrées et sorties enregistrées **seulement** ici, sur des données de test.
- **Juge** : appel Mistral par l'AI SDK avec un schéma Zod, prompt et date dans git.
  Grille du protocole rapprochée de MRBench (accord humain κ = 0,71,
  [arXiv 2412.09416](https://arxiv.org/abs/2412.09416)) ; alignement par une rubrique propre
  à chaque exercice, comme TutorBench ([arXiv 2510.02663](https://arxiv.org/abs/2510.02663)) :
  objectif du référentiel, notions permises, notions interdites, chaque critère en oui ou
  non. Accord juge-humain : α de Krippendorff d'au moins 0,800 pour conclure.
- **Baseline approuvée commitée** : verdict par cas, versions du jeu et du juge.
  Recommandation de Langfuse pour la CI
  ([doc](https://langfuse.com/docs/evaluation/experiments/experiments-ci-cd)) : un cas qui
  passait et qui échoue fait échouer le run.

### En CI : le garde-fou de non-régression

- Un workflow sur les PR qui touchent l'agent (prompts, module `tutor`, `platform/ai`,
  jeu d'évaluation) lance le harnais et échoue sous la baseline. Clé Mistral dédiée, dans
  un espace à plafond propre (plafonds par espace : `couts.md`).
- **Budget, estimation** : le jeu actuel fait environ 360 tours d'élève (S1 : 32 × 4 ;
  S2 : 32 × 1 ; S3 : 32 × 5 ; S4 : 6 × 3 ; S5 : 3 × 3 ; S6 : 5 × 2). Avec 6 000 tokens
  d'entrée et 300 de sortie par tour, hypothèses à mesurer au premier run, une passe coûte
  environ 0,40 $ sans cache, juge non compris ; trois répétitions, environ 1,30 $. Le
  plafond actuel du compte, 10 € par mois, ne tient pas une passe complète à chaque PR :
  passe complète sur les PR de l'agent, à relever si le rythme l'exige.

### En production : l'observabilité sans contenu

- Exporter les spans existants vers Langfuse UE : endpoint OTLP `/api/public/otel`, HTTP
  seulement, authentification Basic
  ([doc](https://langfuse.com/integrations/native/opentelemetry)) ; ou
  `@langfuse/vercel-ai-sdk` (5.11.1, pour l'AI SDK v7, 334 k téléchargements par semaine).
  Avant : vérifier que le span d'erreur ne porte pas de texte d'élève (`suivi.md`,
  « Lot 1 »).
- Métriques par tour, sans contenu : latence, tokens, part en cache, coût, outils appelés,
  blocages de modération, et le **verdict du contrôle de fuite en ligne** (lot 2), qui
  donne le taux de fuite de production sans stocker un message.
- Plus tard, avec le client web : un retour de l'élève, « ça m'a aidé » ou non, comme
  score.

### La boucle d'amélioration

Signal de production (compte, jamais texte) → hypothèse → scénario **synthétique** qui
reproduit le cas, ajouté au jeu → changement → harnais contre la baseline → merge
seulement sans régression → nouvelle baseline approuvée.

## 9. Le lycée

Mesuré le 2026-10-02 :

- **Volume** : environ 52 couples (niveau, enseignement) en voie générale, 40 à 45 en voie
  technologique, 40 pour les matières générales de la voie professionnelle, plus un
  référentiel par spécialité professionnelle (près d'une centaine de bacs pro, environ 200
  CAP). Les BO bruts font environ 2 400 pages ; le collège, quelques dizaines de couples.
- **Textes qui bougent** : nouveaux programmes de mathématiques au BO n° 14 du 2 avril
  2026, en seconde et en première dès 2026-2027, en terminale en 2027-2028 ; langues
  vivantes en première et terminale en 2026-2027 ; EMC en terminale en 2026-2027.
- **Examens** : épreuve anticipée de mathématiques en première, 2 h sans calculatrice,
  coefficient 2, depuis 2025-2026 (BO n° 24 du 12 juin 2025).
- **Élèves** : 70,7 % en voie générale et technologique, 29,3 % en voie professionnelle
  (DEPP, rentrée 2025). Spécialités de première : maths 66,0 %, physique-chimie 45,6 %,
  SES 45,2 %, SVT 40,1 % (DEPP, NI 26.06). Une vingtaine de couples couvre l'essentiel des
  lycéens.
- **Cours** : aucun cours de lycée à jour sous licence commerciale ; Sésamath lycée
  précède le programme de 2026.

**Avis : pas dans la V1.** Le coût n'est pas l'extraction, qui est la même chaîne ; c'est
la relecture humaine de chaque couple, un jeu d'évaluation par couple, et la preuve
publiée avant d'affirmer quoi que ce soit. Ouvrir le lycée multiplierait par quatre ou cinq
ce travail avant même d'avoir prouvé Tom sur le collège, alors que la vision
(`vision.md`, « Périmètre V1 ») met le lycée dehors. Ce qui se fait dès maintenant, sans
surcoût : un schéma de référentiel et de jeu indexé par enseignement (§ 5), pour que le
lycée soit un ajout de données. Après le lancement, une première vague sur la vingtaine de
couples les plus suivis, mathématiques d'abord, puis STMG et les matières générales de la
voie professionnelle ; les référentiels professionnels restent hors de portée.

**Brevet et bac** : les sujets servent d'abord à **évaluer**. Le DNB entre au lot 1 (point
déjà reporté), à partir de la session 2027 sur les programmes de 3e ; le bac avec le lycée.
Les extraits de tiers sont exclus sujet par sujet.

## 10. Refonte de la roadmap

1. **Lot 1, harnais et observabilité** : jeu (#358) ; exécuteur et fuite dans Langfuse ;
   référentiel du collège, mathématiques et français d'abord, exercices rattachés ;
   juge daté, qualité d'aide, alignement, niveau de langue ; rapport et baseline
   approuvée ; garde-fou en CI et traces de production sans contenu.
2. **Lot 2** : quota corrigé avant tout ajout au prompt ; programme dans le contexte,
   mesuré ; `by-level.ts` réécrit ; outil de calcul ; le reste inchangé.
3. **Après la V1, lycée** : vagues décrites au § 9.
4. **Hors roadmap** : le RAG vectoriel change de motif, « inutile à cette taille de
   corpus, mesurée le 2026-10-02 ».

## Non vérifié

- Pages HTML du BO et d'Éduscol (403) : textes lus dans leurs PDF ou dans des captures.
- Nombre de tokens d'un référentiel (niveau, matière).
- API de résolution et d'équivalence de mathjs et de Compute Engine.
- Coût réel d'une passe du harnais et prix du juge.
- Portée du partage à l'identique de Sésamath et statut des sujets d'examen pour un usage
  commercial : avis d'un juriste.
- Programmes STAV, S2TMD, maths expertes (pas de nouveau texte trouvé) et éventuels
  nouveaux programmes de la voie professionnelle.
- Licence des vocabulaires ScoLOMFR et de la spécification CASE.
