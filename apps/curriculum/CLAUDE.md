# Curriculum (apps/curriculum)

Pipeline RAG éducatif : programmes officiels Éduscol → chunking → embedding
**dense `Qwen3-Embedding-8B` via OVH AI Endpoints** → index Qdrant (alias
`tomai_educational` → collection `tomai_qwen3`), dont le **vecteur creux BM25
est calculé par Qdrant lui-même** (Cloud Inference). Ce repo gère **uniquement l'index RAG** ; la couche LLM
(chat, prompting, tutorat) appartient exclusivement à `apps/server`.

> Origine : repo `VictorNain26/tomai-curriculum` (archivé en lecture seule),
> migré sous le monorepo le 2026-06-10 par copie simple (pas de subtree).
> Détail métier (règles dataset, décisions archi, souveraineté EU) :
> `docs/ARCHITECTURE.md` et `data/raw/sources_officielles.md`.

## App Python indépendante

Pas de workspace uv, pas de package pnpm, pas de tâche turbo. Outillage `uv` local.

```bash
cd apps/curriculum
uv sync --all-extras                                # install (deps + extras dev/eval)

# Pipeline (nécessite OVH_AI_ENDPOINTS_TOKEN + Qdrant ; cf. .env.example)
uv run python scripts/migrate_collection.py         # crée la collection (dimension SONDÉE depuis le modèle)
uv run python scripts/ingest.py                     # chunk + embed OVH + upsert (bm25 calculé par Qdrant)
uv run python scripts/export_contract.py            # régénère contract.json
uv run python scripts/query.py "Pythagore" --matiere=mathematiques --niveau=quatrieme

# Diagnostic / éval
uv run python scripts/coverage_report.py            # couples (niveau × matière) sans contenu
uv run python scripts/evaluate.py --by-matiere      # golden set maison — NON-RÉGRESSION seulement
uv run python scripts/evaluate.py --compare runs/a.json runs/b.json   # + test de significativité

# Qualité
uv run ruff check . && uv run ruff format --check .
uv run pytest -q
```

## Embedding

**Aucun modèle n'est hébergé, ni ici ni ailleurs dans le dépôt.** Les deux
moitiés de la recherche sont déléguées à deux endroits différents :

| moitié | qui la produit | coût |
|---|---|---|
| dense (**1024D**, tronqué de 4096 par MRL) | OVH AI Endpoints, `Qwen3-Embedding-8B` (Gravelines) | 0,1 €/Mtoken |
| creux (BM25) | Qdrant Cloud Inference, `models.Document(model="bm25")` | gratuit, illimité |

Pourquoi deux fournisseurs : la spécification OpenAI `/v1/embeddings` n'a
**aucun champ** pour un vecteur creux, donc aucun fournisseur managé ne peut en
renvoyer un. Ce n'est pas un retard de l'écosystème, c'est le contrat d'API. Un
service Python maison produisait ce creux jusqu'au 2026-08-21 ; mesure faite, le
BM25 de Qdrant fait aussi bien (hit_rate@5 identique) pour zéro maintenance.

Pièges vérifiés sur l'API réelle, pas déduits :
- **lots plafonnés à 25 entrées** côté OVH (HTTP 400 au-delà) ;
- **Matryoshka (MRL)** : `dimensions` est accepté par OVH et borné à [32, 4096].
  Le serveur tronque **puis renormalise** — vérifié : écart de 0,0013 avec le
  préfixe renormé contre 0,085 avec le préfixe brut. Ne jamais tronquer
  soi-même, ce serait refaire mal ce qu'ils font bien ;
- Qwen3-Embedding attend une **instruction sur les requêtes, jamais sur les
  documents** (`DEFAULT_QUERY_INSTRUCTION` dans `schema/retrieval.py`, à garder
  identique au défaut du serveur). Mesuré : +1,6 pt de hit_rate@5.

## Comment on évalue — et pourquoi deux outils

| Question | Outil | Statut du chiffre |
|---|---|---|
| Le modèle est-il bon ? | **MTEB / MTEB-French** (publié) | référence, pas re-mesuré ici |
| Notre embedder tient-il sur du scolaire français ? | `benchmark_mteb.py` → **AlloprofRetrieval** | **mesure de qualité** |
| Ai-je cassé quelque chose ? | `evaluate.py` → golden set maison | **non-régression uniquement** |

**Le golden set maison ne mesure pas la qualité, et ne doit pas être présenté
comme tel.** Ses questions sont générées par un LLM *à partir des chunks qu'il
faut retrouver* — or les retrievers neuronaux sont biaisés en faveur des textes
générés par LLM ([arXiv 2310.20501](https://arxiv.org/pdf/2310.20501)), il n'y
a qu'un seul document pertinent par question, et deux exécutions identiques
varient de ±1 point (HNSW approximatif + égalités RRF). C'est un bon détecteur
de casse ; ce n'est pas un baromètre.

`AlloprofRetrieval` (MTEB-French, [arXiv 2405.20468](https://arxiv.org/abs/2405.20468))
est ce qui s'en rapproche le plus tout en étant honnête : 2 316 vraies questions
d'élèves francophones, 2 556 documents, jugements produits par le service
Alloprof. Le harnais teste **l'embedder de production**, via l'API réelle.
Licence `cc-by-nc-sa-4.0` : évaluation uniquement, pas de redistribution.

**Résultat du 2026-08-21** — `Qwen3-Embedding-8B` @1024D via OVH, sur
`AlloprofRetrieval` : **nDCG@10 = 0,66** (18 min, ~0,25 €). Repères publiés sur
la *même tâche* (MTEB-French, table 6, 46 modèles) : meilleur du papier 0,53
(`voyage-code-2`), `text-embedding-ada-002` 0,52, `multilingual-e5-large` 0,38,
la plupart entre 0,20 et 0,40. Nuance : le papier date de mai 2024, notre modèle
de juin 2025 — l'écart flatte. Validation du harnais : `SyntecRetrieval` 0,88.

## Frontière avec le backend

`apps/server` consomme l'index via `qdrant.service.ts` + `rag.service.ts`. Le
contrat de données est figé dans `contract.json` (exporté depuis
`schema/document.py`) et vérifié par des tests de conformité côté server. Payload
canonique (7 champs) : `text, section, matiere, niveau, cycle, source_file,
chunk_index`. La query est embeddée côté server par le même modèle OVH, et son
creux calculé par le même Qdrant — les deux côtés doivent utiliser le même
modèle, sinon la requête cherche dans un autre espace vectoriel.

## Env

`OVH_AI_ENDPOINTS_TOKEN`, `OVH_EMBED_MODEL`, `QDRANT_URL`, `QDRANT_API_KEY`,
`QDRANT_COLLECTION` (défaut `tomai_educational`), `MISTRAL_API_KEY` (authoring du
golden set uniquement), `PISTE_*` (veille BO, optionnel).
