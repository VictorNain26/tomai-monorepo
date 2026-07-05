# tomai-ai-service

Service HTTP Python qui sert **BGE-M3 (dense + sparse natif)** pour le
backend Tom RAG.

## Pourquoi ce service existe

Le backend Bun (`apps/server`) a besoin, pour chaque requête utilisateur,
d'**embed query → dense + sparse cohérents** pour le hybrid search Qdrant.

Le sparse natif BGE-M3 (`lexical_weights`) n'existe que dans la lib
Python `FlagEmbedding` officielle BAAI. Aucun serveur HTTP OSS mature ne
l'expose (audit fait mai 2026 : TEI, Infinity, Xinference → tous **non**).
Donc on monte ce micro-service custom — glue HTTP autour de la lib
mature FlagEmbedding.

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

### `GET /health`

Readiness probe utilisée par Koyeb.

## Modèle

| Modèle | Lib | Taille | RAM (FP32) |
|---|---|---|---|
| `BAAI/bge-m3` | FlagEmbedding | 2.4 GB | ~3 GB |

**Total RAM runtime** : ~3 GB FP32, ~1.5 GB FP16.

## Configuration (env vars)

| Variable | Défaut | Rôle |
|---|---|---|
| `EMBED_MODEL` | `BAAI/bge-m3` | HF model id pour embed |
| `USE_FP16` | `false` | `true`/`false` — FP16 opt-in (~2× moins de RAM). Pas de détection auto. |
| `HF_HOME` | `/data/hf_cache` | Cache modèles HF (persistant si volume monté) |
| `ENVIRONMENT` | `development` | `production` active le fail-fast au boot (cf. ci-dessous) |
| `API_TOKEN` | (vide) | Si défini, exige `Authorization: Bearer <token>` (comparaison constant-time). **Obligatoire en production.** |
| `PORT` | `8000` | Port d'écoute |

### Sécurité — fail-fast en production

Quand `ENVIRONMENT=production`, le service **refuse de démarrer** si `API_TOKEN`
est absent ou vide (`RuntimeError` au boot, comme le fail-fast secrets du backend
Bun). Cela évite d'exposer `/embed` publiquement à cause d'une
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

Le **premier appel** déclenche le téléchargement HuggingFace (~2.4 GB).
Cache dans `~/.cache/huggingface/` (override via `HF_HOME`).

Alternative : `docker compose up ai-service` depuis `apps/server/`
(voir `apps/server/docker-compose.yml`, qui définit le service).
