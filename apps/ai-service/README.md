# tomai-ai-service

Service HTTP Python qui sert **BGE-M3 (dense + sparse natif)** pour le
backend Tom RAG.

> **Périmètre : `docs/adr/0002-ai-service-scope.md`.** Le service vectorise du
> texte, et rien d'autre : sans état, agnostique du domaine, sans dépendance
> sortante. Avant d'ajouter quoi que ce soit ici, lire l'ADR.

## Pourquoi ce service existe

Le backend Bun (`apps/server`) a besoin, pour chaque requête utilisateur,
d'**embed query → dense + sparse cohérents** pour le hybrid search Qdrant.

Le sparse natif BGE-M3 (`lexical_weights`) n'existe que dans la lib
Python `FlagEmbedding` officielle BAAI. Aucun serveur HTTP OSS mature ne
l'expose (audit mai 2026 : TEI, Infinity, Xinference → tous **non** ;
TEI sert un SPLADE différent, vLLM était un PoC). Donc on monte ce
micro-service — glue HTTP autour de la lib mature FlagEmbedding, pas une
réimplémentation.

Justification chiffrée : `apps/curriculum/docs/ARCHITECTURE.md §Décision
benchmark embedder`. Sans le sparse natif, on perd 3,7 pp de recall@5
(0,894 → 0,857 en `cid_recall@5`).

> Le service est **embed-only** depuis le 2026-07-01. L'endpoint `/rerank`
> a été supprimé (décision et raison mesurée : voir §Rerank ci-dessous).
> `tests/test_endpoints.py::test_rerank_endpoint_is_gone` garde la porte
> fermée.

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

Batch : `texts` accepte 1 à 256 entrées (`schemas.py`). Le backend n'envoie
qu'un texte à la fois (embed de query) ; l'ingestion curriculum utilise le
batch.

### `GET /health`

Readiness probe Koyeb. Le modèle est préchargé dans le `lifespan` **avant**
qu'uvicorn n'accepte la première connexion : en pratique le port ne s'ouvre
qu'une fois le modèle en RAM, et `status: "loading"` n'est pas observable
depuis l'extérieur. Le `start-period: 180s` du healthcheck Docker couvre ce
temps de boot.

`/health` reste ouvert même quand `API_TOKEN` est défini (sinon la probe
Koyeb échouerait).

## Modèle de concurrence — à connaître avant toute modification

C'est la contrainte structurante du service, et elle est **volontaire** :

| Niveau | Réglage | Effet |
|---|---|---|
| Processus | `--workers 1` (`Dockerfile`, `CMD`) | un seul worker uvicorn par conteneur |
| Requête | `anyio.Lock` global (`main.py`) | une seule inférence à la fois dans le processus |
| Offload | `run_in_threadpool` | l'inférence ne bloque pas l'event loop, mais le lock la sérialise quand même |

Le lock existe parce que `BGEM3FlagModel` n'est pas documenté thread-safe.
Conséquence : **le débit d'un conteneur est celui d'une inférence en série**,
et une requête lente retarde toutes les suivantes. Il n'y a pas de dynamic
batching.

Le levier de débit est donc la réplication horizontale (ou un micro-batching
qui regroupe les requêtes concurrentes en un forward pass — le batch amortit
d'un facteur 3,4, cf. §Performance), pas l'augmentation des workers dans un
conteneur : chaque worker rechargerait 2,4 Go de modèle dans 4 Go de RAM.

Ce comportement est **mesuré**, pas déduit du code — voir §Performance.

## Performance — mesuré le 2026-08-21

Conteneur `tomai-ai-service-dev` : **2 vCPU, 4 Go, FP32**, modèle en cache.
Protocole et tableau complet : `docs/adr/0002-ai-service-scope.md`.

| Grandeur | Mesure |
|---|---|
| Embed 1 texte, à chaud, p50 | **577 ms** (min 523, max 678, n=12) |
| Premier appel après inactivité | ~3,5 s |
| Débit maximum d'un conteneur | **~1,7 requête/s** |
| Batch : 1 → 8 → 32 textes | 454 → 166 → **133 ms/texte** (×3,4) |
| Sortie | dense 1024D, norme L2 = 1,000000 ; sparse creux |

**Sérialisation prouvée**, pas déduite : le wall-clock croît linéairement avec
la concurrence (521 / 1 153 / 1 734 / 3 245 ms pour 1 / 2 / 4 / 8 requêtes
simultanées) et la requête la plus lente voit toujours une latence égale au
wall-clock total — les appels font la queue.

Ce qui reste inconnu : la latence sur l'**instance Koyeb réelle** (le type
provisionné n'est pas vérifiable depuis le dépôt) et l'effet du FP16 sur la
latence. C'est l'objet de la phase A2 du plan de consolidation.

Pour mémoire, mesures antérieures conservées : ~9 s par chunk de 400 tokens à
l'ingestion sur 2 cœurs (2026-06-13), `searchHybrid` bout en bout ~400 ms via
`src/live/rag.test.ts`.

## Configuration (env vars)

| Variable | Défaut | Rôle |
|---|---|---|
| `EMBED_MODEL` | `BAAI/bge-m3` | HF model id pour embed |
| `USE_FP16` | `false` | `true`/`false` — FP16 opt-in (~2× moins de RAM). Opt-in explicite, jamais de détection auto : le comportement doit être déterministe. |
| `HF_HOME` | `/data/hf_cache` | Cache modèles HF (persistant si volume monté) |
| `ENVIRONMENT` | `development` | `production` active le fail-fast au boot (cf. ci-dessous) |
| `API_TOKEN` | (vide) | Si défini, exige `Authorization: Bearer <token>` (comparaison constant-time). **Obligatoire en production.** |
| `PORT` | `8000` | Port d'écoute du processus |

Côté backend, la contrepartie est `AI_SERVICE_TOKEN` (doit être égal à
`API_TOKEN`), `AI_SERVICE_URL` et `AI_SERVICE_TIMEOUT_MS` (défaut 8 000 ms).

### Sécurité — fail-fast en production

Quand `ENVIRONMENT=production`, le service **refuse de démarrer** si `API_TOKEN`
est absent ou vide (`RuntimeError` au boot, comme le fail-fast secrets du backend
Bun). Cela évite d'exposer `/embed` publiquement à cause d'une variable oubliée —
on ne se repose pas uniquement sur le réseau privé Koyeb.

En dev (`ENVIRONMENT` non défini ou ≠ `production`), `API_TOKEN` reste optionnel :
absent = endpoints publics, pratique pour le smoke test local.

## Observabilité

**Aucune à ce jour.** Ni Sentry, ni OpenTelemetry, ni métriques — alors que
`apps/server`, `apps/landing` et `apps/mobile` sont instrumentés. C'est
l'écart le plus coûteux du service : il est une dépendance dure de chaque
recherche RAG et c'est le seul composant dont on ne sait rien en production.

Chantier en cours : phase A1 de
`docs/superpowers/plans/2026-08-21-ai-service-consolidation.md` (déclenché par
le constat P1-6 de `docs/audits/2026-08-21-rag-agent-ia.md`). Arbitrage retenu :
**Sentry + logs structurés**, pas d'OpenTelemetry tant qu'aucun collecteur OTLP
n'est provisionné.

Contrainte issue du périmètre (ADR 0002) : le texte embeddé ne doit **jamais**
être attaché à un log, une trace ou un événement d'erreur — longueurs, comptes,
durées et codes seulement.

## Modèle : empreinte mémoire

| Modèle | Lib | Poids | RAM runtime (FP32) |
|---|---|---|---|
| `BAAI/bge-m3` | FlagEmbedding | ~2,4 GB | ~3 GB |

`USE_FP16=true` divise l'empreinte par deux environ. Non activé par défaut :
le comportement du FP16 sur CPU dépend de l'instance, et on préfère un
service déterministe à un service économe mais variable.

## Rerank — pourquoi il n'y en a pas

Question tranchée le 2026-07-01, sur mesure et non sur préférence. Le
raisonnement complet, pour éviter de rouvrir le sujet sur de mauvaises bases :

- Le meilleur modèle candidat était **`bge-reranker-v2-m3`** (Apache 2.0,
  MIRACL 69,32 en multilingue, le plus léger des trois évalués). Il n'a
  **pas** été écarté pour son origine : des poids self-hostés n'exfiltrent
  aucune donnée.
- Il a été écarté sur la **latence CPU mesurée** : 43 à 180 s pour 20
  candidats sur l'instance de test (2026-06-25), contre un
  `AI_SERVICE_TIMEOUT_MS` de quelques secondes côté backend. En production
  CPU, le rerank aurait timeouté systématiquement — coût pur, zéro effet.
- Les alternatives managées sont exclues pour la souveraineté des **données** :
  Jina appartient à Elastic (US, CLOUD Act), Cohere est US, le « rerank »
  Scaleway est une similarité cosinus d'embeddings et non un cross-encoder,
  et ni OVH ni Mistral n'exposent de reranker.
- Sur ce corpus (quelques milliers de chunks, hybrid tuné, top-k 5), la
  littérature 2026 ne montre pas de rentabilité au rerank.

Rouvrir le sujet suppose donc de résoudre d'abord **la latence** — ONNX/INT8
généré à la main (bge-reranker-v2-m3 n'a pas d'ONNX publié) ou GPU à Tensor
Cores — pas de rediscuter la licence ou l'origine du modèle.

## Déploiement Koyeb

Cible documentée : **eco-large** (4 GB RAM, CPU). **eco-medium** est le plus
petit type viable, avec `USE_FP16=true` et une marge réduite.

> Le type d'instance réellement provisionné n'est pas vérifiable depuis le
> dépôt : à confirmer sur la console Koyeb avant tout dimensionnement.

GPU : aucun bénéfice démontré. Le seul essai (GTX 1650, sans Tensor Cores)
donnait 0,8× — soit plus lent que le CPU. Aucun benchmark sur GPU cloud
(L4/A10) n'a été fait ; toute estimation de gain serait une supposition.

## Dev local

Deux voies, selon ce que tu fais.

**Conteneur (défaut, ce que `pnpm dev` attend)** — depuis la racine du
monorepo :

```bash
docker compose up -d ai-service
curl http://localhost:8001/health          # 8001 côté host, 8000 dans le conteneur
```

L'image est pré-buildée en CI et poussée sur GHCR ; `pull_policy: missing`
la récupère. Pour itérer sur le code du service, build local explicite :

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml build ai-service
```

**Processus local (itération rapide sur `src/`)** :

```bash
cd apps/ai-service
uv sync --all-extras
uv run uvicorn src.main:app --reload --port 8000

curl http://localhost:8000/health
curl -X POST http://localhost:8000/embed \
  -H "Content-Type: application/json" \
  -d '{"texts":["Théorème de Pythagore"]}'
```

Le **premier démarrage** déclenche le téléchargement HuggingFace (~2,4 GB),
mis en cache dans `HF_HOME`.

## Qualité

```bash
uv run ruff check . && uv run ruff format --check .
uv run pytest -q
```

Les tests mockent le modèle pour éviter le téléchargement en CI. Test réel
avec modèle chargé :

```bash
LOAD_REAL_MODELS=1 uv run pytest tests/test_endpoints.py::test_e2e_real_models
```

CI : `.github/workflows/ai-service.yml` (lint + tests, filtré sur
`apps/ai-service/**`), `.github/workflows/ai-service-image.yml` (build et
push GHCR), `.github/workflows/smoke-test.yml` (probe `/health` sur le
déploiement Koyeb).
