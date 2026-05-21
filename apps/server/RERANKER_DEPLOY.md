# Reranker bge-reranker-v2-m3 — déploiement Scaleway

Stage 2 du pipeline RAG : un cross-encoder qui re-classe les top-N
candidats Qdrant pour gagner +5-15 % de recall@5 par rapport à un hybrid
search hybrid pur (mesuré Pinecone / Cohere benchmarks 2026, ZeroEntropy
report).

## Modèle

- `BAAI/bge-reranker-v2-m3`
- 568M paramètres, MIT, **multilingue FR/EN/DE/ES/IT natif** (couvre toutes
  les matières du collège).
- Référence : <https://huggingface.co/BAAI/bge-reranker-v2-m3>

## Image runtime

[HuggingFace text-embeddings-inference](https://github.com/huggingface/text-embeddings-inference) (TEI)
expose un endpoint `/rerank` compatible avec le client `reranker.service.ts`
de ce repo. Trois images au choix :

| Image | Cible | Latence p50 (k=20) |
|---|---|---|
| `ghcr.io/huggingface/text-embeddings-inference:cpu-1.6` | dev / faible trafic | ~600 ms |
| `ghcr.io/huggingface/text-embeddings-inference:1.6` | NVIDIA A10 / L4 | ~80 ms |
| `ghcr.io/huggingface/text-embeddings-inference:turing-1.6` | NVIDIA T4 (Scaleway GP1) | ~120 ms |

## Scaleway — étape par étape

### 1. Créer l'instance GPU

```bash
# Recommandation MVP : GP1-S (T4 16 GB), fr-par-1
scw instance server create \
  type=GP1-S \
  zone=fr-par-1 \
  name=tomai-reranker \
  image=ubuntu_jammy \
  root-volume=l:80GB \
  ip=new
```

Pour démarrer sur CPU pure (pas de GPU), prendre un `DEV1-L` ou `PLAY2-MICRO`
suffisant pour un trafic faible. Mettre à jour `RERANKER_TIMEOUT_MS=20000`
côté server pour absorber la latence CPU.

### 2. Installer Docker + driver NVIDIA (si GPU)

```bash
ssh root@<server-ip>
apt update && apt install -y docker.io
# NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list \
  | tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
apt update && apt install -y nvidia-container-toolkit
nvidia-ctk runtime configure --runtime=docker
systemctl restart docker
```

### 3. Lancer le conteneur TEI

```bash
docker run -d --restart=always \
  --name tomai-reranker \
  --gpus all \
  -p 8080:80 \
  -v /opt/tei-cache:/data \
  -e MAX_BATCH_TOKENS=16384 \
  -e MAX_CLIENT_BATCH_SIZE=64 \
  ghcr.io/huggingface/text-embeddings-inference:turing-1.6 \
  --model-id BAAI/bge-reranker-v2-m3 \
  --revision main
```

Premier démarrage : ~3 min pour télécharger le modèle (~2 GB). Le volume
`/opt/tei-cache` évite le re-téléchargement aux redémarrages.

### 4. Sécurité réseau

Le service doit être joignable depuis Koyeb (l'app serveur). Trois
options :

1. **Recommandé** : VPN privé Scaleway entre Koyeb et l'instance. Pas
   d'exposition publique.
2. Pare-feu Scaleway restrictif sur le port 8080 (allowlist IPs Koyeb).
3. Proxy Nginx avec Basic Auth devant TEI.

NE PAS exposer TEI en clair sur Internet (pas d'auth native).

### 5. Health check

```bash
curl http://<server-ip>:8080/health
# attendu : 200 OK
```

### 6. Configurer le server Tom

Dans `.env` du backend Koyeb :

```bash
RERANKER_ENABLED=true
RERANKER_URL=https://reranker.tomai.internal   # via VPN ou proxy auth
RERANKER_MODEL=BAAI/bge-reranker-v2-m3
RERANKER_TIMEOUT_MS=8000                       # 20000 pour CPU-only
```

Si `RERANKER_URL` est absent ou `RERANKER_ENABLED=false`, le client se
rabat automatiquement sur l'ordre hybrid RRF sans rerank. Aucune panne
d'app si le reranker tombe.

## Validation

Côté Tom, après déploiement :

1. `curl https://api.tomai.fr/health/ai` retourne `mistral healthy`.
2. Un appel chat doit produire un span OTel `execute_tool BAAI/bge-reranker-v2-m3`
   (visible dans Langfuse / console exporter).
3. `evaluate.py` côté `tomai-curriculum` doit reporter une amélioration de
   `chunk_id_recall_at_5` sur le golden set généré (cf. PR #14 curriculum).

## Coût indicatif

- GP1-S Scaleway : ~95 €/mois (24/7 GPU)
- CPU-only DEV1-L : ~25 €/mois (latence ~600 ms, OK MVP)
- Pas de coût par requête (modèle local, MIT).

## Souveraineté

100 % EU : modèle MIT auto-hébergé, instance Scaleway `fr-par`, pas
d'inférence externe. Aligné avec ADR-0001 et la mémoire utilisateur
`feedback_eu_sovereignty.md`.

## Alternatives écartées

- **Cohere Rerank API** : performant mais service tiers US, paywall, et
  bloqué par la règle EU stricte.
- **Jina v3 Reranker** : licence CC BY-NC, non utilisable en commercial
  sans contrat séparé.
- **mxbai-rerank-large-v1** : MIT, ~1.5 GB, EN-first (FR support faible).
  À ré-évaluer si bge-v2-m3 plafonne sur les langues vivantes.
