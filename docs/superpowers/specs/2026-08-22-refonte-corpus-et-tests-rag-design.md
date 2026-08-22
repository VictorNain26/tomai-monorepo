# Refonte du corpus et des tests du RAG curriculum

- **Date** : 2026-08-22 (révisée le jour même, après vérification des sources réelles)
- **Statut** : conception validée
- **Périmètre** : `apps/curriculum` **uniquement**. Les conséquences côté
  `apps/server` sont identifiées ici mais traitées dans un lot distinct.

## L'impératif

**Le corpus doit être complet et à jour des réformes.** Toute l'application
repose dessus : un tuteur qui cite un programme abrogé — ou un programme qui
n'entrera en vigueur que dans deux ans — enseigne du faux à un enfant, et rien
dans la chaîne ne le signalerait.

Le critère de réussite n'est donc pas « le corpus est complet aujourd'hui » mais
« on saura quand il ne l'est plus ».

## Le problème, mesuré

L'index contient **5 238 points pour 1 564 textes uniques** :

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

**Le lycée n'existe pas, et le produit accepte des lycéens.**
`apps/server/src/db/schema/auth.schema.ts` autorise l'inscription en `seconde`,
`premiere` et `terminale`. Pour ces élèves, la recherche filtre sur un niveau
sans aucun point : zéro résultat, toutes matières confondues. L'agent en conclut
que le programme officiel ne dit rien et répond de mémoire.

**Le collège est déséquilibré d'un facteur 3,5.** Les programmes de langues sont
des documents distincts, entièrement découpés ; maths, français et histoire ne
sont que des *sections* dans les deux documents de cycle BO2020.

**Et personne ne pouvait le voir.** `scripts/audit_coverage.py:304` calcule
`min(indexed_chars / source_chars * 100, 100.0)`. Avec l'expansion multi-niveaux
ce ratio vaut structurellement ×3,35 : la métrique affiche « 100 % » tant qu'on
ne perd pas plus des deux tiers du corpus.

## D'où vient la vérité — vérifié le 2026-08-22

**Le fonds JORF de Légifrance, en open data, décide de ce que le corpus doit
contenir.** Décision et preuves complètes :
`docs/adr/0003-legifrance-source-de-verite-du-corpus.md`.

`https://echanges.dila.gouv.fr/OPENDATA/JORF/` — **sans authentification**, dump
global de 1,67 Go et incréments quotidiens jusqu'au jour même. On y retrouve
tous nos arrêtés (`MENE2018714A`, `MENE2504620A`, `MENE2504621A`), le calendrier
d'application **par niveau** en toutes lettres, les abrogations même partielles,
et les liens de citation entre textes.

Trois sources ont été écartées, chacune pour une raison factuelle :

| Écartée | Pourquoi |
|---|---|
| API PISTE | même fonds Légifrance, mais compte, CGU, souscription, quota et deux secrets. Ces prérequis n'ont jamais été remplis : la veille n'a **jamais** tourné et sortait verte |
| API `data.education.gouv.fr` comme autorité | **gelée à la rentrée 2021** — et donc aveugle aux abrogations postérieures. Reste un annuaire d'URL pour les programmes anciens |
| scraper le BO | 403 sur tout HTML, y compris avec des en-têtes de navigateur complets |

**Légifrance porte la règle, pas le contenu.** Le texte d'un arrêté fait
quelques kilo-octets et renvoie explicitement au Bulletin officiel pour ses
annexes. Les PDF s'y téléchargent, mais leur nom ne se déduit de rien. Aucune
source unique ne donne les deux : c'est un fait sur les sources, pas un choix.

Une table associe donc un NOR aux URL de ses annexes. C'est le seul travail
manuel du dispositif, borné à quelques arrêtés par an, et **déclenché** par la
détection au lieu d'être subi.

**Ce que la bascule a déjà rattrapé** : trois arrêtés d'avril 2026 qu'aucune
source précédente ne connaissait, dont `MENE2608631A` — EPS et
histoire-géographie du cycle 3, applicables **en sixième à la rentrée 2027**.

## Le calendrier est échelonné par niveau

C'est le fait le plus structurant, et il invalide toute liste non datée :

| Réforme | 6e / 2de | 5e / 1re-Tle | 4e | 3e |
|---|---|---|---|---|
| Langues vivantes (`MENE2504621A`) | 2025 | 2026 | 2027 | 2028 |
| Français et maths cycle 4 (`MENE2602912A`) | — | 2026 | 2027 | 2028 |
| EPS et histoire-géo cycle 3 (`MENE2608631A`) | 2027 | — | — | — |

À la rentrée 2026, un élève de 4e suit **encore le programme BO2020**. Un
manifeste qui associerait le nouveau programme à « cycle 4 » lui servirait un
texte qui ne s'applique pas à lui. Ces dates ne sont plus recopiées : elles se
lisent dans l'article d'application de l'arrêté.

## Périmètre retenu

**Collège complet + lycée général.** La voie technologique et la voie
professionnelle sont exclues, pour la même raison : **notre payload ne porte pas
la série**. Indexer les programmes STMG, STI2D ou STL sous `premiere` ferait
servir le programme de maths STMG à un élève de première générale, sans que rien
ne les distingue — on remplacerait un silence par une confusion.

Un élève de voie technologique reçoit donc le programme général : une
approximation lisible, et réversible le jour où le payload portera la série.

Volumes réels du périmètre, mesurés sur l'API : **100 lignes en vigueur,
78 PDF uniques, 59 libellés de discipline** (contre 282 / 120 / 98 si on
incluait la voie technologique).

**Conséquence à traiter dans le lot serveur** : `auth.schema.ts` doit cesser
d'accepter les niveaux professionnels, sinon on recrée exactement le silence
qu'on répare, pour un autre public.

## Le pivot : un manifeste daté, dérivé, jamais écrit à la main

```
API data.education.gouv.fr  ─┐
   (≤ rentrée 2021)          │
                             ├─▶  MANIFESTE DATÉ ──en_vigueur(2026)──▶ téléchargement
table BO (≥ rentrée 2022)  ──┘      │                                         │
   avec NOR + calendrier            │                                         ▼
                                    │                               extraction → chunking
                                    ▼                                         │
                          matrice ATTENDUE  ◀───────compare──────────  index Qdrant
                                    │
                                    ▼
                            test de couverture
```

**Une entrée de manifeste = un couple (matière, niveau)**, avec son URL, sa
référence d'arrêté et **la rentrée à partir de laquelle elle s'applique à ce
niveau**. Pour chaque couple, `en_vigueur(rentree)` retient l'entrée la plus
récente déjà applicable. Le remplacement d'un programme par un autre n'est donc
pas un cas particulier : c'est le fonctionnement normal du tri.

C'est exactement le modèle de données de l'API officielle
(`entre_en_vigueur_a_la_rentree` / `abroge_a_la_rentree`). On ne l'invente pas,
on le reprend.

Cela remplace `SOURCES: list[dict]` (`scripts/ingest.py:151`), la constante non
typée qui est aujourd'hui l'unique définition de « ce qu'on indexe ».

**Le manifeste dit ce qui doit exister, l'index dit ce qui existe, le test
compare les deux.** C'est la différence avec la métrique actuelle, qui compare
l'index à lui-même et ne peut donc pas échouer.

### La table de correspondance, et sa règle

L'API porte 59 libellés de discipline sur le périmètre ; notre schéma en a 24.
Une table `libellé officiel → slug` est nécessaire, et c'est précisément
l'endroit d'où venait le bug P0-1 (l'agent demandait `histoire`, l'index portait
`histoire_geo`).

**Règle : aucune ligne du périmètre ne peut être ignorée en silence.** Chaque
entrée est soit mappée, soit exclue **avec un motif écrit** — y compris les 12
lignes du périmètre dont le champ `contenu_sur_le_site` ne pointe pas un PDF. Un
test échoue sur toute ligne ni mappée ni exclue, et un autre échoue si le
périmètre se vide : une colonne renommée ferait sinon passer au vert un manifeste
vide.

## Les six étages

### A — Couverture

Une matrice `(niveau × matière) → nombre de chunks` construite depuis l'index,
comparée à celle dérivée du manifeste en vigueur. Le test échoue sur toute case
attendue et vide.

Les documents multi-matières (cycle 3 et cycle 4 BO2020) **déclarent dans le
manifeste les matières qu'ils portent**. Sans cela, une matière noyée dans un
document de 98 pages ne serait attendue nulle part.

Écrit à la main, et c'est justifié : la robustesse ne vient pas d'un framework de
validation, elle vient du fait que la matrice attendue est *dérivée*. Pandera est
écarté.

Remplace `scripts/audit_coverage.py`.

### B — Corpus

Téléchargement piloté par le manifeste, extraction, chunking (`chonkie`, déjà en
place). **A définit « fini »** : le corpus est complet quand le test de
couverture passe, matière par matière et niveau par niveau.

Le corpus actuel — 18 fichiers `.md`/`.txt` collectés à la main — est supprimé.
Il n'est traçable à aucune source, et le garder inviterait à en réutiliser un
silencieusement.

### C — Chaîne d'ingestion

- `chunk_point_id(matiere, niveau, texte)` exposé dans `schema/document.py` et
  importé partout. Il existe aujourd'hui en **quatre copies** (`ingest.py:450`,
  `generate_golden.py:156`, `test_ingest.py:292`, `test_golden.py:86`) et le test
  censé le verrouiller **réécrit la formule** au lieu d'importer la source.
- **Orphelins** : suppression par filtre `source_file` avant réingestion d'une
  source. Fonctionnalité native Qdrant, zéro code.
- **Réindexation complète** : dans une collection neuve, puis **bascule
  d'alias**. Réindexer en place laisserait le serveur servir un index à moitié
  vide pendant l'opération, et un index mixte si elle échoue.
- `get_collection_name()` et `get_qdrant_client()` deviennent les **uniques**
  accesseurs. `scripts/migrate_collection.py:53` fabrique aujourd'hui son propre
  client, sans `cloud_inference=True`.

### D — Tests de recherche

Qdrant **mode local** (`QdrantClient(":memory:")`), in-process, sans réseau ni
clé. Vérifié sur notre forme exacte de requête : vecteurs nommés, sparse
`Modifier.IDF`, prefetch deux branches, fusion RRF, filtre, `hnsw_ef`.

Le vecteur creux est fourni **en fixture explicite** : le BM25 de Qdrant n'est
pas notre code, et le tester exigerait `fastembed` et ses ~200 Mo d'ONNX. Le
`doctor` couvre déjà la chaîne réelle sur Qdrant Cloud, inférence serveur
comprise.

Remplace les mocks Qdrant, qui vérifient aujourd'hui le comportement des mocks.

**Limites connues du mode local** : index payload inopérants (les filtres
fonctionnent, non indexés), capacité plafonnée vers 20 000 points, et
`models.Document` refusé — l'inférence serveur est une fonctionnalité Cloud.

### E — Veille des réformes

Sans elle, l'impératif n'est pas tenu. Elle scanne les **incréments quotidiens
du fonds JORF** et signale tout arrêté de programme dont le NOR n'est pas déjà
traité par le manifeste.

Trois exigences, qui sont la raison de son échec passé :

1. **Elle échoue bruyamment.** L'implémentation précédente retournait `None` sur
   tout échec de sous-processus — `curl` ou `pdftotext` absents compris, deux
   dépendances système déclarées nulle part — puis imprimait « ✓ Aucun changement
   détecté » et sortait en 0.
2. **Elle ne dépend d'aucun secret.** L'open data DILA se consulte sans compte.
   C'est ce qui la rend exécutable : la version PISTE ne l'a jamais été, faute
   d'identifiants que personne n'avait créés.
3. **Elle ne crie pas au loup.** La comparaison se fait sur les NOR que le
   manifeste porte, pas sur des références en texte libre.

Son premier usage est un **rattrapage** : rejouer le fonds depuis 2021 pour
révéler tout ce que les sources précédentes ont laissé passer. Il a déjà commencé
à donner des résultats avant même d'être écrit.

### F — Évaluation qualité

`ragas.metrics.collections.ContextRelevance` — signature vérifiée :
`ascore(user_input: str, retrieved_contexts: list[str])`, ni `response` ni
`reference`, ce qui convient à un dépôt *retrieval-only*. Double juge (deux
prompts moyennés), servi par Mistral via `langchain-mistralai`. `ranx` fournit la
comparaison entre configurations avec test de significativité.

**Lancée à la main, jamais en CI**, et **après** la refonte du corpus : mesurer un
corpus qu'on s'apprête à remplacer n'apprend rien.

## Ce qui est supprimé

```
data/raw/programme_*.{md,txt}   18 fichiers collectés à la main, non traçables
data/raw/…datagouv.json         copie figée du CSV → remplacée par l'API
data/golden/questions.json      golden set généré depuis les chunks à retrouver
scripts/generate_golden.py      + son test tautologique
scripts/evaluate.py             métriques sur gold_chunk_id
scripts/evaluate_judged.py      juge écrit à la main → remplacé par RAGAS
scripts/audit_coverage.py       métrique bornée à 100 % → remplacée par A
SOURCES: list[dict]             → manifeste daté
3 copies de la formule uuid5    → chunk_point_id()
les mocks Qdrant                → mode local
EMBEDDING_DIM                   code mort exporté
```

Le golden set part parce qu'il est irréparable par conception : ses questions
sont générées **à partir des chunks qu'il faut retrouver**, or les retrievers
neuronaux sont biaisés en faveur des textes générés par LLM
([arXiv 2310.20501](https://arxiv.org/pdf/2310.20501)) ; il n'a qu'un document
pertinent par question, une pertinence binaire, et deux exécutions identiques
varient de ±1 point.

`l2_normalize` **reste** : `tests/test_ingest.py:323` le teste.

## Ce que ce lot ne fait pas

- **Pas de reranking.** Levier chiffré (`hit_rate@20` 0,984 contre `hit_rate@5`
  0,894 sur l'ancien corpus), mais aucun fournisseur EU chez OVH à ce jour.
- **Pas de changement d'embedder** (`docs/adr/0002-embeddings-manages.md`).
- **Pas de retouche du chunking.** La taille est réglée en tokens Mistral et
  mesurée avec un tokenizer périmé ; on ne la change pas avant d'avoir un
  instrument de mesure.
- **Pas de voie technologique ni professionnelle.**
- **Pas d'adaptation d'`apps/server`** : fermer la dimension niveau côté agent et
  aligner les niveaux d'inscription est un lot distinct, à ouvrir ensuite.

## Critères de fin

1. Le test de couverture passe : chaque couple `(niveau × matière)` du manifeste
   en vigueur a du contenu indexé, collège et lycée général.
2. Aucune ligne du périmètre n'est ni mappée ni explicitement exclue, et le
   périmètre ne peut pas se vider sans faire rougir un test.
3. Le manifeste est daté : `en_vigueur(2026)` ne retient pas un programme qui ne
   s'applique qu'en 2027, et `en_vigueur(2028)` le retient.
4. `chunk_point_id` a **un** point de définition, et le test l'importe.
5. Les tests de recherche s'exécutent sans réseau ni clé, sur un vrai moteur
   Qdrant, et échouent si la fusion, un filtre ou `hnsw_ef` change.
6. Une réingestion d'une source ne laisse aucun orphelin ; une réindexation
   complète passe par une collection neuve et une bascule d'alias.
7. La veille **échoue** si elle ne peut pas conclure, et ne signale que des
   arrêtés réellement non traités.
8. `pnpm doctor` reste vert sur le vrai cluster.
9. `contract.json` expose la couverture réelle **par niveau**, pas seulement par
   matière — c'est ce dont le lot serveur aura besoin pour fermer la dimension
   niveau comme `RAG_SUBJECTS` a fermé la dimension matière.

## Risques

**Le lien entre un arrêté et ses annexes reste manuel.** Légifrance dit quel
programme s'applique et quand ; il ne dit pas où trouver le PDF, et le BO est
fermé aux machines. Un humain relève ces URL à chaque nouvel arrêté détecté.
C'est borné et déclenché, mais c'est le point où le dispositif attend quelqu'un.

Même règle pour les NOR. 38 des 41 que porte le manifeste sont **dérivés** du
catalogue officiel (champ `lien_vers_le_texte_officiel`, `…?numjo=MENE…`), trois
sont lus dans un BO et listés dans `NOR_A_CONFIRMER`, et celui de la technologie
cycle 4 reste **inconnu** plutôt qu'approximé. `test_aucun_nor_sans_origine`
échoue sur tout NOR qui ne vient ni de l'un ni de l'autre.

**L'exhaustivité dépend du rattrapage sur le fonds JORF.** Il est faisable —
le dump global se parcourt sans authentification — mais tant qu'il n'a pas été
joué en entier, on ne peut pas affirmer que le manifeste est complet. Un premier
scan partiel a déjà trouvé trois arrêtés inconnus.

**La qualité d'extraction des 78 PDF du lycée n'est pas éprouvée.** 15 d'entre
eux ont été échantillonnés : 15/15 téléchargés et extraits, 22 pages et
63 000 caractères en moyenne. Risque de nature « données », pas « code ».

**La table de correspondance est un travail de jugement.** 59 libellés vers 24
slugs suppose des décisions écrites, pas devinées.

**Le juge LLM coûte des appels.** Un passage complet représente de l'ordre de
900 couples à juger, soit ~1 800 appels — d'où le choix de la garder hors CI.
