"""
FastAPI app exposant BGE-M3 (embed) et bge-reranker-v2-m3 (rerank).

Lifespan préchargé les deux modèles au startup → pas de cold start sur la
première requête utilisateur (juste un cold start au container boot).

Endpoints :
- POST /embed   — BGE-M3 dense + sparse natif
- POST /rerank  — bge-reranker-v2-m3 (compat TEI POST /rerank)
- GET  /health  — readiness probe
"""

from __future__ import annotations

import hmac
from contextlib import asynccontextmanager

import anyio
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.concurrency import run_in_threadpool

from .config import API_TOKEN, EMBED_MODEL, RERANK_MODEL, validate_config
from .embed import encode as embed_encode
from .embed import is_loaded as embed_loaded
from .embed import load_model as embed_load
from .rerank import is_loaded as rerank_loaded
from .rerank import load_model as rerank_load
from .rerank import rerank as rerank_run
from .schemas import (
    EmbedRequest,
    EmbedResponse,
    HealthResponse,
    RerankRequest,
    RerankResponse,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Valide la config puis précharge les modèles au startup (singleton)."""
    validate_config()
    embed_load()
    rerank_load()
    yield


app = FastAPI(
    title="tomai-ai-service",
    version="0.1.0",
    description="Embed (BGE-M3) + Rerank (bge-reranker-v2-m3) for Tom RAG backend.",
    lifespan=lifespan,
)

# Sérialise l'inférence par modèle : BGEM3FlagModel et CrossEncoder ne sont pas
# documentés thread-safe, et le threadpool FastAPI peut lancer plusieurs threads.
# Le lock (event-loop-bound) est acquis avant l'offload run_in_threadpool.
_embed_lock = anyio.Lock()
_rerank_lock = anyio.Lock()


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
        status="ok" if embed_loaded() and rerank_loaded() else "loading",
        embed_model=EMBED_MODEL,
        rerank_model=RERANK_MODEL,
        embed_loaded=embed_loaded(),
        rerank_loaded=rerank_loaded(),
    )


@app.post("/embed", response_model=EmbedResponse, dependencies=[Depends(_require_token)])
async def embed(req: EmbedRequest) -> EmbedResponse:
    """BGE-M3 dense + sparse natif en un seul forward pass."""
    async with _embed_lock:
        items = await run_in_threadpool(embed_encode, req.texts)
    return EmbedResponse(model=EMBED_MODEL, embeddings=items)


@app.post("/rerank", response_model=RerankResponse, dependencies=[Depends(_require_token)])
async def rerank(req: RerankRequest) -> RerankResponse:
    """bge-reranker-v2-m3 — compat format HuggingFace TEI POST /rerank."""
    async with _rerank_lock:
        results = await run_in_threadpool(rerank_run, req.query, req.texts, req.top_n)
    return RerankResponse(model=RERANK_MODEL, results=results)
