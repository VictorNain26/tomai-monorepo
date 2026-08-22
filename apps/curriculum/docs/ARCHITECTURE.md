# Architecture — tomai-curriculum

Source de vérité unique sur l'architecture du pipeline RAG des programmes
officiels Éduscol.

> ## État courant
>
> | Moitié de la recherche | Qui la produit |
> |---|---|
> | dense, 1024D | **OVHcloud AI Endpoints**, `Qwen3-Embedding-8B` tronqué par MRL |
> | creux, `bm25` | **Qdrant Cloud Inference**, calculé côté serveur |
>
> **Aucun modèle n'est hébergé ni chargé par ce dépôt.** Raisonnement complet :
> `docs/adr/0002-embeddings-manages.md`.
>
> Les sections datées plus bas (audit de contenu, mesures de chunk) sont des
> relevés d'époque : elles disent ce qui a été mesuré, quand, et avec quel
> outillage.


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

- **Embeddings denses** : `Qwen3-Embedding-8B` servi par OVHcloud AI Endpoints
  (Gravelines), tronqué à 1024D par Matryoshka. Rien n'est auto-hébergé.
- **Vecteur creux** : `bm25` calculé par Qdrant Cloud Inference, côté serveur.
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
       ├─ ovh_embeddings.embed()   dense via OVH (préfixe contextuel
       │                           hiérarchique sans LLM ; documents SANS
       │                           instruction, celle-ci est réservée aux
       │                           requêtes)
       └─ upsert_to_qdrant()       named {dense, bm25}, le creux étant envoyé
                                   en models.Document → Qdrant le vectorise.
                                   Idempotent :
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

La configuration n'est plus un couple de modèles à choisir : le dense vient
d'OVH (`OVH_EMBED_MODEL` + `OVH_EMBED_DIMENSIONS`) et le creux est toujours le
`bm25` de Qdrant. Le modèle et la dimension **doivent** correspondre à ceux qui
ont bâti l'index — `contract.json` → `collection.dense` en est la source de
vérité, et un test l'impose des deux côtés.

`schema/retrieval.py` est l'**unique** point d'accès recherche + Qdrant, et
`src/clients/ovh_embeddings.py` l'unique point d'accès embedding.
`hybrid_search(retrieval_mode=...)` permet d'isoler une branche pour la
mesurer. `HNSW_EF` y est aligné sur celui du serveur : une évaluation qui
explore autrement mesure une configuration que personne ne déploie.

## L2 normalize

- **OVH AI Endpoints** : renvoie des vecteurs L2-normés (norme vérifiée à
  1,000000), y compris **après troncature MRL** — OVH tronque puis renormalise
  côté serveur. Aucune normalisation ni troncature à faire chez nous.
  Exception à connaître : `bge-multilingual-gemma2` renvoie du **non normé**
  (norme ~177) ; Qdrant en distance Cosine le gère, mais il faut le savoir.
`l2_normalize()` reste dans `schema/retrieval.py` comme utilitaire pur, testé,
au cas où un fournisseur renverrait du non normé.

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
correction coûtait alors ~2 h 20 de réingestion.

> **Ce coût a été divisé par 25.** Depuis la bascule sur les embeddings
> managés, une réindexation complète prend **~5 minutes** et coûte quelques
> centimes. Vérifier avant de figer reste une bonne habitude, mais ce n'est
> plus une décision — réindexer est devenu une pause café.

### Volumétrie

| Grandeur | Valeur |
|---|---|
| Points à indexer | 5 266 |
| Textes **uniques** à embedder | 1 651 (facteur de duplication 3,19× par expansion multi-niveaux) |
| Textes partagés entre plusieurs matières | 45 (préambules communs des langues vivantes) |

Le facteur 3,19× est voulu : un chunk de cycle est dupliqué en un point par
niveau, mais l'embedding n'est calculé qu'une fois (cf. §Contextual prefix).

### Taille des chunks

> ⚠️ **Nombres à refaire.** Ils ont été relevés avec un tokenizer différent de
> celui en service. Le raisonnement tient — **l'unité de réglage n'est pas
> celle du modèle** — mais les valeurs ne décrivent plus l'index. À reprendre
> avec le tokenizer de `Qwen3-Embedding` avant de toucher `chunk_size`.

`ingest.py` règle `chunk_size=400` en **tokens Mistral**, héritage d'un
embedder précédent. Échantillon de 300 textes uniques :

| | min | p10 | médiane | p90 | max |
|---|---|---|---|---|---|
| Texte brut | 30 | 95 | **259** | 346 | 860 |
| Texte embeddé (+ préfixe) | 50 | 118 | **284** | 369 | 893 |

- La cible nominale de 400 tokens Mistral produit des chunks de ~260 tokens
  du modèle : l'unité de réglage n'est pas celle du modèle.
- 4,7 % dépassent 512 tokens ; `Qwen3-Embedding` en accepte 32 768, donc la
  marge est large.
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
Catalogue officiel : API `data.education.gouv.fr` (dataset
`fr-en-programmes-enseignement-2nd-degre`), mis en cache dans
`data/raw/catalogue_second_degre.json` par `scripts/refresh_catalogue.py`.

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
- **Embedding query** : doit utiliser le **même modèle ET la même dimension**
  que l'index (`contract.json` → `collection.dense`), avec l'instruction de
  requête. Le creux n'est plus produit côté client : Qdrant le calcule.
  Historique (périmé) — le backend devait appeler un service Python ou un endpoint
  dédié (cf. §Recommandations backend).
- **Nom de collection** partagé via variable d'env `QDRANT_COLLECTION`.

## Réindexation vérifiée (2026-08-21)

Le cluster Qdrant Cloud précédent avait été supprimé par la politique
d'inactivité du free tier. Après recréation et réingestion complète, la
mesure confirme que la restauration est **fidèle et non approximative**.

| | benchmark 2026-05-23 | après réindexation | écart |
|---|---|---|---|
| hit_rate@5 | 0,894 | **0,894** | 0,000 |
| MRR@5 | 0,739 | **0,737** | −0,002 |
| nDCG@5 | — | **0,777** | nouvelle métrique |

Les cinq matières citées dans le benchmark de mai sont reproduites **au
millième près** : allemand 0,933, espagnol 0,714, italien 0,625, anglais 0,750,
arts plastiques 0,923.

Volumétrie : 5 266 points envoyés, **5 238 comptés**. L'écart de 28 est
l'idempotence à l'œuvre — les IDs étant `uuid5(matière:niveau:texte)`, des
textes strictement identiques dans le même couple matière/niveau partagent un
ID et s'écrasent.

### Détail par matière — ce que le benchmark de mai ne montrait pas

| Parfaites (1,000) | Faibles |
|---|---|
| mathematiques, histoire_geo, physique_chimie, svt, eps, education_musicale | technologie 0,667 · italien 0,625 · espagnol 0,714 · anglais 0,750 |

`sciences_technologie` affiche 0,750 sur **4 questions seulement** — trop peu
pour conclure. La régression « technologie » signalée en mai est confirmée.

**Constat qui déborde sur le backend** : `histoire_geo` et `physique_chimie`
obtiennent un retrieval **parfait**. Ce sont pourtant les deux matières que
l'agent ne peut pas atteindre, puisqu'il demande `histoire`, `geographie` et
`physique-chimie` (constat P0-1). L'index est irréprochable et le contrat de
l'agent jette le résultat.

Baseline de référence sauvegardée pour les comparaisons futures — RRF contre
DBSF, IDF activé ou non, taille de chunk :

```bash
uv run python scripts/evaluate.py --fusion dbsf --save-run runs/dbsf.json
uv run python scripts/evaluate.py --compare runs/rrf-2026-08-21.json runs/dbsf.json
```

La seconde commande dit si l'écart est **statistiquement significatif**
(randomisation de Fisher, p < 0,05) — c'est ce qui manquait pour trancher ces
A/B sans conclure sur du bruit.

## Pistes restantes (sans engagement prématuré)

> Toutes ces pistes supposent de pouvoir **mesurer un écart de 2-3 points**.
> Or notre golden set a un plancher de bruit de ±1 point et un biais de
> provenance (questions générées depuis les chunks à retrouver). **L'instrument
> passe donc avant les pistes** — les classer par gain espéré sans savoir les
> mesurer, c'est choisir au hasard avec méthode.

1. **Reranking** — le plus gros levier identifié, et il ne dépend pas de
   l'embedder : `hit_rate@20 = 0,984` contre `hit_rate@5 = 0,894`. Le bon chunk
   est déjà récupéré dans 98,4 % des cas mais n'atteint le top-5 que 89,4 % du
   temps : **~9 points sont réordonnables**. Aucun reranker chez OVH à ce jour
   (demande ouverte sur leur roadmap) ; EUrouter, GreenPT et Jina en proposent.
2. **BM25 aide-t-il vraiment sur ce corpus ?** Observation non concluante mais
   nette : sur « calculer la longueur de l'hypoténuse », le dense place le bon
   chunk en #1 et **la fusion RRF le fait chuter en #3**, parce que le chunk
   pertinent ne contient pas le mot « hypoténuse ». Désaccord de vocabulaire
   classique. Une anecdote ne justifie pas de toucher à l'architecture — mais
   `hybrid_search(retrieval_mode=...)` permet de le mesurer.
3. **`chunk_size` 400 → 512 tokens** — consensus 2025-2026. À reprendre en
   mesurant d'abord avec le tokenizer de `Qwen3-Embedding` (cf. §Taille des
   chunks, dont les nombres sont périmés).
4. **`Fusion.RRF` → `Fusion.DBSF`** — mesuré une fois, inconclusif. À
   retester sur la configuration actuelle.
5. **Bump `pymupdf4llm`** ([releases](https://github.com/pymupdf/pymupdf4llm/releases))
   pour gains perf et extras `[layout]`.
6. **Investiguer technologie + italien** — matières faibles depuis mai. Le
   golden ciblé (50 questions chacun) hériterait du même biais de provenance :
   à faire avec des questions réelles, pas générées.

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
