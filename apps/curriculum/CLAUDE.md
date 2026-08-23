# Curriculum

Pipeline d'indexation RAG : programmes officiels → chunking → embedding BGE-M3 via
`apps/ai-service` → index Qdrant. Cette app produit **uniquement l'index** ; toute
la couche LLM (chat, prompting, tutorat) appartient à `apps/server`.

App **Python autonome** : pas de package pnpm, pas de tâche turbo, outillage `uv`
local. Elle est explicitement exclue du workspace (`pnpm-workspace.yaml`).

```bash
cd apps/curriculum
uv sync --all-extras

uv run python scripts/migrate_collection.py     # crée la collection
uv run python scripts/ingest.py                 # chunk + embed + upsert
uv run python scripts/export_contract.py        # régénère contract.json
uv run python scripts/query.py "Pythagore" --matiere=mathematiques --niveau=quatrieme

uv run python scripts/audit_coverage.py         # % de titres BO indexés (--list-missing)
uv run python scripts/evaluate.py --by-matiere  # Recall@k / MRR, déterministe

uv run ruff check . && uv run ruff format --check .
uv run pytest -q
```

## Embedding

**Aucun modèle chargé localement** : `src/clients/` appelle `ai-service /embed`
(dense 1024D + sparse natif BGE-M3, au format Qdrant). Lancer l'ai-service depuis
la racine du monorepo (`docker compose up -d ai-service`), ou pointer
`AI_SERVICE_URL` vers le déploiement.

## Contrat avec le backend

`apps/server` consomme l'index via `qdrant.service.ts` et `rag.service.ts`. Le
contrat de données est **figé dans `contract.json`** (exporté depuis
`schema/document.py`) et vérifié par des tests de conformité côté serveur : le
modifier casse le serveur, régénérer `contract.json` fait partie du changement.

Payload canonique, sept champs : `text, section, matiere, niveau, cycle,
source_file, chunk_index`.

La requête est embeddée côté serveur par le **même** `ai-service /embed` — aucune
tokenisation locale d'un côté ni de l'autre, sans quoi les deux espaces
vectoriels divergent.

## Variables

`AI_SERVICE_URL`, `AI_SERVICE_TOKEN`, `QDRANT_URL`, `QDRANT_API_KEY`,
`QDRANT_COLLECTION`, `MISTRAL_API_KEY` (authoring du golden set uniquement),
`PISTE_*` (veille BO, optionnel).

Décisions métier et souveraineté : `docs/ARCHITECTURE.md` et
`data/raw/sources_officielles.md`.
