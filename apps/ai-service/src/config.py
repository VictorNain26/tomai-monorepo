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

# fp16 = ~2× moins de RAM, perte recall négligeable. Opt-in explicite : sur CPU
# Koyeb on garde fp32 par défaut (fp16 sur CPU peut être instable selon
# l'instance).
USE_FP16 = os.getenv("USE_FP16", "false").lower()

# Cache HuggingFace persistant entre redéploiements si volume monté.
# Sur Koyeb sans volume, le modèle est re-téléchargé à chaque deploy.
HF_HOME = os.getenv("HF_HOME", "/data/hf_cache")

# Environnement de déploiement. `production` active le fail-fast au boot
# (cf. validate_config). Toute valeur autre que `production` = dev/test permissif.
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()

# Token d'authentification HTTP — `Authorization: Bearer <token>` attendu si
# défini. En production il est OBLIGATOIRE (fail-fast au boot). En dev, absent
# = endpoints publics (pratique pour le smoke test local).
API_TOKEN = os.getenv("API_TOKEN", "")

# Port FastAPI (Koyeb expose via $PORT)
PORT = int(os.getenv("PORT", "8000"))


def is_production() -> bool:
    return ENVIRONMENT == "production"


def validate_config() -> None:
    """Fail-fast au boot : en production, refuse de démarrer sans API_TOKEN.

    Aligné sur le backend Bun (`environment.config.ts`) qui fail-fast sur les
    secrets prod manquants. Évite d'exposer /embed publiquement par une simple
    variable d'env oubliée.
    """
    if is_production() and not API_TOKEN:
        raise RuntimeError(
            "API_TOKEN is required in production (ENVIRONMENT=production) but is "
            "missing or empty. Set API_TOKEN to protect /embed, or set "
            "ENVIRONMENT to a non-production value for local development."
        )
