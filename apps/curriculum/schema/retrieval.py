"""Couche d'accès Qdrant + recherche hybride.

Les deux moitiés de la recherche sont déléguées, et à deux endroits différents :

- **dense** → OVH AI Endpoints (Gravelines), via `src.clients.ovh_embeddings` ;
- **creux** → Qdrant lui-même (Cloud Inference, modèle `bm25`). On envoie le
  TEXTE dans un `models.Document` et le serveur le vectorise.

Aucun modèle n'est chargé ni hébergé par ce dépôt. `get_mistral_client` reste
pour le juge de l'évaluation qualité (LLM, pas embed).
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

DEFAULT_TOP_K = 5
EMBEDDING_DIM = 1024
DEFAULT_COLLECTION = "tomai_educational"
RETRIEVAL_MODES = ("hybrid", "dense", "sparse")

# Modèle creux calculé par Qdrant. `bm25` est illimité et gratuit, et c'est le
# seul modèle creux du catalogue Cloud Inference utilisable en français
# (`splade-pp-en-v1` est anglais-only, et rejeté par le serveur pour ce corpus).
SPARSE_MODEL = "bm25"

# Profondeur de parcours HNSW. DOIT rester identique à celle du serveur
# (apps/server/src/services/rag.service.ts) : une évaluation qui explore moins
# — ou plus — que la production mesure une configuration que personne ne
# déploie, et l'écart est invisible puisque les deux répondent.
HNSW_EF = 128

# Instruction appliquée aux REQUÊTES uniquement, jamais aux documents :
# l'asymétrie est celle que documente Qwen3-Embedding, qui annonce 1 à 5 % de
# rappel en plus et recommande d'adapter la consigne au scénario ET à la langue.
# Doit rester identique au défaut du serveur (apps/server/src/config/env.ts),
# sinon l'évaluation mesure une configuration que la production n'utilise pas.
DEFAULT_QUERY_INSTRUCTION = (
    "Étant donné la question d'un élève, retrouve le passage du programme "
    "scolaire officiel qui permet d'y répondre"
)

_mistral_client = None
_qdrant_client = None


def get_mistral_client():
    """Singleton lazy du client Mistral (LLM — juge de l évaluation qualité)."""
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
        # cloud_inference=True : autorise l'envoi de `models.Document`, que le
        # serveur vectorise. Sans ce drapeau le client refuse localement, avant
        # même d'émettre la requête.
        _qdrant_client = QdrantClient(
            url=url, api_key=api_key or None, check_compatibility=True, cloud_inference=True
        )
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
    retrieval_mode: str = "hybrid",
    instruction: str | None = None,
) -> list[HybridResult]:
    """Recherche Qdrant : hybride par défaut, ou une seule branche pour la mesure.

    `retrieval_mode` n'existe pas pour être utilisé en production — il sert à
    mesurer ce que chaque branche apporte. C'est la seule façon de répondre à
    « le sparse appris vaut-il le service qui le produit ? » sans réindexer.

    Source : https://qdrant.tech/documentation/search/hybrid-queries/
    """
    from qdrant_client import models

    from src.clients import ovh_embeddings

    # L'instruction ne s'applique qu'aux requêtes (exigence Qwen3-Embedding) ;
    # les documents sont embeddés bruts à l'ingestion.
    instruction = (
        instruction
        if instruction is not None
        else os.environ.get("OVH_QUERY_INSTRUCTION", DEFAULT_QUERY_INSTRUCTION)
    )
    dense = ovh_embeddings.embed([query], instruction=instruction or None)[0]
    sparse = models.Document(text=query, model=SPARSE_MODEL)

    must = []
    if matiere:
        must.append(models.FieldCondition(key="matiere", match=models.MatchValue(value=matiere)))
    if niveau:
        must.append(models.FieldCondition(key="niveau", match=models.MatchValue(value=niveau)))
    if cycle:
        must.append(models.FieldCondition(key="cycle", match=models.MatchValue(value=cycle)))
    query_filter = models.Filter(must=must) if must else None

    if retrieval_mode not in RETRIEVAL_MODES:
        raise ValueError(
            f"retrieval_mode must be one of {list(RETRIEVAL_MODES)} (got {retrieval_mode!r})"
        )

    client = get_qdrant_client()
    common = {
        "collection_name": collection or get_collection_name(),
        "query_filter": query_filter,
        "limit": top_k,
        "with_payload": True,
        "search_params": models.SearchParams(hnsw_ef=HNSW_EF),
    }

    if retrieval_mode == "dense":
        response = client.query_points(query=dense, using="dense", **common)
    elif retrieval_mode == "sparse":
        response = client.query_points(query=sparse, using="bm25", **common)
    else:
        prefetch_limit = max(top_k * prefetch_multiplier, 20)
        fusion_modes = {"rrf": models.Fusion.RRF, "dbsf": models.Fusion.DBSF}
        if fusion not in fusion_modes:
            raise ValueError(f"fusion must be one of {sorted(fusion_modes)} (got {fusion!r})")
        response = client.query_points(
            prefetch=[
                models.Prefetch(query=dense, using="dense", limit=prefetch_limit),
                models.Prefetch(query=sparse, using="bm25", limit=prefetch_limit),
            ],
            query=models.FusionQuery(fusion=fusion_modes[fusion]),
            **common,
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
