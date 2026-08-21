"""
Wrapper BGE-M3 dense + sparse via FlagEmbedding officiel BAAI.

Single forward pass : dense (1024D L2-normé) + sparse (lexical_weights →
format Qdrant {indices, values}). C'est le gain mesuré côté curriculum
(cf. tomai-curriculum/docs/ARCHITECTURE.md §Décision benchmark embedder) :
- mistral-embed + BM25 maison → cid_recall=0.810
- BGE-M3 + sparse natif        → cid_recall=0.894 (+8.4 pp)
"""

from __future__ import annotations

from threading import Lock

from .config import EMBED_MODEL, use_fp16
from .schemas import EmbedItem, SparseVector

_model = None
_model_lock = Lock()


def load_model() -> None:
    """Charge le modèle BGE-M3 en mémoire (singleton). À appeler au startup."""
    global _model
    with _model_lock:
        if _model is not None:
            return
        from FlagEmbedding import BGEM3FlagModel

        _model = BGEM3FlagModel(EMBED_MODEL, use_fp16=use_fp16())


def is_loaded() -> bool:
    return _model is not None


def _lexical_weights_to_sparse(weights: dict) -> SparseVector:
    """Format FlagEmbedding `{token_id_str: weight_float32}` → Qdrant SparseVector."""
    return SparseVector(
        indices=[int(k) for k in weights.keys()],
        values=[float(v) for v in weights.values()],
    )


def encode(texts: list[str]) -> list[EmbedItem]:
    """Encode batch — dense + sparse en un seul forward pass."""
    if _model is None:
        raise RuntimeError("Model not loaded. Call load_model() first.")
    out = _model.encode(texts, return_dense=True, return_sparse=True, return_colbert_vecs=False)
    items: list[EmbedItem] = []
    for dense_vec, lex in zip(out["dense_vecs"], out["lexical_weights"], strict=True):
        items.append(
            EmbedItem(
                dense=dense_vec.tolist(),
                sparse=_lexical_weights_to_sparse(lex),
            )
        )
    return items
