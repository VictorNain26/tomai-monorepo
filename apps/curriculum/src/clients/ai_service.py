"""Client HTTP du service ai-service (`/embed`) — porte unique BGE-M3.

Remplace l'embedding local supprimé lors de la dédup #203. dense + sparse natif
en un seul appel, au format attendu par Qdrant (named vectors `dense` + `bm25`).

Garde-fous (cf. design #203 §Risques) :
- warming `/health` jusqu'à embed_loaded=true (cold-start ~2,4 GB sur Koyeb)
- auth Bearer si AI_SERVICE_TOKEN défini
- lots <= EMBED_BATCH_SIZE (< EmbedRequest.texts max_length=256 côté service)
- retry/backoff sur transient (429 / 5xx / timeout)
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass

import httpx

EMBED_BATCH_SIZE = 200  # marge sous la borne 256 d'ai-service (schemas.py)
_HEALTH_TIMEOUT_S = 5.0
_EMBED_TIMEOUT_S = 300.0  # le 1er appel après warming paie le forward pass froid (Koyeb CPU)
_WARM_MAX_WAIT_S = 600.0
_MAX_RETRIES = 5


@dataclass(frozen=True, slots=True)
class SparseVector:
    indices: list[int]
    values: list[float]


@dataclass(frozen=True, slots=True)
class EmbedItem:
    dense: list[float]
    sparse: SparseVector


def _base_url() -> str:
    url = os.environ.get("AI_SERVICE_URL")
    if not url:
        raise RuntimeError("AI_SERVICE_URL manquante (.env) — ex: http://localhost:8000")
    return url.rstrip("/")


def _headers() -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    token = os.environ.get("AI_SERVICE_TOKEN", "")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def wait_until_ready(max_wait_s: float = _WARM_MAX_WAIT_S) -> None:
    """Bloque jusqu'à ce que /health réponde embed_loaded=true (warming cold-start)."""
    url = f"{_base_url()}/health"
    deadline = time.monotonic() + max_wait_s
    attempt = 0
    while True:
        try:
            resp = httpx.get(url, headers=_headers(), timeout=_HEALTH_TIMEOUT_S)
            if resp.status_code == 200 and resp.json().get("embed_loaded") is True:
                return
        except httpx.HTTPError:
            pass
        if time.monotonic() >= deadline:
            raise RuntimeError(f"ai-service /health pas prêt après {max_wait_s:.0f}s")
        attempt += 1
        time.sleep(min(2**attempt, 15))


def _post_embed(texts: list[str]) -> list[EmbedItem]:
    url = f"{_base_url()}/embed"
    last_err: Exception | None = None
    for attempt in range(_MAX_RETRIES):
        try:
            resp = httpx.post(
                url, headers=_headers(), json={"texts": texts}, timeout=_EMBED_TIMEOUT_S
            )
            resp.raise_for_status()
            data = resp.json()
            embeddings = data["embeddings"]
            if len(embeddings) != len(texts):
                raise RuntimeError(
                    f"ai-service /embed a renvoyé {len(embeddings)} embeddings pour "
                    f"{len(texts)} textes — réponse tronquée, run interrompu (rejouable)."
                )
            return [
                EmbedItem(
                    dense=item["dense"],
                    sparse=SparseVector(
                        indices=item["sparse"]["indices"],
                        values=item["sparse"]["values"],
                    ),
                )
                for item in embeddings
            ]
        except httpx.HTTPError as err:
            last_err = err
            status = getattr(getattr(err, "response", None), "status_code", None)
            transient = status is None or status in (429, 500, 502, 503, 504)
            if attempt == _MAX_RETRIES - 1 or not transient:
                raise
            time.sleep(2 * (2**attempt))
    raise RuntimeError("unreachable") from last_err


def embed(texts: list[str], *, warm: bool = True) -> list[EmbedItem]:
    """Embed un batch (dense + sparse). Découpe en lots <= EMBED_BATCH_SIZE."""
    if not texts:
        return []
    if len(texts) > EMBED_BATCH_SIZE:
        out: list[EmbedItem] = []
        for i in range(0, len(texts), EMBED_BATCH_SIZE):
            out.extend(embed(texts[i : i + EMBED_BATCH_SIZE], warm=warm and i == 0))
        return out
    if warm:
        wait_until_ready()
    return _post_embed(texts)
