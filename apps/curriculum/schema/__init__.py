from .contextual import build_contextual_text
from .document import (
    MATIERE_LABELS,
    Chunk,
    Cycle,
    Matiere,
    Niveau,
    NiveauCollege,
    NiveauLycee,
    cycle_from_niveau,
    derive_niveaux_from_file,
)
from .golden import GoldenQuestion, GoldenSet
from .retrieval import (
    DEFAULT_COLLECTION,
    DEFAULT_TOP_K,
    EMBEDDING_DIM,
    HybridResult,
    get_collection_name,
    get_mistral_client,
    get_qdrant_client,
    hybrid_search,
    l2_normalize,
)

__all__ = [
    "DEFAULT_COLLECTION",
    "DEFAULT_TOP_K",
    "EMBEDDING_DIM",
    "MATIERE_LABELS",
    "Chunk",
    "Cycle",
    "GoldenQuestion",
    "GoldenSet",
    "HybridResult",
    "Matiere",
    "Niveau",
    "NiveauCollege",
    "NiveauLycee",
    "build_contextual_text",
    "cycle_from_niveau",
    "derive_niveaux_from_file",
    "get_collection_name",
    "get_mistral_client",
    "get_qdrant_client",
    "hybrid_search",
    "l2_normalize",
]
