# TomAI Curriculum — Index RAG souverain EU

Pipeline d'indexation des **programmes officiels Éduscol** (collège 6e → 3e)
pour le RAG du tuteur TomAI.

**Scope** : ce repo gère **UNIQUEMENT l'index** (PDF → markdown → chunks →
Qdrant). La couche LLM (chat socratique, prompting, hallucination eval) est
la responsabilité du backend `tomai-monorepo/apps/server`. Source de vérité
architecture : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

**Souveraineté EU stricte** : embeddings denses OVHcloud AI Endpoints (Gravelines, « data is not stored or shared ») + Qdrant Cloud. Aucun modèle auto-hébergé.
Aucun SaaS hors UE.

> **Index = Qdrant Cloud, source unique de vérité** (partagée dev + prod). Ce
> pipeline **construit/maintient** cet index — c'est un job **rare** (les
> programmes BO bougent ≈ annuellement), **pas** une étape de setup par dev. Un
> dev qui code sur l'app consomme l'index Cloud directement (cf. README racine),
> il ne lance jamais ce pipeline. Nom de collection = config d'env
> (`QDRANT_COLLECTION`, défaut neutre `tomai_educational`).

## État

| Indicateur | Valeur |
|---|---|
| Collection Qdrant | `tomai_educational` (5238 points uniques) |
| Niveaux couverts | 6e, 5e, 4e, 3e (collège complet) |
| Matières | 16 (tronc commun + LV + arts + EPS + sciences-techno) |
| Coverage sections BO | **100 %** sur toutes les matières (audit 2026-05-18, sans faux positif) |
| Retrieval baseline | golden set maison = **non-régression uniquement** (tâche *known-item*, questions générées depuis les chunks). Qualité du modèle : voir MTEB-French. Qualité du pipeline : voir Alloprof. |
| Tests | 82 pass · ruff clean |

### Baseline par matière (top-5, golden 189 questions, dense OVH + BM25 Qdrant)

| Matière | n | cid_recall@5 | MRR |
|---|---|---|---|
| eps, histoire_geo, mathematiques, education_musicale, physique_chimie, svt | 71 | **1.000** | 0.83-1.00 |
| allemand | 15 | 0.933 | 0.811 |
| arts_plastiques | 13 | 0.923 | 0.923 |
| langues_vivantes | 10 | 0.900 | 0.883 |
| emc | 11 | 0.909 | 1.000 |
| francais | 16 | 0.875 | 0.771 |
| histoire_des_arts | 13 | 0.846 | 0.833 |
| anglais | 12 | 0.750 | 0.794 |
| sciences_technologie | 4 | 0.750 | 1.000 |
| espagnol | 7 | 0.714 | 0.857 |
| technologie | 9 | 0.667 | 0.781 |
| italien | 8 | 0.625 | 0.875 |

**Findings** (relevé de mai 2026, embedder de l'époque) :
- Gains du switch d'embedder : **allemand** 0.60→0.93 (+0.33), **espagnol**
  0.43→0.71 (+0.28), **arts_plastiques** 0.69→0.92 (+0.23). MRR global +0.16.
- Italien (n=8) et technologie restent les 2 matières faibles. Un golden ciblé
  hériterait du même biais de provenance : à reprendre avec de vraies questions.

> **Où on en est** : l'embedder est `Qwen3-Embedding-8B` @1024D servi par
> OVHcloud AI Endpoints, et le vecteur creux est le `bm25` calculé par Qdrant.
> Raisonnement complet : `docs/adr/0002-embeddings-manages.md`.

## Architecture

```
schema/
├── document.py        Pydantic Chunk + dérivation niveaux + MATIERE_LABELS
├── contextual.py      Préfixe contextuel hiérarchique (gratuit, sans LLM)
└── retrieval.py       Accès Mistral/Qdrant partagé (embed, hybrid_search, L2 normalize)

scripts/
├── extract_pdfs.py        PDF → markdown via pymupdf4llm (vrais H2)
├── ingest.py              .md → chunks → dense OVH → upsert (bm25 calculé par Qdrant)
├── migrate_collection.py  Création collection (named vectors + indexes)
├── query.py               Test interactif retrieval (chunks bruts, pas de LLM)
├── evaluate.py            Métriques retrieval déterministes (chunk_id recall, MRR)
├── generate_golden.py     Génère le golden set document-grounded
├── audit_coverage.py      % titres BO indexés + `--list-missing` debug
└── veille_programmes.py   Détecte changements BO (data.gouv + Légifrance)

data/
├── raw/                   PDFs + markdowns sources + manifest data.gouv
└── golden/                Questions de test + résultats eval (versionnés)

docs/ARCHITECTURE.md       Source de vérité unique sur l'architecture
docs/audits/               Rapports coverage horodatés
```

## Construire / rafraîchir l'index (job rare)

Pipeline de build de l'index Cloud. À lancer quand le **contenu** change, pas en
setup dev. `QDRANT_URL` pointe le Qdrant Cloud (`https://` + `QDRANT_API_KEY`) ;
OVH AI Endpoints fait l'embedding dense ; Qdrant calcule le creux.

```bash
# 1. Setup
cp .env.example .env       # QDRANT_URL (Cloud https), QDRANT_API_KEY, OVH_AI_ENDPOINTS_TOKEN, MISTRAL_API_KEY
uv sync --all-extras

# 2. Extraire les PDFs en markdown (idempotent)
uv run python scripts/extract_pdfs.py

# 3. Créer la collection Qdrant cible (idempotent)
uv run python scripts/migrate_collection.py

# 4. Ingérer (chunking + embeddings + upsert)
#    ~5 min pour le corpus complet (~0,03 €). Lots plafonnés à 25 entrées :
#    c'est une limite DURE d'OVH (HTTP 400 au-delà), pas un réglage de confort.
EMBED_BATCH_SIZE=16 uv run python scripts/ingest.py

# 5. Tester le retrieval
uv run python scripts/query.py "Théorème de Pythagore" --matiere=mathematiques --niveau=quatrieme

# 6. Générer le golden set document-grounded (one-shot offline)
uv run python scripts/generate_golden.py --target=300

# 7. Vérifier la qualité
uv run python scripts/audit_coverage.py              # coverage par matière
uv run python scripts/audit_coverage.py --list-missing  # titres BO non couverts
uv run python scripts/evaluate.py --by-matiere       # chunk_id recall + MRR

# 8. Veille BO
uv run python scripts/veille_programmes.py
```

## Mise à jour du contenu

Les IDs de points sont déterministes sur le contenu :
`uuid5(NAMESPACE_URL, sha256("matière:niveau:texte"))`.

- **Ajouter** (nouvelle matière/section) → propre et idempotent : nouveaux textes
  = nouveaux IDs, l'existant n'est pas touché. Re-`ingest.py` (ou `--matiere=X`).
- **Modifier / supprimer** du contenu existant → ⚠️ le pipeline **ne supprime pas
  les points obsolètes** : un texte changé crée un nouveau point et **laisse
  l'ancien** (son hash n'existe plus) → orphelin retrievable, données périmées.

Pour modifier sans laisser d'orphelins (à mettre en place **quand le besoin réel
arrive**, pas avant) : **blue-green via alias Qdrant** — le serveur interroge un
alias stable, on ingère dans une nouvelle collection versionnée, puis swap
atomique de l'alias (`update_collection_aliases`) → zéro coupure, zéro orphelin,
rollback instantané. Pour une retouche ciblée : `delete-by-matiere` avant de
ré-ingérer cette matière.

## Qualité & CI

```bash
uv run ruff check schema/ scripts/ tests/
uv run ruff format schema/ scripts/ tests/
RUN_MISTRAL_TOKENIZER_TESTS=1 uv run pytest tests/
```

GitHub Actions :
- `ci.yml` — lint + tests à chaque PR / push main
- `veille_bo.yml` — veille Eduscol hebdomadaire (issue GitHub si changement)

## Sources officielles

- **Éduscol** : <https://eduscol.education.gouv.fr/>
- **Bulletin Officiel** : <https://www.education.gouv.fr/pid285/bulletin_officiel.html>
- **Catalogue officiel** : API `data.education.gouv.fr`, dataset
  `fr-en-programmes-enseignement-2nd-degre` — cache local
  `data/raw/catalogue_second_degre.json`, régénéré par
  `scripts/refresh_catalogue.py`
- **Légifrance PISTE** : <https://piste.gouv.fr> (option, pour veille temps réel)

Inventaire détaillé des fichiers et URLs : `data/raw/sources_officielles.md`.

## License

MIT — contenu pédagogique extrait des programmes officiels (domaine public,
Open Etalab pour les annexes Eduscol).
