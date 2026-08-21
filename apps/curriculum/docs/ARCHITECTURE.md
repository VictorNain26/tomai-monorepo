# Architecture — tomai-curriculum

Source de vérité unique sur l'architecture du pipeline RAG des programmes
officiels Éduscol.

## Scope

Ce repo gère **uniquement l'index RAG** : extraction PDF → markdown →
chunking → embeddings → indexation Qdrant. La couche LLM (chat socratique,
prompting, faithfulness/hallucination eval, mémoire élève) est la
responsabilité du backend `tomai-monorepo/apps/server`.

Frontière non négociable :

| Curriculum (ce repo) | Backend (`apps/server`) |
|---|---|
| Extraction PDF, chunking, contextual prefix | Récupération runtime (query Qdrant) |
| Choix et version du modèle d'embedding | Reranker runtime |
| Schema payload Qdrant, named vectors, BM25 IDF | Prompt socratique, history, tools |
| Eval **retrieval** déterministe (recall@k, MRR) | Eval **réponse** LLM (faithfulness, hallu) |
| Golden set generation offline | Monitoring runtime (latence, cache hit) |
| Veille BO + ingestion | Mémoire élève, personnalisation |

## Souveraineté EU stricte

Toute la stack passe par des fournisseurs ou modèles EU-déployables :

- **Embeddings** : `BAAI/bge-m3` (1024D, dense + sparse natif via FlagEmbedding)
  Auto-hébergeable sur Scaleway (souverain de facto, poids MIT)
- **Génération offline du golden set** : `mistral-large-latest`
- **Index vectoriel** : Qdrant Cloud, région `fr-par`
- **Veille** : data.gouv.fr + Légifrance (PISTE)

Aucun appel sortant vers OpenAI, Anthropic, Cohere, Google, Voyage.

## Pipeline de données

```
data/raw/*.pdf
  └─ scripts/extract_pdfs.py (pymupdf4llm)
       → data/raw/*.md (titres H2/H3 fiables)

data/raw/*.md
  └─ scripts/ingest.py
       ├─ load_source_text()       préfère .md sinon .txt
       ├─ extract_section()        regex `^## \*\*Matière\*\*` pour fichiers
       │                           multi-matières (cycle3 BO2020, cycle4 BO2020)
       ├─ chunk_text()             chonkie RecursiveChunker, 400 vrais tokens
       │                           Mistral, cascade règles markdown
       ├─ expand_for_niveaux()     duplique 1 chunk × N niveaux du cycle
       ├─ validate_chunks()        Pydantic Chunk → payload Qdrant
       ├─ encode_with_sparse()     BGE-M3 dense+sparse single forward pass
       │                           (préfixe contextuel hiérarchique sans LLM)
       └─ upsert_to_qdrant()       named {dense, bm25}, idempotent
                                   uuid5(NAMESPACE_URL, sha256(matière:niveau:text))
```

## Schema Chunk

Payload Qdrant canonique (`schema/document.py`, classe `Chunk` Pydantic) :

| Champ | Source | Rôle |
|---|---|---|
| `text` | texte brut du programme | Source de vérité affichable au LLM |
| `source_file` | nom du fichier Éduscol | Audit trail |
| `matiere` | enum `Matiere` | Filtre payload |
| `niveau` | enum `NiveauCollege` ou `NiveauLycee` | Filtre payload |
| `cycle` | dérivé `cycle_from_niveau(niveau)` | Filtre payload |
| `section` | section du programme (ex: "Nombres et calculs") | Métadonnée affichable |
| `chunk_index` | position ordinale | Tri |

Tous les champs sont validés Pydantic. Aucun champ LLM-generated dans
l'index (pas de `domaine`, `sousdomaine`, `difficulty`, `content_type`) —
le dataset est strictement vérifiable contre les BO officiels.

## Multi-niveau par duplication de payload

Pour les fichiers cycle 4 ou collège complet, chaque chunk est dupliqué en
N points Qdrant — un par niveau du cycle. Le même texte produit le **même
embedding** (calculé une fois, réutilisé) mais N IDs distincts et N payloads
avec `niveau` différent.

ID stable : `uuid5(NAMESPACE_URL, sha256(f"{matière}:{niveau}:{text}"))`.
Le préfixe `matière` évite les collisions cross-matière sur les préambules
pédagogiques communs (langues collège EN/ES/DE/IT partagent du contenu
identique).

Alternative écartée : `niveaux: list[str]` + filtre `MatchAny` côté backend.
Imposerait un refactor du filtre `niveau` et déplacerait la logique
multi-niveau dans le code consommateur. La duplication coûte ~3× en
stockage sur le cycle 4 — négligeable (<1M points, ~4 GB).

## Contextual prefix hiérarchique (sans LLM)

Avant embedding, chaque chunk est préfixé par sa hiérarchie matière + section :

```
Cet extrait provient du programme officiel Éduscol de {Matière_label},
section « {section} ».

{texte brut}
```

Inspiré de la méthode [Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval)
d'Anthropic. La version Anthropic utilise un LLM (Claude Haiku) pour générer
le préfixe ; ici on l'extrait gratuitement de la hiérarchie déjà connue
(corpus structuré H2/H3 fiable via pymupdf4llm).

Le `niveau` n'est PAS dans le préfixe : permet de réutiliser le même
embedding pour les N duplications de niveau (économie 3× sur l'API
embeddings). Le niveau reste filtrable via le payload Qdrant.

Implémentation : `schema/contextual.py:build_contextual_text()`.

## Chunking

`chonkie.RecursiveChunker` avec cascade :

1. Titres markdown (`\n## `, `\n### `) — `include_delim="next"` garde le titre
2. Paragraphes (`\n\n`)
3. Phrases (`. `, `! `, `? `)
4. Mots (whitespace) — fallback

`chunk_size=400` en **tokens Mistral réels** via `mistral_common`.

## Index Qdrant

Collection unique, nommée par `QDRANT_COLLECTION` (défaut neutre
`tomai_educational` ; la valeur réelle est posée par l'environnement et peut
différer). Pas de versioning dans le nom — migration via `--recreate` si le
schéma est immuable. Un pattern blue-green par alias reste à construire le
jour où une mise à jour destructive sera nécessaire (les points obsolètes ne
sont aujourd'hui jamais supprimés : les IDs étant des `uuid5` du texte, un
texte modifié crée un point et laisse l'ancien orphelin).

Config (`scripts/migrate_collection.py`) :

- `vectors_config["dense"]` : `VectorParams(size=1024, distance=COSINE)`
- `sparse_vectors_config["bm25"]` : `SparseVectorParams(modifier=Modifier.IDF)`
- `quantization_config` : Scalar int8, `quantile=0.99`, `always_ram=True`
  — 4× compression RAM, <1% perte recall sur 1024D
- Payload indexes KEYWORD sur : `niveau`, `matiere`, `cycle`, `source_file`

## Retrieval hybrid

`schema/retrieval.py:hybrid_search()` :

- Prefetch dense (`embed_model`) — `top_k * 4`
- Prefetch sparse (`sparse_method`, Qdrant calcule l'IDF server-side) — `top_k * 4`
- Fusion RRF native via `models.FusionQuery(fusion=models.Fusion.RRF)`
- Filtres exact-match sur `matiere`, `niveau`, `cycle` (KEYWORD indexes)

Configurations supportées (`embed_model`, `sparse_method`) :

- `("BAAI/bge-m3", "BAAI/bge-m3")` — **cible production** depuis le bench
  du 2026-05-23 (single forward pass FlagEmbedding, cid_recall=0.894)
- `("BAAI/bge-m3", "bm25")` — dense BGE-M3, sparse BM25 maison (compat backend)
- `("mistral-embed", "bm25")` — config historique, conservée pour migration

`schema/retrieval.py` est l'**unique** point d'accès embed + Qdrant.
Source de vérité pour `embed_query`, `embed_batch`, `encode_with_sparse`,
`sparse_query`, `hybrid_search`. Aucune duplication dans les scripts.

## BM25 sparse maison — migration terminée

> **La migration est finie** : la production utilise le sparse natif BGE-M3
> des deux côtés (ingestion et query). Le BM25 FNV-1a maison décrit
> ci-dessous n'a plus de consommateur — le backend ne tokenise plus rien
> localement. Il ne subsiste que pour l'option `--sparse-method=bm25` des
> bench A/B historiques, et est candidat à la suppression.

Quand `sparse_method="bm25"` : Qdrant ne tokenise pas côté serveur — il
reçoit `{indices: u32[], values: f32[]}` et calcule l'IDF. Pour que l'IDF
soit cohérent, le **même** algorithme de tokenisation + hash doit être
utilisé à l'ingestion (ce repo) ET à la query (backend
`tomai-monorepo/apps/server/src/services/rag.service.ts`).

Algorithme (`schema/bm25.py`) :

- Regex `[a-zàâäéèêëïîôùûüÿœæç0-9]+` (lettres FR + ligatures + chiffres)
- Lowercase
- Hash FNV-1a 32-bit, masqué 31-bit positif (`& 0x7fffffff`)

Sans parité stricte, l'IDF Qdrant est cassée silencieusement — même mot
indexé à un indice, queryé à un autre → recall écroulé.

Validation : `tests/test_bm25.py` (14 tests) + fixture export
`scripts/dump_bm25_fixture.py` consommée par le test TS côté monorepo.

## L2 normalize

- **BGE-M3 (FlagEmbedding)** : produit du L2 natif (l'attribut `dense_vecs`
  est déjà normé). Aucune normalisation client-side nécessaire.
- **sentence-transformers** : `normalize_embeddings=True` (utilisé partout
  dans `_embed_sentence_transformer`).
- **mistral-embed (API)** : ne garantit pas la normalisation L2. La
  fonction `schema/retrieval.py:l2_normalize()` est appliquée systémati-
  quement après chaque appel API Mistral (config legacy uniquement).

Sans normalisation, `Distance.COSINE` Qdrant est instable.

## Evaluation retrieval

`scripts/evaluate.py` mesure la qualité de l'INDEX uniquement. Aucun appel
LLM. Métriques déterministes, ~10 s par 60 questions.

Deux signaux complémentaires :

- **[primary] chunk_id Recall@k** : le `gold_chunk_id` (UUID5 du chunk
  source) est-il dans le top-k ? Disponible pour les questions générées
  par `generate_golden.py` (document-grounded). Signal propre, immune aux
  faux positifs lexicaux.
  - Référence : [arXiv 2510.21440](https://arxiv.org/abs/2510.21440)
    (Redefining Retrieval Evaluation in the Era of LLMs),
    [CoFE-RAG arXiv 2410.12248](https://arxiv.org/abs/2410.12248).
- **[secondary] keyword Recall@k** : fraction des `expected_keywords`
  présents dans le top-k (sous-chaîne casefold). Surestime systématiquement
  vs human-judged relevance. Conservé pour comparaison historique et
  golden sets seed (sans `gold_chunk_id`).

Toute eval LLM-judge (Faithfulness, hallucination, style socratique) est
backend.

## Golden set

`data/golden/questions.json` — schema Pydantic `schema.golden.GoldenQuestion`.
Cible 300 questions stratifiées par `(matière × niveau)`.

Génération document-grounded via `scripts/generate_golden.py` :

1. **Context sampling** : tirage stratifié par strate `(matière × niveau)`
   pour garantir une couverture équilibrée
2. **QA generation** : Mistral large génère 1 question + 3-5 keywords
   extraits textuellement du chunk, via `response_format` JSON Schema strict
3. **Anti-hallucination filter** : Pydantic vérifie que ≥2 keywords sont
   effectivement présents dans le chunk source. Sinon la question est
   rejetée.
4. **`gold_chunk_id`** calculé localement avec la même formule UUID5
   `(matière, niveau, text)` que `ingest.upsert_to_qdrant` — garantit que
   le chunk attendu est bien celui en base.

Alignement avec l'état de l'art :

- [RAGalyst arXiv 2511.04502](https://arxiv.org/abs/2511.04502) — pipeline
  agentique document-grounded, single-hop only.
- [RAGAS TestsetGenerator](https://docs.ragas.io/en/stable/concepts/test_data_generation/rag/)
  — knowledge graph + synthesizers. Notre approche est plus légère (pas de
  knowledge graph), suffisante pour un corpus déjà structuré.

Hard negatives (PrismRAG arXiv 2507.18857) : **hors scope curriculum**.
Mesurent la résilience de la **génération** (le LLM doit ignorer un
distracteur). Mesure runtime → backend.

## Veille programmes Éduscol

`scripts/veille_programmes.py` + `.github/workflows/veille_bo.yml` :

- **data.gouv.fr** — dataset `programmes-denseignement-du-second-degre`
  surveillé via `last_modified` + hash des ressources PDF
- **Légifrance PISTE API** (optionnel, secrets `PISTE_CLIENT_ID/SECRET`) —
  endpoint `consult/lastNJo` + `jorfCont` pour détecter les arrêtés MENE*
  (Éducation) publiés au JO

Workflow hebdomadaire (lundi 8h UTC) :

1. Détecte changements + télécharge nouveaux PDFs
2. Commit `data/raw/.veille_state.json`
3. Crée une GitHub Issue avec checklist d'intégration manuelle

Sortie programmatique : `data/raw/.veille_changes.json`.

## Audit de contenu du corpus (2026-08-21)

Mesuré sur les 5 266 chunks réellement produits par le pipeline, avant
réindexation. Objectif : vérifier avant de figer un index, puisqu'une
correction coûte ~2 h 20 de réingestion.

### Volumétrie

| Grandeur | Valeur |
|---|---|
| Points à indexer | 5 266 |
| Textes **uniques** à embedder | 1 651 (facteur de duplication 3,19× par expansion multi-niveaux) |
| Textes partagés entre plusieurs matières | 45 (préambules communs des langues vivantes) |

Le facteur 3,19× est voulu : un chunk de cycle est dupliqué en un point par
niveau, mais l'embedding n'est calculé qu'une fois (cf. §Contextual prefix).

### Taille des chunks, mesurée avec le tokenizer BGE-M3

C'est la mesure qui manquait : `ingest.py` règle `chunk_size=400` en **tokens
Mistral**, héritage de l'époque `mistral-embed`, alors que l'embedder est
BGE-M3 (tokenizer XLM-RoBERTa). Échantillon de 300 textes uniques, tokenisés
avec le tokenizer réel du modèle :

| | min | p10 | médiane | p90 | max |
|---|---|---|---|---|---|
| Texte brut | 30 | 95 | **259** | 346 | 860 |
| Texte embeddé (+ préfixe) | 50 | 118 | **284** | 369 | 893 |

- La cible nominale de 400 tokens Mistral produit des chunks de ~260 tokens
  BGE-M3 : l'unité de réglage n'est pas celle du modèle.
- 4,7 % dépassent 512 tokens ; **aucun** n'approche la limite de 8 192 de
  BGE-M3.
- Le préfixe contextuel coûte 23 tokens en médiane, soit 8,1 % du chunk.

Référence : le consensus re-validé en février 2026 place la zone utile entre
**256 et 512 tokens**. Le corpus est donc dans la fourchette, à son extrémité
basse — il y a de la marge, mais pas de défaut.

### Overlap : absent, et c'est défendable

`RecursiveChunker` est configuré sans `chunk_overlap`. Ce n'est pas un oubli à
corriger par réflexe : une analyse systématique de janvier 2026 (SPLADE +
Mistral-8B sur Natural Questions) ne mesure **aucun bénéfice** au recouvrement,
seulement un surcoût d'indexation. À traiter comme un paramètre à mesurer, pas
comme un défaut obligatoire.

### Artefacts d'extraction

| Constat | Part du corpus |
|---|---|
| Contient un tableau markdown | 14,4 % |
| **Fragments de tableau sans en-tête** (anti-pattern) | **0,8 % — 13 chunks** |
| Contient des `<br>` issus de l'extraction PDF | 21,0 % |
| Très court (< 150 caractères) | 2,7 % |

La bonne pratique 2026 sur les tableaux — conserver l'en-tête avec chaque
fragment — est respectée dans 218 cas sur 231. Les 13 fragments orphelins sont
négligeables.

**Hypothèse testée et écartée** : les `<br>` n'expliquent pas les matières
faibles du benchmark. L'allemand a 9 % de `<br>` et le **meilleur**
`cid_recall@5` (0,933) ; l'italien 17 % et le **pire** (0,625). Aucune
corrélation.

### Conclusion

Rien ne justifiait de modifier le pipeline avant la réindexation. Les deux
paramètres discutables — taille de chunk exprimée dans le mauvais tokenizer, et
`Modifier.IDF` appliqué à du sparse appris — sont **des candidats d'A/B, pas des
correctifs** : la baseline `cid_recall@5 = 0,894` a été mesurée avec exactement
ces chunks et cette configuration. Les changer en même temps que la
réindexation détruirait la comparabilité et reviendrait à livrer un changement
non mesuré.

## Couverture réelle du corpus

L'enum `Matiere` et le `contract.json` décrivent le **vocabulaire autorisé**,
pas ce qui est effectivement indexé. À ce jour la collection ne contient que
du **collège** : les fichiers de `data/raw/` couvrent le cycle 3 (6e), le
cycle 4 et les langues vivantes collège. Aucune source lycée n'est ingérée,
donc `seconde`/`premiere`/`terminale` et les matières lycée
(`philosophie`, `ses`, `nsi`, `snt`, `hggsp`, `hlp`) sont déclarables mais
vides. Le golden set d'évaluation est collège-only lui aussi — le
`cid_recall@5 = 0,894` ne dit rien du lycée.

Conséquence côté backend : tout niveau ou toute matière exposé à l'agent
sans contrepartie dans le corpus renvoie zéro résultat en silence. Le
contrat doit être vérifié dans les deux sens.

## Sources officielles

| Matière / niveau | Fichier source | BO |
|---|---|---|
| Cycle 3 (6e) — toutes matières | `programme_cycle3_BO2020.md` | 30/07/2020 |
| Cycle 4 BO 2020 — FR/HG/PC/SVT/EMC/Arts/Musique/EPS/HDA | `programme_cycle4_BO2020.md` | 30/07/2020 |
| Maths cycle 4 | `programme_maths_cycle4_BO2026.md` | 05/03/2026 |
| Technologie cycle 4 | `programme_technologie_cycle4_BO2024.md` | 29/02/2024 |
| Langues vivantes collège | `programme_{anglais,espagnol,allemand,italien}_college_BO2025.md` | 29/05/2025 |

URLs + procédure de régénération : `data/raw/sources_officielles.md`.
Inventaire de référence : `data/raw/programmes_second_degre_datagouv.json`.

## Audit coverage

`scripts/audit_coverage.py` vérifie que les titres de sections des BO
officiels sont présents dans la collection. Deux signaux :

- **Couverture texte** : `chars_indexés / chars_source`
- **Couverture sections** : % des titres extraits du BO présents dans ≥1 chunk

Diagnostic : `--list-missing` liste les titres BO non couverts.
Rapport horodaté : `docs/audits/coverage_YYYY-MM-DD.md`.

Dernière mesure (2026-05-18) : 100 % texte indexé sur toutes les matières,
couverture sections BO 79 % (maths) à 100 % (SVT, EMC).

## Frontière des contrats avec le backend

Le backend (`tomai-monorepo/apps/server`) consomme l'index Qdrant via une
couche `qdrant.service.ts` + `rag.service.ts`. **Contrats critiques** :

- **Payload Qdrant** stable : `text, section, matiere, niveau, cycle,
  source_file, chunk_index`. Tout ajout/retrait de champ doit être planifié
  avec le backend.
- **Embedding query** : doit utiliser `BAAI/bge-m3` via FlagEmbedding
  (single forward pass dense+sparse). Plus de tokenizer BM25 maison —
  le backend doit exposer un service Python embed ou appeler un endpoint
  dédié (cf. §Recommandations backend).
- **Nom de collection** partagé via variable d'env `QDRANT_COLLECTION`.

## Décision benchmark embedder (2026-05-23)

Trois configurations mesurées sur 189 questions document-grounded
(top-5, RRF fusion) :

| Configuration | cid_recall@5 | MRR | min par matière |
|---|---|---|---|
| mistral-embed + BM25 maison (baseline) | 0.810 | 0.576 | 0.429 (espagnol) |
| BGE-M3 + BM25 maison | 0.857 | 0.654 | 0.583 (anglais) |
| **BGE-M3 + BGE-M3 sparse natif** (adopté) | **0.894** | **0.739** | **0.625 (italien)** |

Gains adoption sur les matières bloquantes :

- allemand : 0.600 → **0.933** (+0.333)
- espagnol : 0.429 → **0.714** (+0.285)
- arts_plastiques : 0.692 → **0.923** (+0.231)
- anglais : 0.750 stable (récupéré après régression intermédiaire)
- MRR global : 0.576 → **0.739** (+0.163, ranking nettement meilleur)

Régressions résiduelles à surveiller : technologie (-0.222), italien
(n=8 trop petit pour conclure).

Bascule effectuée : le backend a migré, il n'existe plus qu'une seule
collection servie, dont le nom vient de `QDRANT_COLLECTION` (défaut neutre
`tomai_educational` dans le code, valeur réelle posée par l'environnement).
`tomai_educational_bge_native` et `..._legacy_mistral` étaient des noms de
travail du bench, pas des collections vivantes.

## Pistes restantes (sans engagement prématuré)

1. **`chunk_size` 400 → 512 tokens** — consensus 2025-2026 (Vecta, Firecrawl,
   PreMAI). Gain attendu ~2-5 %. À tester sur la nouvelle baseline BGE-M3.
2. ~~**`Fusion.RRF` → `Fusion.DBSF`** (Qdrant 1.11+)~~ — **mesuré** sur
   mistral-embed : inconclusif (gagne DE/ES, régresse français). À retester
   sur BGE-M3 + sparse natif maintenant qu'on a une nouvelle baseline.
3. **Bump `pymupdf4llm`** à la dernière release ([github.com/pymupdf/pymupdf4llm/releases](https://github.com/pymupdf/pymupdf4llm/releases))
   pour gains perf et extras `[layout]`.
4. **Investiguer technologie + italien** — re-générer un golden ciblé
   (50 questions chacun) pour départager bruit statistique vs vraie
   régression structurelle de BGE-M3 sur ces matières.

## Recommandations backend — état au 2026-08-21

Cette section listait, en mai 2026, deux recommandations issues de la
recherche état de l'art. **Les deux sont tranchées.** Elle est conservée
comme trace de décision, pas comme feuille de route.

### #1 — Exécuter BGE-M3 côté backend · **FAIT**

Le sparse natif BGE-M3 est appris, donc non reproductible en TS pur. La
recommandation était de monter un service Python. C'est fait :
`apps/ai-service` (FastAPI + FlagEmbedding) sert `/embed` (dense + sparse,
un seul forward pass), déployé sur Koyeb, appelé par `rag.service.ts` côté
backend et par `src/clients/ai_service.py` côté curriculum. Le tokenizer
BM25 maison a disparu des deux côtés.

### #2 — Reranker de second étage · **ÉCARTÉ le 2026-07-01, sur mesure**

> La version précédente de cette section recommandait `mxbai-rerank-large-v2`
> et écartait `bge-reranker` pour « origine Chine, souveraineté discutable ».
> **Ce critère était faux et n'est pas celui qui a tranché** : des poids
> self-hostés n'exfiltrent aucune donnée, et l'embedder de production est
> lui-même un modèle BAAI. Le texte est corrigé ici pour que la décision ne
> soit pas rouverte sur de mauvaises bases.

Ce qui a réellement tranché :

- **Le meilleur modèle était `bge-reranker-v2-m3`** (Apache 2.0, MIRACL
  69,32 en multilingue, le plus léger des trois évalués — devant
  `jina-reranker-v3`, écarté pour sa licence CC-BY-NC incompatible avec un
  produit payant, et devant `Qwen3-Reranker` 4B/8B, trop lourd).
- **La latence CPU l'a disqualifié** : 43 à 180 s pour 20 candidats sur
  l'instance de test (mesure du 2026-06-25 ; 15-19 s pour 25 chunks en
  sentence-transformers comme en TEI-candle). Face au timeout de quelques
  secondes du client backend, le rerank aurait timeouté systématiquement —
  coût pur, aucun effet sur le classement.
- **Les options managées sont exclues pour la souveraineté des données**,
  pas des poids : Jina appartient à Elastic (US, CLOUD Act), Cohere est US,
  le « rerank » Scaleway est une similarité cosinus d'embeddings et non un
  cross-encoder, ni OVH ni Mistral n'exposent de reranker.
- **La rentabilité n'est pas démontrée sur ce corpus** : quelques milliers
  de chunks, hybrid déjà tuné, top-k 5.

Conséquence : `apps/ai-service` est **embed-only** (l'endpoint `/rerank` est
supprimé, un test de non-régression garde la porte fermée) et y a gagné
~2 GB de RAM.

Rouvrir le sujet suppose de résoudre **la latence** en premier — ONNX/INT8
généré à la main (`bge-reranker-v2-m3` n'a pas d'ONNX publié) ou GPU à
Tensor Cores — et de mesurer le gain réel de `cid_recall@5` sur le golden
set. Pas de rediscuter la licence ni l'origine.

## Références

### Documentation officielle (sources de vérité)

- [Mistral structured outputs](https://github.com/mistralai/platform-docs-public/blob/main/src/app/(docs)/(products)/studio-api/conversations/structured-output/custom/page.mdx)
- [Mistral embeddings](https://docs.mistral.ai/capabilities/embeddings)
- [Qdrant hybrid queries (RRF, DBSF)](https://qdrant.tech/documentation/search/hybrid-queries/)
- [Qdrant sparse vectors](https://qdrant.tech/articles/sparse-vectors/)
- [Qdrant quantization](https://qdrant.tech/documentation/guides/quantization/)
- [Anthropic Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval)
- [PyMuPDF4LLM](https://pymupdf.readthedocs.io/en/latest/pymupdf4llm/)
- [Chonkie RecursiveChunker](https://github.com/chonkie-inc/chonkie)
- [RAGAS docs](https://docs.ragas.io/en/stable/)

### Recherche académique citée

- [arXiv 2511.04502 — RAGalyst](https://arxiv.org/abs/2511.04502)
- [arXiv 2510.21440 — Redefining Retrieval Evaluation in the Era of LLMs](https://arxiv.org/abs/2510.21440)
- [arXiv 2410.12248 — CoFE-RAG](https://arxiv.org/abs/2410.12248)
- [arXiv 2507.18857 — PrismRAG](https://arxiv.org/abs/2507.18857)
