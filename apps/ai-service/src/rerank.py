"""
Wrapper bge-reranker-v2-m3 via sentence-transformers CrossEncoder.

Réponse au format compatible HuggingFace TEI POST /rerank pour que le client
backend (`apps/server/src/services/reranker.service.ts`) puisse l'appeler
sans changer son code (TEI ou ce service = même contrat).

Modèle : BAAI/bge-reranker-v2-m3 (568M params, MIT, multilingue FR/EN/DE/ES/IT).
"""

from __future__ import annotations

from threading import Lock

from .config import RERANK_MODEL
from .schemas import RerankItem

_model = None
_model_lock = Lock()


def load_model() -> None:
    """Charge le cross-encoder en mémoire (singleton). À appeler au startup."""
    global _model
    with _model_lock:
        if _model is not None:
            return
        from sentence_transformers import CrossEncoder

        _model = CrossEncoder(RERANK_MODEL)


def is_loaded() -> bool:
    return _model is not None


def rerank(query: str, texts: list[str], top_n: int | None = None) -> list[RerankItem]:
    """Re-classe les `texts` contre la `query`, retourne `top_n` résultats."""
    if _model is None:
        raise RuntimeError("Model not loaded. Call load_model() first.")
    if not texts:
        return []
    rankings = _model.rank(query, texts)
    limit = top_n if top_n is not None else len(rankings)
    return [
        RerankItem(index=int(r["corpus_id"]), score=float(r["score"])) for r in rankings[:limit]
    ]
