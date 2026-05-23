"""
Configuration du service AI — pilotée par variables d'environnement.

Aucun secret côté serveur (les modèles sont publics MIT). Le seul "secret"
optionnel est `API_TOKEN` si on veut protéger l'endpoint en interne.
"""

from __future__ import annotations

import os

# Modèles — défauts alignés sur ce qui est mesuré côté curriculum
# (docs/ARCHITECTURE.md §Décision benchmark embedder).
EMBED_MODEL = os.getenv("EMBED_MODEL", "BAAI/bge-m3")
RERANK_MODEL = os.getenv("RERANK_MODEL", "BAAI/bge-reranker-v2-m3")

# fp16 = ~2× moins de RAM, perte recall négligeable. Activé si CUDA dispo OU
# si la variable d'env force. Sur CPU Koyeb on garde fp32 par défaut (fp16 sur
# CPU peut être instable selon l'instance).
USE_FP16 = os.getenv("USE_FP16", "auto").lower()

# Cache HuggingFace persistant entre redéploiements si volume monté.
# Sur Koyeb sans volume, le modèle est re-téléchargé à chaque deploy.
HF_HOME = os.getenv("HF_HOME", "/data/hf_cache")

# Token d'authentification HTTP optionnel — `Authorization: Bearer <token>`
# attendu si défini. Sinon endpoints publics (recommandé seulement en interne
# privé, ex: VPC Koyeb).
API_TOKEN = os.getenv("API_TOKEN", "")

# Port FastAPI (Koyeb expose via $PORT)
PORT = int(os.getenv("PORT", "8000"))
