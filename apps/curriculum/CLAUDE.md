# Curriculum (apps/curriculum)

Pipeline RAG éducatif : programmes officiels Éduscol → chunking → embedding
**BGE-M3 via `apps/ai-service` (`/embed`)** → index Qdrant (collection
`tomai_educational`). Ce repo gère **uniquement l'index RAG** ; la couche LLM
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

# Pipeline (nécessite ai-service joignable + Qdrant ; cf. .env.example)
uv run python scripts/migrate_collection.py         # crée la collection
uv run python scripts/ingest.py                     # chunk + embed (/embed) + upsert
uv run python scripts/export_contract.py            # régénère contract.json
uv run python scripts/query.py "Pythagore" --matiere=mathematiques --niveau=quatrieme

# Diagnostic / éval
uv run python scripts/audit_coverage.py             # % titres BO indexés (--list-missing)
uv run python scripts/evaluate.py --by-matiere      # Recall@k / MRR (déterministe)

# Qualité
uv run ruff check . && uv run ruff format --check .
uv run pytest -q
```

## Embedding

Aucun modèle chargé localement : `src/clients/ai_service.py` appelle
`ai-service /embed` (dense 1024D + sparse natif BGE-M3, format Qdrant). Lancer
`ai-service` en local : `docker compose up -d ai-service` (depuis la racine du
monorepo), ou pointer `AI_SERVICE_URL` vers le déploiement Koyeb.

## Frontière avec le backend

`apps/server` consomme l'index via `qdrant.service.ts` + `rag.service.ts`. Le
contrat de données est figé dans `contract.json` (exporté depuis
`schema/document.py`) et vérifié par des tests de conformité côté server. Payload
canonique (7 champs) : `text, section, matiere, niveau, cycle, source_file,
chunk_index`. La query est embeddée côté server via le même `ai-service /embed`
(dense + sparse) — aucune tokenisation locale.

## Env

`AI_SERVICE_URL`, `AI_SERVICE_TOKEN`, `QDRANT_URL`, `QDRANT_API_KEY`,
`QDRANT_COLLECTION` (défaut `tomai_educational`), `MISTRAL_API_KEY` (authoring du
golden set uniquement), `PISTE_*` (veille BO, optionnel).
