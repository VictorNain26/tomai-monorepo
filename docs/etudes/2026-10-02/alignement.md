# Aligner Tom sur les programmes et le niveau de l'élève : état au 2 octobre 2026

Étude demandée par Victor : partir du besoin, sans reprendre les décisions passées, et
choisir les outils. Chaque fait cite sa source ou la mesure faite le 2026-10-02 ; ce qui
n'a pas été vérifié est dit. Recherche documentaire : trois recherches en lecture seule
(programmes en vigueur, outils d'extraction et de sélection, outils d'évaluation), plus
les mesures ci-dessous.

## 1. Le besoin

Tom aide un collégien sans faire l'exercice à sa place, et on n'affirme que ce qu'on peut
prouver (`vision.md`). Être « cohérent avec l'Éducation nationale » se décompose en six
besoins.

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
3. **Le bon libellé.** Tom reprend les mots du programme, pas une paraphrase.
4. **L'exactitude.** Ce que Tom affirme, et ce qu'il valide dans la réponse de l'élève,
   est juste.
5. **Une langue adaptée à l'âge.**
6. **La preuve.** Rien de tout cela ne s'affirme sans mesure publiée : « aligné sur les
   programmes » est interdit sur la landing tant que la métrique n'existe pas (`suivi.md`,
   « Lot 4 »).

## 2. Ce que fait Tom aujourd'hui

Lu dans le code de `main` le 2026-10-02 :

- **Niveau** : `modules/tutor/prompts/adaptation/by-level.ts` envoie un bloc par cycle.
  5e, 4e et 3e reçoivent le même bloc, qui cite « Pythagore, Thalès » : un élève de 5e
  reçoit les notions de 4e et de 3e. Les consignes chiffrées (« Phrases de 15-20 mots »,
  « 4-5 éléments ») ne citent aucune source précise, et la règle « PAS de variables (x,
  y) » du cycle 3 n'est pas vérifiée contre le programme de 2025.
- **Programme** : aucun contenu de programme n'est donné à l'agent.
- **Exactitude** : aucun outil de calcul ; le prompt demande seulement de « vérifier le
  résultat » (`by-subject.ts`). Les outils du chat sont `generate_flashcards`,
  `get_student_profile`, `update_student_profile` et `get_app_help`.
- **Matière** : le classifieur d'intention détecte déjà la matière du message
  (`intent-classifier.service.ts`).
- **L'ancien RAG** (supprimé en #294) indexait un corpus de programmes dans Qdrant avec
  des embeddings BGE-M3 et une ingestion en Python. Il n'a jamais été déployé, donc
  jamais mesuré : son retrait ne dit rien de l'utilité d'ancrer Tom dans le programme,
  seulement que cette pile était lourde pour un gain non mesuré.

**Constat** : les besoins 1 à 3 ne sont pas couverts, le 4 repose sur le modèle seul, le
5 sur des consignes non sourcées.

## 3. Donner le programme à l'agent

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

- **RAG vectoriel** (embeddings, index, recherche par similarité). Il sert quand le
  corpus ne tient pas dans le contexte. Ici, le corpus d'un couple (niveau, matière)
  tient sans peine : la recherche n'ajouterait que des erreurs de rappel et une
  infrastructure. **Écarté, pour cette raison de taille.**
- **Classer chaque tour vers un objectif précis** (LLM avec liste fermée). L'alignement
  fin est difficile : sur 385 standards du Common Core, le meilleur pipeline publié
  atteint 31,3 % de correspondance exacte ([BEA 2026](https://aclanthology.org/2026.bea-1.15/)) ;
  les LLM confondent des standards voisins
  ([MathFish, EMNLP 2024](https://aclanthology.org/2024.findings-emnlp.323/)). Une erreur
  injecterait le mauvais objectif. **Écarté au moment du tour** ; utile hors ligne pour
  étiqueter les conversations du harnais.
- **Injecter tout le référentiel du couple (niveau, matière)**. Déterministe, sans erreur
  de sélection. Le bloc est constant pendant la séance : placé après le système statique,
  il est relu depuis le cache à partir du 2e tour, à 10 % du prix d'entrée
  (`etudes/2026-10-01/couts.md`, sources Mistral). Pour N tokens injectés, le coût est
  N × 0,165 $ par million au premier tour (0,15 $ × 1,1 pour l'endpoint UE), puis
  N × 0,0165 $ par million ; pour N = 10 000, 0,165 centime puis 0,0165 centime par tour.
  Le nombre de tokens réel se mesure au tokenizer Tekken à l'extraction, comme dans
  `couts.md`. **Retenu.**

### Recommandation

1. Injecter, pour la matière de la séance, les objectifs et automatismes du niveau de
   l'élève avec leur libellé exact, plus les intitulés des sous-thèmes des niveaux
   suivants sous la mention « pas encore vus ». Sans matière connue, ne rien injecter.
2. Prérequis : corriger le décompte du quota, qui compte aujourd'hui les tokens en cache
   au prix plein (`suivi.md`, « Lot 2 ») ; sinon le bloc consomme la fenêtre gratuite.
3. Mesurer avec le harnais avant de garder : même jeu, avec et sans injection,
   comparaison appariée (McNemar) sur la fuite et sur le critère d'alignement.
4. Réécrire `by-level.ts` à partir du référentiel, par niveau et non plus par cycle, et
   retirer les consignes chiffrées sans source.

Un RAG ne redevient pertinent que si Tom doit chercher dans un corpus qui ne tient pas
dans le contexte (cours, manuels).

## 4. Construire le référentiel

- **Source** : les quatre annexes ci-dessus sont des PDF balisés (`pdfinfo` : « Tagged:
  yes »). L'arbre de structure de l'annexe de mathématiques sépare domaines, niveaux,
  sous-thèmes, automatismes et objectifs (inspection du 2026-10-02 : 21 titres H1, 58 H2,
  58 H3, 215 éléments de liste).
- **Extraction** : lire cet arbre avec pdf.js, déjà présent via `unpdf` (v1.8.1 du
  2026-08-13, MIT ; pdf.js v6.3.289 du 2026-08-29, Apache-2.0, 54 k étoiles ;
  `page.getStructTree()` et `getTextContent({ includeMarkedContent: true })` existent
  dans [les types de pdfjs-dist](https://unpkg.com/pdfjs-dist@6.3.289/types/src/display/api.d.ts)).
  Déterministe, libellé exact, numéro de page, sans nouvelle dépendance ni Python.
- **Piège vérifié** : les formules disparaissent de la couche texte. Ligne extraite de
  l'annexe de mathématiques : « Entretenir l'écriture décimale des fractions simples
  comme ; ; ; ; ; ; ; ; . ». Les objectifs qui contiennent une formule se complètent à la
  main à la relecture ; Mistral OCR 4.1 (`mistral-ocr-4-1`, 4 $ pour 1 000 pages,
  [doc](https://docs.mistral.ai/models/ocr-4-1)) peut servir de contrôle croisé sur ces
  pages, pas de source, car il génère son texte.
- **PDF non balisé** (aucun constaté) : Docling (MIT, v2.132.0 du 2026-10-01, 68 k
  étoiles), en script hors ligne.
- **Format** : un JSON par (discipline, cycle, texte officiel), versionné dans git,
  validé par Zod, chargé en mémoire. Identifiants stables, NOR, BO, SHA-256 du PDF et page
  par entrée. Le diff de la PR fait la comparaison entre deux BO et la relecture humaine.
  Pas de table en base : quelques centaines d'entrées par discipline.
- **Textes de 2020** (4e, 3e) : écrits par cycle. En mathématiques et en français, les
  repères annuels de 2019 situent la notion par classe ; ailleurs, l'entrée reste au
  niveau du cycle, et c'est dit.
- **Standards** : CASE (1EdTech) sert de vocabulaire de conception seulement ;
  ScoLOMFR ne couvre pas les programmes de 2026 (`education-nationale.md`, § 3).
  Aucun des deux n'est consommé par un tiers aujourd'hui.

## 5. Exactitude

Recommandation : un outil de calcul côté serveur qui vérifie une réponse numérique ou
algébrique de l'élève avant que Tom la valide (principe P1 d'`agent.md` : ce qui ne doit
jamais échouer est garanti par le code).

| Brique | Version, date | Adoption | Licence | Note |
|---|---|---|---|---|
| mathjs | 15.2.0, 2026-04-07 ; dernier commit 2026-08-10 | 4,5 M téléchargements par semaine, 15 k étoiles | Apache-2.0 | calcul numérique et simplification |
| Compute Engine (cortex-js) | 0.146.0, 2026-10-02 | 320 k par semaine, 478 étoiles | MIT | lit le LaTeX, que Tom écrit déjà en KaTeX |
| nerdamer, Algebrite | dernières versions en 2021 | — | MIT | échouent au critère de maintenance |

**Non vérifié** : la résolution d'équations et le test d'équivalence de ces deux briques
sur des cas de collège. À lire dans leur documentation, puis à tester sur le jeu
d'évaluation, avant de choisir.

## 6. Langue adaptée à l'âge

- Pas de formule de lisibilité comme note : Kandel-Moles obtient un F1 de 0,25 sur neuf
  niveaux scolaires ([LREC 2022](https://aclanthology.org/2022.lrec-1.130.pdf)), et ces
  formules sont instables sur des textes courts
  ([PMC12919665](https://pmc.ncbi.nlm.nih.gov/articles/PMC12919665/)). Aucune bibliothèque
  JavaScript française maintenue n'a été trouvée.
- Un critère du juge, « adapté au niveau », sur une échelle à trois crans avec un exemple
  par niveau, calibré sur la relecture humaine.
- Deux signaux suivis sans notation : mots par phrase, part de mots hors des plus
  fréquents de [Lexique](https://lexique.org/) (CC BY-SA 4.0).

## 7. Mesurer

- **Outil** : Langfuse (cœur sous MIT, v4.50.0 du 2026-10-02, 35 k étoiles ;
  `@langfuse/client` 5.11.1, 5,6 M téléchargements par mois). Datasets, expériences par
  SDK, files d'annotation humaine sont inclus en auto-hébergement
  ([doc](https://langfuse.com/pricing-self-host)). Région UE du cloud en Irlande, ou
  auto-hébergement (4 cœurs, 16 Gio au minimum).
- **Juge** : appel Mistral par l'AI SDK avec un schéma Zod, prompt et date dans git, et
  non un évaluateur configuré dans l'interface.
- **Grille** : la grille du protocole, rapprochée des dimensions de MRBench
  (identification et localisation de l'erreur, guidage, actionnabilité, ton ; accord
  humain κ = 0,71, [arXiv 2412.09416](https://arxiv.org/abs/2412.09416)). Pour
  l'alignement, une rubrique par exercice, comme TutorBench
  ([arXiv 2510.02663](https://arxiv.org/abs/2510.02663)) : objectif du référentiel,
  notions permises, notions interdites, chaque critère en oui ou non.
- **Accord juge-humain** : α de Krippendorff d'au moins 0,800 pour conclure.
- **Écartés** :
  - promptfoo (doublon de Langfuse ; racheté par OpenAI le 2026-03-09) ;
  - Evalite, Ragas, openai/evals (critère de maintenance) ;
  - DeepEval, Inspect AI (Python d'abord).

## 8. Ce qui change dans la roadmap

À valider par Victor :

1. **Le référentiel passe du lot 2 au lot 1**, avant le juge (point 3) : la métrique
   d'alignement en a besoin. Commencer par les mathématiques et le français, de la 6e à la
   3e. Chaque exercice du jeu (`apps/server/src/eval/exercises/`) gagne l'identifiant de
   son objectif et ses notions interdites.
2. **Lot 2** :
   - injection par (niveau, matière), mesurée avant d'être gardée ;
   - quota corrigé d'abord ;
   - `by-level.ts` réécrit à partir du référentiel ;
   - outil de calcul après vérification de sa documentation.
3. **Lot 1, outillage** : Langfuse pour les datasets et les expériences ; juge dans le
   code.
4. **Hors roadmap** : la ligne « retour d'un RAG vectoriel » change de motif. Ce n'est
   plus « supprimé faute de gain » mais « inutile à cette taille de corpus, mesurée le
   2026-10-02 ».

## Non vérifié

- Pages HTML du BO et d'Éduscol (403) : les textes ont été lus dans leurs PDF.
- Balisage et formules des annexes autres que celles listées au § 3.
- Nombre de tokens d'un référentiel (niveau, matière).
- API de résolution et d'équivalence de mathjs et de Compute Engine.
- Passage du test de sortie structurée des évaluateurs Langfuse par Mistral (sans effet
  si le juge est dans le code).
- Licence des vocabulaires ScoLOMFR et de la spécification CASE.
