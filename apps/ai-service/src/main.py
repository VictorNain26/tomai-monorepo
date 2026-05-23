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

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException

from .config import API_TOKEN, EMBED_MODEL, RERANK_MODEL
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
    """Précharge les modèles au startup (singleton)."""
    embed_load()
    rerank_load()
    yield


app = FastAPI(
    title="tomai-ai-service",
    version="0.1.0",
    description="Embed (BGE-M3) + Rerank (bge-reranker-v2-m3) for Tom RAG backend.",
    lifespan=lifespan,
)


def _require_token(authorization: str | None = Header(default=None)) -> None:
    """Auth bearer optionnelle. Si API_TOKEN non défini, endpoints publics."""
    if not API_TOKEN:
        return
    expected = f"Bearer {API_TOKEN}"
    if authorization != expected:
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
    items = embed_encode(req.texts)
    return EmbedResponse(model=EMBED_MODEL, embeddings=items)


@app.post("/rerank", response_model=RerankResponse, dependencies=[Depends(_require_token)])
async def rerank(req: RerankRequest) -> RerankResponse:
    """bge-reranker-v2-m3 — compat format HuggingFace TEI POST /rerank."""
    results = rerank_run(req.query, req.texts, top_n=req.top_n)
    return RerankResponse(model=RERANK_MODEL, results=results)
