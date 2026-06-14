"""Couche d'accès Qdrant + recherche hybride.

L'embedding (dense + sparse BGE-M3) est délégué au service `ai-service /embed`
via `src.clients.ai_service` — plus aucun modèle chargé localement (dédup #203).
`get_mistral_client` reste pour l'authoring offline du golden set (LLM, pas embed).
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

DEFAULT_TOP_K = 5
EMBEDDING_DIM = 1024
DEFAULT_COLLECTION = "tomai_educational"

_mistral_client = None
_qdrant_client = None


def get_mistral_client():
    """Singleton lazy du client Mistral (LLM — authoring golden set uniquement)."""
    global _mistral_client
    if _mistral_client is None:
        from mistralai import Mistral

        api_key = os.environ.get("MISTRAL_API_KEY")
        if not api_key:
            raise RuntimeError("MISTRAL_API_KEY manquante (.env)")
        _mistral_client = Mistral(api_key=api_key)
    return _mistral_client


def get_qdrant_client():
    """Singleton lazy du client Qdrant (check_compatibility pour catch les drifts)."""
    global _qdrant_client
    if _qdrant_client is None:
        from qdrant_client import QdrantClient

        url = os.environ.get("QDRANT_URL")
        api_key = os.environ.get("QDRANT_API_KEY")
        if not url:
            raise RuntimeError("QDRANT_URL manquante (.env)")
        # Sépare dev/prod par le scheme : Qdrant Cloud (https) exige une clé ;
        # le Qdrant local de dev (http) tourne sans auth (api_key=None).
        if url.startswith("https://") and not api_key:
            raise RuntimeError("QDRANT_API_KEY requis pour Qdrant Cloud (URL https)")
        _qdrant_client = QdrantClient(url=url, api_key=api_key or None, check_compatibility=True)
    return _qdrant_client


def get_collection_name() -> str:
    """Nom de collection cible. Override via QDRANT_COLLECTION."""
    return os.environ.get("QDRANT_COLLECTION", DEFAULT_COLLECTION)


def l2_normalize(vec: list[float]) -> list[float]:
    """Normalisation L2 (utilitaire pur — conservé pour les tests d'ingestion)."""
    norm = sum(v * v for v in vec) ** 0.5
    if norm == 0.0:
        raise ValueError("Vecteur de norme nulle (texte vide ou tout-blanc ?)")
    return [v / norm for v in vec]


@dataclass(slots=True)
class HybridResult:
    """Résultat d'un chunk retourné par hybrid_search."""

    text: str
    matiere: str
    niveau: str
    section: str
    score: float
    payload: dict[str, Any]
    id: str | None = None


def hybrid_search(
    query: str,
    *,
    top_k: int = DEFAULT_TOP_K,
    matiere: str | None = None,
    niveau: str | None = None,
    cycle: str | None = None,
    collection: str | None = None,
    prefetch_multiplier: int = 4,
    fusion: str = "rrf",
) -> list[HybridResult]:
    """Hybrid search Qdrant : prefetch dense + sparse (via ai-service) → fusion RRF/DBSF.

    Source : https://qdrant.tech/documentation/search/hybrid-queries/
    """
    from qdrant_client import models

    from src.clients import ai_service

    item = ai_service.embed([query])[0]
    dense = item.dense
    sparse = models.SparseVector(indices=item.sparse.indices, values=item.sparse.values)

    must = []
    if matiere:
        must.append(models.FieldCondition(key="matiere", match=models.MatchValue(value=matiere)))
    if niveau:
        must.append(models.FieldCondition(key="niveau", match=models.MatchValue(value=niveau)))
    if cycle:
        must.append(models.FieldCondition(key="cycle", match=models.MatchValue(value=cycle)))
    query_filter = models.Filter(must=must) if must else None

    prefetch_limit = max(top_k * prefetch_multiplier, 20)
    fusion_modes = {"rrf": models.Fusion.RRF, "dbsf": models.Fusion.DBSF}
    if fusion not in fusion_modes:
        raise ValueError(f"fusion must be one of {sorted(fusion_modes)} (got {fusion!r})")

    client = get_qdrant_client()
    response = client.query_points(
        collection_name=collection or get_collection_name(),
        prefetch=[
            models.Prefetch(query=dense, using="dense", limit=prefetch_limit),
            models.Prefetch(query=sparse, using="bm25", limit=prefetch_limit),
        ],
        query=models.FusionQuery(fusion=fusion_modes[fusion]),
        query_filter=query_filter,
        limit=top_k,
        with_payload=True,
    )

    return [
        HybridResult(
            text=r.payload["text"],
            matiere=r.payload["matiere"],
            niveau=r.payload["niveau"],
            section=r.payload.get("section", ""),
            score=r.score,
            payload=r.payload,
            id=str(r.id) if r.id is not None else None,
        )
        for r in response.points
    ]
