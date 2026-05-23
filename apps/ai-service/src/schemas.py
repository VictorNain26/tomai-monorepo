"""
Schémas Pydantic pour les endpoints HTTP.

Format aligné sur ce qu'attend `tomai-monorepo/apps/server/src/services/rag.service.ts`
(dense list[float] + sparse {indices, values} compatible Qdrant SparseVector).
"""

from __future__ import annotations

from pydantic import BaseModel, Field

# ── Embed ────────────────────────────────────────────────────────────────────


class EmbedRequest(BaseModel):
    """Requête embed (dense + sparse en un seul forward pass BGE-M3)."""

    texts: list[str] = Field(
        ..., min_length=1, max_length=256, description="Textes à embedder en batch."
    )


class SparseVector(BaseModel):
    """Format Qdrant SparseVector."""

    indices: list[int]
    values: list[float]


class EmbedItem(BaseModel):
    dense: list[float] = Field(..., description="1024D L2-normalisé")
    sparse: SparseVector


class EmbedResponse(BaseModel):
    model: str
    embeddings: list[EmbedItem]


# ── Rerank ───────────────────────────────────────────────────────────────────


class RerankRequest(BaseModel):
    """Requête rerank — compat avec HuggingFace TEI POST /rerank."""

    query: str = Field(..., min_length=1, max_length=2048)
    texts: list[str] = Field(..., min_length=1, max_length=128)
    top_n: int | None = Field(
        None, ge=1, description="Si défini, ne retourne que les top_n résultats."
    )


class RerankItem(BaseModel):
    """1 résultat reranké. `index` réfère à la position dans `texts` envoyé."""

    index: int
    score: float


class RerankResponse(BaseModel):
    model: str
    results: list[RerankItem]


# ── Health ───────────────────────────────────────────────────────────────────


class HealthResponse(BaseModel):
    status: str
    embed_model: str
    rerank_model: str
    embed_loaded: bool
    rerank_loaded: bool
