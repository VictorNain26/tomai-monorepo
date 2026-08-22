"""Client OVH AI Endpoints — embeddings DENSES uniquement.

Remplace `ai_service` (BGE-M3 auto-hébergé). Le vecteur creux ne transite plus
par ici : la spécification OpenAI `/v1/embeddings` n'a aucun champ pour un
vecteur creux, donc AUCUN fournisseur managé ne peut en renvoyer un. Le lexical
est délégué à Qdrant Cloud Inference (modèle `bm25`), calculé côté serveur.

Infrastructure à Gravelines ; les données ne sont ni stockées ni partagées
(https://docs.ovhcloud.com/en/guides/public-cloud/ai-machine-learning/ai-endpoints-capabilities).
"""

from __future__ import annotations

import os
import time

import httpx

DEFAULT_BASE_URL = "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1"
# DOIT rester identique à `contract.json` → collection.dense.{model,size}, et
# aux défauts du serveur : un index construit par un modèle et interrogé par un
# autre rend des résultats faux — silencieusement si les dimensions coïncident.
# `tests/test_contract.py` interdit la dérive.
DEFAULT_MODEL = "Qwen3-Embedding-8B"

# Matryoshka (MRL). Qwen3-Embedding produit 4096D et sait rendre n'importe
# quelle dimension entre 32 et 4096 ; OVH l'expose via le champ `dimensions` de
# la spec OpenAI et fait la troncature PUIS la renormalisation côté serveur
# (vérifié : écart 0,0013 avec le préfixe renormé, 0,085 avec le préfixe brut).
# 1024 divise l'index par 4 sans rien coder chez nous.
# None = ne pas envoyer le champ, obligatoire pour un modèle non-Matryoshka.
DEFAULT_DIMENSIONS: int | None = (
    int(os.environ["OVH_EMBED_DIMENSIONS"]) if os.environ.get("OVH_EMBED_DIMENSIONS") else 1024
)

# Bornes imposées par OVH ; au-delà : HTTP 400 « `dimensions` field must be
# between 32 and 4096 ». Vérifier avant l'appel donne un message plus utile.
MIN_DIMENSIONS, MAX_DIMENSIONS = 32, 4096

# Lots envoyés à /v1/embeddings. Plafond DUR côté OVH : 25 entrées par requête
# (HTTP 400 « given batch size overflow maximal one », {"given":64,"max":25}).
# Ce n'est pas une limite de taille de payload mais de nombre d'entrées.
EMBED_BATCH_SIZE = int(os.environ.get("OVH_EMBED_BATCH_SIZE", "25"))
_TIMEOUT_S = 120.0
_MAX_RETRIES = 5
_RETRYABLE = {408, 429, 500, 502, 503, 504}


def _token() -> str:
    token = os.environ.get("OVH_AI_ENDPOINTS_TOKEN", "")
    if not token:
        raise RuntimeError(
            "OVH_AI_ENDPOINTS_TOKEN manquante (.env). La générer dans la console "
            "OVHcloud : Public Cloud → AI Endpoints → Clés API."
        )
    return token


def _base_url() -> str:
    return os.environ.get("OVH_AI_ENDPOINTS_URL", DEFAULT_BASE_URL).rstrip("/")


def model_name() -> str:
    return os.environ.get("OVH_EMBED_MODEL", DEFAULT_MODEL)


def _apply_instruction(texts: list[str], instruction: str | None) -> list[str]:
    """Format officiel Qwen3-Embedding pour les requêtes.

    L'asymétrie est voulue : la requête reçoit l'instruction, le document non.
    L'appliquer des deux côtés (ou d'aucun) dégrade le rappel sans rien signaler.
    """
    if not instruction:
        return list(texts)
    return [f"Instruct: {instruction}\nQuery:{text}" for text in texts]


def _post_batch(inputs: list[str], model: str, token: str) -> list[list[float]]:
    url = f"{_base_url()}/embeddings"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    body: dict = {"model": model, "input": inputs}
    if DEFAULT_DIMENSIONS is not None:
        body["dimensions"] = DEFAULT_DIMENSIONS

    last = ""
    for attempt in range(_MAX_RETRIES):
        try:
            response = httpx.post(url, json=body, headers=headers, timeout=_TIMEOUT_S)
        except httpx.TransportError as e:
            # Une coupure réseau lève AVANT qu'un code HTTP existe : sans ce
            # rattrapage, la boucle de retry ne la voyait jamais et une
            # ingestion complète s'arrêtait à la première seconde d'instabilité.
            last = f"{type(e).__name__} — {e}"
            if attempt == _MAX_RETRIES - 1:
                break
            time.sleep(min(2**attempt, 30))
            continue
        if response.status_code == 200:
            data = response.json()["data"]
            # OVH garantit `index`, pas l'ordre du tableau : trier dessus est la
            # seule association fiable entre un texte et son vecteur.
            return [item["embedding"] for item in sorted(data, key=lambda d: d["index"])]
        last = f"HTTP {response.status_code} — {response.text[:200]}"
        if response.status_code not in _RETRYABLE:
            break
        time.sleep(min(2**attempt, 30))

    raise RuntimeError(f"ai-endpoints /embeddings : {last}")


def embed(
    texts: list[str], *, model: str | None = None, instruction: str | None = None
) -> list[list[float]]:
    """Vectorise en lots. Renvoie un vecteur par texte, dans l'ordre reçu."""
    if not texts:
        return []

    if DEFAULT_DIMENSIONS is not None and not (
        MIN_DIMENSIONS <= DEFAULT_DIMENSIONS <= MAX_DIMENSIONS
    ):
        raise ValueError(
            f"dimensions={DEFAULT_DIMENSIONS} hors bornes : OVH exige entre "
            f"{MIN_DIMENSIONS} et {MAX_DIMENSIONS}"
        )

    token = _token()
    resolved = model or model_name()
    prepared = _apply_instruction(texts, instruction)

    vectors: list[list[float]] = []
    for start in range(0, len(prepared), EMBED_BATCH_SIZE):
        batch = prepared[start : start + EMBED_BATCH_SIZE]
        vectors.extend(_post_batch(batch, resolved, token))

    if len(vectors) != len(texts):
        raise RuntimeError(f"{len(vectors)} vecteurs reçus, {len(texts)} attendus")
    return vectors
