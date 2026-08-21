"""
FastAPI app exposant BGE-M3 (embed).

Lifespan préchargé le modèle au startup → pas de cold start sur la
première requête utilisateur (juste un cold start au container boot).

Endpoints :
- POST /embed   — BGE-M3 dense + sparse natif
- GET  /health  — readiness probe
"""

from __future__ import annotations

import hmac
import time
from contextlib import asynccontextmanager
from typing import Any

import anyio
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.concurrency import run_in_threadpool

from .config import API_TOKEN, EMBED_MODEL, use_fp16, validate_config
from .embed import encode as embed_encode
from .embed import is_loaded as embed_loaded
from .embed import load_model as embed_load
from .instrumentation import (
    Timings,
    emit_record,
    measured_lock,
    setup_logging,
    setup_sentry,
)
from .schemas import (
    EmbedRequest,
    EmbedResponse,
    HealthResponse,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Valide la config, arme l'instrumentation, précharge le modèle."""
    validate_config()
    setup_logging()
    setup_sentry()
    embed_load()
    yield


app = FastAPI(
    title="tomai-ai-service",
    version="0.1.0",
    description="Embed (BGE-M3 dense+sparse) for Tom RAG backend.",
    lifespan=lifespan,
)

# Sérialise l'inférence par modèle : BGEM3FlagModel n'est pas documenté
# thread-safe, et le threadpool FastAPI peut lancer plusieurs threads.
# Le lock (event-loop-bound) est acquis avant l'offload run_in_threadpool.
_embed_lock = anyio.Lock()

# Requêtes en vol — répond à « la sérialisation est-elle un problème réel ou
# théorique ? ». Incrémenté dans l'event loop (mono-thread), donc sans lock.
_inflight = 0


def _require_token(authorization: str | None = Header(default=None)) -> None:
    """Auth bearer optionnelle. Si API_TOKEN non défini, endpoints publics.

    Comparaison constant-time (`hmac.compare_digest`) pour ne pas leaker le
    token via une timing attack — même standard que `timingSafeEqual` côté Bun.
    """
    if not API_TOKEN:
        return
    expected = f"Bearer {API_TOKEN}"
    if authorization is None or not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Readiness probe — used by Koyeb healthcheck."""
    return HealthResponse(
        status="ok" if embed_loaded() else "loading",
        embed_model=EMBED_MODEL,
        embed_loaded=embed_loaded(),
        use_fp16=use_fp16(),
    )


@app.post("/embed", response_model=EmbedResponse, dependencies=[Depends(_require_token)])
async def embed(req: EmbedRequest) -> EmbedResponse:
    """BGE-M3 dense + sparse natif en un seul forward pass."""
    global _inflight
    started_at = time.perf_counter()
    _inflight += 1
    timings = Timings()
    record: dict[str, Any] = {
        "event": "embed",
        "model": EMBED_MODEL,
        "texts": len(req.texts),
        "chars": sum(len(text) for text in req.texts),
        "inflight": _inflight,
    }
    try:
        async with measured_lock(_embed_lock) as acquired:
            timings = acquired
            items = await run_in_threadpool(embed_encode, req.texts)
        record["status"] = "ok"
        return EmbedResponse(model=EMBED_MODEL, embeddings=items)
    except Exception as exc:
        record["status"] = "error"
        record["error_type"] = type(exc).__name__
        # Le message d'exception peut contenir le texte reçu : il ne sort ni
        # dans la réponse HTTP, ni dans l'enregistrement (ADR 0002).
        raise HTTPException(status_code=500, detail="embedding failed") from None
    finally:
        _inflight -= 1
        record["lock_wait_ms"] = round(timings.wait_ms, 3)
        record["inference_ms"] = round(timings.body_ms, 3)
        record["duration_ms"] = round((time.perf_counter() - started_at) * 1000, 3)
        emit_record(record)
