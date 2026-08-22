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
| Collection Qdrant | alias `tomai_educational` → collection horodatée |
| Périmètre | collège complet + lycée **général** (voies techno et pro exclues) |
| Manifeste | 150 entrées publiées, **114 couples (niveau × matière)** en vigueur à la rentrée 2026 |
| Sources | 56 PDF officiels, téléchargés depuis le manifeste |
| Couverture | `scripts/coverage_report.py` — sort en 1 sur toute case attendue et vide |
| Fraîcheur | ⚠ veille des réformes **non branchée** : les identifiants PISTE n'existent pas encore |

Le corpus n'est plus une liste de fichiers rassemblés à la main. Un manifeste
**daté** (`schema/programmes.py`) dit ce qui doit exister pour une rentrée
donnée, l'index dit ce qui existe, et un test compare les deux. C'est ce qui
manquait : l'ancienne métrique comparait l'index à lui-même et bornait le
résultat à 100 %, si bien qu'un lycée entièrement absent passait pour couvert.

> **Embedder** : `Qwen3-Embedding-8B` @1024D servi par OVHcloud AI Endpoints,
> vecteur creux `bm25` calculé par Qdrant. Raisonnement complet :
> `docs/adr/0002-embeddings-manages.md`.

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
├── refresh_catalogue.py   Catalogue officiel (API du ministère) → cache local
├── fetch_sources.py       Télécharge les PDF que le manifeste déclare en vigueur
├── coverage_report.py     Couples (niveau × matière) attendus vs indexés
└── veille_programmes.py   Détecte les arrêtés de programme (Légifrance/PISTE)

data/
└── raw/                   catalogue officiel (commité) + pdf/ (ignoré, régénérable)

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

# 6. Vérifier la couverture
uv run python scripts/coverage_report.py             # sort en 1 sur toute case vide

# 7. Veille des réformes (nécessite PISTE_CLIENT_ID / PISTE_CLIENT_SECRET)
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
