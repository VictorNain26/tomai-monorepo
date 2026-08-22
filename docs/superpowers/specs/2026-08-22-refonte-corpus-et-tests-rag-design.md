# Refonte du corpus et des tests du RAG curriculum

- **Date** : 2026-08-22
- **Statut** : conception validée, spec en relecture
- **Périmètre** : `apps/curriculum` **uniquement**. Les conséquences côté
  `apps/server` sont identifiées ici mais traitées dans un lot distinct.

## L'impératif

**Le corpus doit être complet et à jour des réformes.** Toute l'application
repose dessus : un tuteur qui cite un programme abrogé enseigne du faux à un
enfant, et rien dans la chaîne ne le signalerait.

Ce n'est donc pas un rattrapage ponctuel. Le lot doit produire **un système qui
reste à jour**, et le critère de réussite n'est pas « le corpus est complet
aujourd'hui » mais « on saura quand il ne l'est plus ».

## Le problème, mesuré

L'index contient **5 238 points pour 1 564 textes uniques**, et voici leur
répartition réelle :

```
par niveau                          par matière (extrêmes)
  sixieme      1 146                  allemand         984
  cinquieme    1 364                  italien          824
  quatrieme    1 364                  anglais          800
  troisieme    1 364                  ─────────────────────
  seconde          0  ← VIDE          mathematiques    282
  premiere         0  ← VIDE          histoire_geo     229
  terminale        0  ← VIDE          eps               71
```

Deux constats en découlent.

**Le lycée n'existe pas, et le produit accepte des lycéens.**
`apps/server/src/db/schema/auth.schema.ts` autorise l'inscription en `seconde`,
`premiere` et `terminale`. Pour ces élèves, la recherche filtre sur un niveau
sans aucun point : zéro résultat, toutes matières confondues. L'agent en conclut
que le programme officiel ne dit rien et répond de mémoire. Rien ne le signale.

Le correctif P0-1 de juillet avait fermé la dimension *matière* (`RAG_SUBJECTS`
aligné sur `contract.json`) en laissant la dimension *niveau* ouverte.

**Le collège est déséquilibré d'un facteur 3,5.** Les quatre programmes de
langues sont des documents BO distincts, entièrement découpés ; maths, français
et histoire se partagent les documents cycle3/cycle4 mutualisés. Un élève qui
pose une question de mathématiques puise dans 282 chunks, le même en allemand
dans 984.

**Et personne ne pouvait le voir.** `scripts/audit_coverage.py:304` calcule
`min(indexed_chars / source_chars * 100, 100.0)`. Avec l'expansion multi-niveaux,
ce ratio vaut structurellement ×3,35 : la métrique affiche « 100 % » tant qu'on
ne perd pas plus des deux tiers du corpus. Le rapport commité le prouve —
`228 447/76 344`, annoncé « ✅ 100 % ».

## Périmètre retenu

**Collège complet + lycée général et technologique.** C'est ce que le schéma
d'inscription autorise déjà : le corpus rattrape le produit, il ne l'élargit pas.

La voie professionnelle reste hors périmètre. **Conséquence à traiter dans le
lot serveur** : les niveaux professionnels devront être retirés de
`auth.schema.ts`, sinon on recrée exactement le silence qu'on répare, pour un
autre public.

## Le pivot : un manifeste, pas une liste écrite à la main

`data/raw/programmes_second_degre_datagouv.json` est un CSV data.gouv de **688
entrées, dont 334 en vigueur, toutes avec un lien de contenu direct**. Il est
dans le dépôt depuis le début et n'a jamais été utilisé : les neuf fichiers
markdown actuels ont été collectés à la main.

**Mais il ne peut pas être l'unique source, et c'est vérifié** : le jeu de
données vivant est identique à notre copie — 688 lignes, **aucune entrée pour la
rentrée 2022 ou après**. La « mise à jour du 2026-02-02 » affichée par data.gouv
est un rafraîchissement de métadonnées, pas de contenu. Les réformes collège de
2024, 2025 et 2026 en sont absentes.

Le manifeste a donc **deux sources** :

| Source | Couvre | État |
|---|---|---|
| CSV data.gouv | **lycée** : 279 lignes → 118 PDF, par discipline | complet et vérifié |
| table datée avec référence BO | **collège** : 2 documents de cycle + 9 par discipline | à tenir à jour par la veille |

```
CSV data.gouv (334)  ──filtre périmètre──▶  MANIFESTE  ──▶  téléchargement
                                               │                    │
                                               │                    ▼
                                               │            extraction → chunking
                                               │                    │
                                               ▼                    ▼
                                    matrice ATTENDUE  ◀──compare──  index Qdrant
                                               │
                                               ▼
                                     test de couverture
```

**Le manifeste dit ce qui doit exister, l'index dit ce qui existe, le test
compare les deux.** Aucune des deux moitiés n'est écrite à la main. C'est la
différence avec la métrique actuelle, qui compare l'index à lui-même.

Cela remplace `SOURCES: list[dict]`, la constante non typée de `ingest.py` qui
est aujourd'hui l'unique définition de « ce qu'on indexe ».

### La table de correspondance, et sa règle

Le CSV porte **103 disciplines** et **32 niveaux** officiels ; notre schéma en a
24 et 7. Une table `libellé officiel → slug` est donc nécessaire. C'est
précisément l'endroit d'où venait le bug P0-1.

**Règle : aucune ligne du périmètre ne peut être ignorée en silence.** Chaque
entrée est soit mappée vers un slug connu, soit explicitement exclue **avec un
motif écrit**. Un test échoue sur toute ligne ni mappée ni exclue. Si le
ministère publie une nouvelle discipline l'an prochain, le test rougit au lieu
de la laisser disparaître.

## Les cinq étages

### A — Couverture

Une matrice `(niveau × matière) → nombre de chunks`, construite depuis l'index,
comparée à celle dérivée du manifeste. Le test échoue sur toute case attendue et
vide.

**Écrit à la main, et c'est justifié.** J'avais d'abord retenu Pandera ; en le
vérifiant, la comparaison n'est pas « maison contre bibliothèque » mais « une
assertion de cinq lignes contre un framework de validation de pipelines à
colonnes multiples ». La robustesse ne vient pas de l'outil, elle vient du fait
que la matrice attendue est *dérivée*. Pandera est écarté.

Remplace `scripts/audit_coverage.py`.

### B — Corpus

Téléchargement piloté par le manifeste, extraction, chunking. Le chunking reste
sur `chonkie`, déjà en place.

**A définit « fini »** : le corpus est complet quand le test de couverture passe,
matière par matière et niveau par niveau. Pas quand quelqu'un estime que ça y est.

### C — Chaîne d'ingestion

- `chunk_point_id(matiere, niveau, texte)` exposé dans `schema/document.py`,
  importé partout. Il existe aujourd'hui en **quatre copies** (`ingest.py:450`,
  `generate_golden.py:156`, `test_ingest.py:292`, `test_golden.py:86`) et le test
  censé le verrouiller **réécrit la formule** au lieu d'importer la source.
- **Orphelins** : suppression par filtre `source_file` avant réingestion d'une
  source, et bascule d'alias pour une réindexation complète. Deux fonctionnalités
  natives Qdrant, zéro code.
- `get_collection_name()` et `get_qdrant_client()` deviennent les **uniques**
  accesseurs — ils sont aujourd'hui contournés à la main en trois endroits, dont
  une fabrique de client qui omet `cloud_inference=True`.

### D — Tests de recherche

Qdrant **mode local** (`QdrantClient(":memory:")`), in-process, sans réseau ni
clé. Vérifié sur notre forme exacte de requête : vecteurs nommés, sparse
`Modifier.IDF`, prefetch deux branches, fusion RRF, filtre, `hnsw_ef`.

Le vecteur creux est fourni **en fixture explicite**. Le BM25 de Qdrant n'est pas
notre code : le tester exigerait `fastembed` et ses ~200 Mo d'`onnxruntime` pour
vérifier le travail d'autrui. Le `doctor` couvre déjà la chaîne réelle sur Qdrant
Cloud, avec l'inférence serveur.

Remplace les mocks Qdrant, qui vérifient aujourd'hui le comportement des mocks.

**Limite connue** : les index payload sont inopérants en mode local (les filtres
fonctionnent, non indexés) et la capacité plafonne vers 20 000 points.

### E — Évaluation qualité

`ragas.metrics.collections.ContextRelevance` — signature vérifiée :
`ascore(user_input: str, retrieved_contexts: list[str])`. Ni `response` ni
`reference`, ce qui convient à un dépôt *retrieval-only*. Son implémentation est
un **double juge** (deux prompts distincts, moyennés), ce qui atténue le biais
d'indulgence du juge unique documenté dans la littérature. Juge servi par
Mistral via `langchain-mistralai`, déjà présent.

`ranx` (déjà présent) fournit la comparaison entre configurations avec test de
significativité de Fisher.

**Lancée à la main, jamais en CI.** Elle sert à départager des configurations —
BM25 aide-t-il ou nuit-il ? un reranker récupère-t-il les points identifiés ? —
et **jamais à annoncer une qualité absolue**.

### F — Veille des réformes

C'est l'étage qui manque, et sans lui l'impératif n'est pas tenu.

**Contrainte d'accès, vérifiée** : `education.gouv.fr` et `legifrance.gouv.fr`
renvoient **403 (Cloudflare)** sur toute requête automatisée — le flux RSS du BO
est donc inexploitable par machine. En revanche **tous les PDF se téléchargent**
(`cache.media.education.gouv.fr`, `www.education.gouv.fr/sites/…`, miroirs) en
HTTP 200. **On peut tout télécharger, on ne peut pas surveiller par le web.**

Le seul signal exploitable est l'**API PISTE de Légifrance** : officielle,
authentifiée, hors Cloudflare, identifiants déjà présents en secrets GitHub. Les
arrêtés créent et abrogent les programmes ; les deux réformes ratées portent les
NOR `MENE2504620A` et `MENE2602912A`, qu'un filtre sur le préfixe `MENE` + type
arrêté aurait attrapées.

Trois exigences sur cette veille, qui sont la raison de son échec passé :

1. **Elle échoue bruyamment.** L'implémentation actuelle retourne `None` sur
   tout échec de sous-processus — y compris `curl` ou `pdftotext` absents, deux
   dépendances système déclarées nulle part — puis imprime « ✓ Aucun changement
   détecté » et sort en 0. Un détecteur de changement qui se tait quand il est
   cassé est pire qu'absent.
2. **Elle n'utilise plus `subprocess`.** `httpx` est déjà une dépendance ; le
   secret PISTE transite aujourd'hui par `argv` de `curl`, donc lisible par tout
   utilisateur de la machine (`ps`, `/proc/*/cmdline`).
3. **Elle est testée.** Le module fait 395 lignes et n'a aucun test.

## Ce qui est supprimé

```
data/golden/questions.json      golden set généré depuis les chunks à retrouver
scripts/generate_golden.py      + son test tautologique
scripts/evaluate.py             métriques sur gold_chunk_id
scripts/evaluate_judged.py      juge écrit à la main → remplacé par RAGAS
scripts/audit_coverage.py       métrique bornée à 100 % → remplacée par A
SOURCES: list[dict]             → manifeste dérivé du CSV
3 copies de la formule uuid5    → chunk_point_id()
les mocks Qdrant                → mode local
EMBEDDING_DIM, l2_normalize     code mort exporté
```

Le golden set part parce qu'il est irréparable dans sa conception : ses questions
sont générées **à partir des chunks qu'il faut retrouver**, or les retrievers
neuronaux sont biaisés en faveur des textes générés par LLM
([arXiv 2310.20501](https://arxiv.org/pdf/2310.20501)) ; il n'a qu'un document
pertinent par question, une pertinence binaire, et deux exécutions identiques
varient de ±1 point (HNSW approximatif et égalités RRF).

## Ce que ce lot ne fait pas

- **Pas de reranking.** Levier identifié et chiffré (`hit_rate@20` 0,984 contre
  `hit_rate@5` 0,894 sur l'ancien corpus), mais aucun fournisseur EU chez OVH à
  ce jour. Reste dans `docs/constats-ouverts.md`.
- **Pas de changement d'embedder.** `Qwen3-Embedding-8B` @1024D reste
  (`docs/adr/0002-embeddings-manages.md`).
- **Pas de retouche du chunking.** La taille est réglée en tokens Mistral et
  mesurée avec un tokenizer périmé ; on ne la change pas avant d'avoir un
  instrument de mesure.
- **Pas de voie professionnelle.**
- **Pas d'adaptation d'`apps/server`.** Le lot produit un corpus complet et un
  `contract.json` qui décrit la couverture réelle par niveau. Consommer cette
  information — fermer la dimension niveau côté agent, aligner les niveaux
  d'inscription sur le périmètre — est un lot serveur distinct, à ouvrir une
  fois celui-ci terminé.

## Critères de fin

1. Le test de couverture passe : chaque case `(niveau × matière)` du manifeste a
   du contenu indexé, collège et lycée général et technologique.
1bis. La veille détecte un arrêté de programme publié depuis le dernier run, et
   **échoue** si elle ne peut pas conclure — jamais de « aucun changement » par
   défaut. Vérifiable en rejouant les NOR `MENE2504620A` et `MENE2602912A`.
2. Aucune ligne du CSV dans le périmètre n'est ni mappée ni explicitement exclue.
3. `chunk_point_id` a **un** point de définition, et le test l'importe au lieu de
   le réécrire.
4. Les tests de recherche s'exécutent sans réseau ni clé, sur un vrai moteur
   Qdrant, et échouent si la fusion, un filtre ou `hnsw_ef` change.
5. Une réingestion d'une source ne laisse aucun orphelin.
6. `pnpm doctor` reste vert sur le vrai cluster.
7. `contract.json` expose la couverture réelle par niveau, pas seulement par
   matière — c'est ce dont le lot serveur aura besoin pour fermer la dimension
   niveau comme `RAG_SUBJECTS` a fermé la dimension matière.

## Risques

**Les manques collège sont identifiés précisément** : français cycle 3 (BO 2025),
maths cycle 3 (BO 2025), français cycle 4 (BO 2026). Les autres matières sont
inchangées depuis BO2020 et couvertes par les documents de cycle. Ce n'est donc
plus un inconnu.

**Le volume du lycée est connu mais son extraction ne l'est pas.** 103 programmes environ dans le périmètre,
contre 9 documents aujourd'hui. La qualité d'extraction des PDF officiels n'a
pas été éprouvée sur ces documents. C'est le risque principal, et il est de
nature « données », pas « code ».

**La table de correspondance est un travail de jugement.** 103 libellés officiels
vers 24 slugs suppose des décisions (regrouper « Enseignement de spécialité
d'arts (musique) » et « Éducation musicale » ? les séparer ?). Elles doivent être
écrites, pas devinées.

**Le juge LLM coûte des appels.** L'évaluation qualité n'est pas gratuite et ne
doit pas devenir une habitude automatique — d'où le choix de la garder hors CI.
