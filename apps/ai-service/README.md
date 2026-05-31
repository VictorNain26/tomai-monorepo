# tomai-ai-service

Service HTTP Python qui sert **BGE-M3 (dense + sparse natif)** et
**bge-reranker-v2-m3** pour le backend Tom RAG.

## Pourquoi ce service existe

Le backend Bun (`apps/server`) a besoin pour chaque requête utilisateur :

1. **Embed query → dense + sparse cohérents** pour le hybrid search Qdrant
2. **Rerank des top-N candidats** pour booster la précision

Le sparse natif BGE-M3 (`lexical_weights`) n'existe que dans la lib
Python `FlagEmbedding` officielle BAAI. Aucun serveur HTTP OSS mature ne
l'expose (audit fait mai 2026 : TEI, Infinity, Xinference → tous **non**).
Donc on monte ce micro-service custom — 150 lignes de glue HTTP autour
de libs matures (FlagEmbedding + sentence-transformers).

Justification chiffrée : `tomai-curriculum/docs/ARCHITECTURE.md §Décision
benchmark embedder`. Sans le sparse natif, on perd -3.7 pp recall@5.

## API

### `POST /embed`

```json
{ "texts": ["Théorème de Pythagore"] }
```

Réponse :

```json
{
  "model": "BAAI/bge-m3",
  "embeddings": [
    {
      "dense": [0.12, -0.34, ...],            // 1024 floats L2-normés
      "sparse": { "indices": [123, 456], "values": [0.8, 0.4] }
    }
  ]
}
```

### `POST /rerank`

Format compatible HuggingFace TEI `/rerank` (le client backend
`reranker.service.ts` peut être pointé indifféremment sur TEI ou ce service).

```json
{
  "query": "Pythagore",
  "texts": ["chunk 1", "chunk 2", "chunk 3"],
  "top_n": 5
}
```

Réponse :

```json
{
  "model": "BAAI/bge-reranker-v2-m3",
  "results": [
    { "index": 1, "score": 0.92 },
    { "index": 0, "score": 0.81 }
  ]
}
```

### `GET /health`

Readiness probe utilisée par Koyeb.

## Modèles co-hostés

| Modèle | Lib | Taille | RAM (FP32) |
|---|---|---|---|
| `BAAI/bge-m3` | FlagEmbedding | 2.4 GB | ~3 GB |
| `BAAI/bge-reranker-v2-m3` | sentence-transformers | 1.1 GB | ~2 GB |

**Total RAM runtime** : ~5 GB avec FP32, ~3 GB avec FP16.

## Configuration (env vars)

| Variable | Défaut | Rôle |
|---|---|---|
| `EMBED_MODEL` | `BAAI/bge-m3` | HF model id pour embed |
| `RERANK_MODEL` | `BAAI/bge-reranker-v2-m3` | HF model id pour rerank |
| `USE_FP16` | `auto` | `auto`/`true`/`false`. `auto` = True si CUDA |
| `HF_HOME` | `/data/hf_cache` | Cache modèles HF (persistant si volume monté) |
| `ENVIRONMENT` | `development` | `production` active le fail-fast au boot (cf. ci-dessous) |
| `API_TOKEN` | (vide) | Si défini, exige `Authorization: Bearer <token>` (comparaison constant-time). **Obligatoire en production.** |
| `PORT` | `8000` | Port d'écoute |

### Sécurité — fail-fast en production

Quand `ENVIRONMENT=production`, le service **refuse de démarrer** si `API_TOKEN`
est absent ou vide (`RuntimeError` au boot, comme le fail-fast secrets du backend
Bun). Cela évite d'exposer `/embed` et `/rerank` publiquement à cause d'une
variable oubliée — on ne se repose pas uniquement sur le VPC privé Koyeb.

En dev (`ENVIRONMENT` non défini ou ≠ `production`), `API_TOKEN` reste optionnel :
absent = endpoints publics, pratique pour le smoke test local. `/health` reste
toujours ouvert (readiness probe Koyeb).

## Déploiement Koyeb

Cible : **eco-large** ($21.43/mois persistent, ~$5-10/mois avec scale-to-zero).

Plus petit instance type viable : **eco-medium** ($10.71/mois) avec
`USE_FP16=true`, mais marge réduite.

GPU non nécessaire en phase test. Pour scale up : `gpu-nvidia-l4`
($521/mois) ramènerait la latence p50 à ~10-20 ms.

## Dev local

```bash
# uv au lieu de pip pour cohérence avec le reste du monorepo
uv sync
uv run uvicorn src.main:app --reload --port 8000

# Smoke test
curl http://localhost:8000/health
curl -X POST http://localhost:8000/embed \
  -H "Content-Type: application/json" \
  -d '{"texts":["Théorème de Pythagore"]}'
```

Le **premier appel** déclenche le téléchargement HuggingFace (~3.5 GB).
Cache dans `~/.cache/huggingface/` (override via `HF_HOME`).

Alternative : `docker compose up ai-service` depuis la racine du monorepo
(voir `docker-compose.yml` racine).
