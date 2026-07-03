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


# ── Health ───────────────────────────────────────────────────────────────────


class HealthResponse(BaseModel):
    status: str
    embed_model: str
    embed_loaded: bool
