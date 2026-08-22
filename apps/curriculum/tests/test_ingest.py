"""
Tests du pipeline d'ingestion RAG.

Structure :
- Unitaires (pas d'I/O fichier, pas d'API) — rapides, toujours actifs
- Intégration (@pytest.mark.integration) — lisent data/raw/*.txt, sans API

Exécution :
  uv run pytest tests/test_ingest.py                    # unitaires uniquement
  uv run pytest tests/test_ingest.py -m integration     # + intégration fichiers réels
  uv run pytest tests/test_ingest.py -v                 # verbeux
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from schema import Matiere

FIXTURES = Path(__file__).parent / "fixtures"


def load_fixture(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


# ── chunk_text (RecursiveChunker + tokenizer Mistral) ────────────────────────


_SOURCE_MATHS = {
    "file": "programme_maths_cycle4_BO2026",
    "matiere": Matiere.MATHEMATIQUES,
    "section_pattern": None,
    "section_name": "Mathématiques",
}


@pytest.mark.skipif(
    not os.environ.get("RUN_MISTRAL_TOKENIZER_TESTS"),
    reason="mistral_common ~500MB — set RUN_MISTRAL_TOKENIZER_TESTS=1 pour activer",
)
def test_chunk_text_produces_chunks():
    """Smoke test : un texte assez long produit au moins 1 chunk valide."""
    from scripts.ingest import chunk_text

    long_text = (
        "Les nombres rationnels permettent de représenter des fractions ordinaires.\n"
        "Un nombre rationnel est le rapport de deux entiers relatifs non nuls.\n"
    ) * 30
    chunks = chunk_text(long_text, _SOURCE_MATHS)

    assert len(chunks) >= 1
    for c in chunks:
        assert len(c["text"]) >= 50


# ── expand_for_niveaux ───────────────────────────────────────────────────────


def _chunk_de_base(**overrides) -> dict:
    base = {
        "text": "Texte pédagogique sur les mathématiques du cycle 4 de collège en France.",
        "source_file": "a1b2c3d4e5f60718.pdf",
        "matiere": Matiere.MATHEMATIQUES.value,
        "section": "Mathématiques",
        "chunk_index": 0,
    }
    return {**base, **overrides}


def test_expand_for_niveaux_duplique_par_niveau():
    from scripts.ingest import expand_for_niveaux

    expanded = expand_for_niveaux([_chunk_de_base()], ["cinquieme", "quatrieme", "troisieme"])
    assert len(expanded) == 3
    assert {c["niveau"] for c in expanded} == {"cinquieme", "quatrieme", "troisieme"}


def test_expand_for_niveaux_suit_le_manifeste_et_non_le_nom_de_fichier():
    """La même source peut couvrir trois niveaux cette année et un seul l'an
    prochain, quand une réforme atteint les autres. C'est le manifeste qui le
    dit, pas le nom du fichier."""
    from scripts.ingest import expand_for_niveaux

    expanded = expand_for_niveaux([_chunk_de_base()], ["quatrieme"])
    assert [c["niveau"] for c in expanded] == ["quatrieme"]


def test_expand_preserves_chunk_text_and_section():
    """L'expansion ne modifie ni text ni section, seul niveau diffère."""
    from scripts.ingest import expand_for_niveaux

    expanded = expand_for_niveaux([_chunk_de_base()], ["cinquieme", "quatrieme"])
    assert len({c["text"] for c in expanded}) == 1
    assert len({c["section"] for c in expanded}) == 1


# ── validate_chunks ───────────────────────────────────────────────────────────


def _valid_chunk(**overrides) -> dict:
    base = {
        "text": (
            "Les propriétés des triangles rectangles sont fondamentales "
            "en géométrie du cycle 4 des collèges français."
        ),
        "source_file": "programme_maths_cycle4_BO2026",
        "matiere": "mathematiques",
        "niveau": "cinquieme",
        "section": "Géométrie",
        "chunk_index": 0,
    }
    base.update(overrides)
    return base


def test_validate_chunks_accepts_valid_chunk():
    from scripts.ingest import validate_chunks

    result = validate_chunks([_valid_chunk()])

    assert len(result) == 1
    assert result[0]["text"] == _valid_chunk()["text"]
    assert result[0]["niveau"] == "cinquieme"
    assert result[0]["cycle"] == "cycle4"


def test_validate_chunks_payload_canonical_no_aliases():
    """Payload Qdrant canonique pur — aucun alias title/content."""
    from scripts.ingest import validate_chunks

    result = validate_chunks([_valid_chunk()])
    payload = result[0]

    expected = {"text", "source_file", "matiere", "niveau", "cycle", "section", "chunk_index"}
    assert set(payload.keys()) == expected
    assert "title" not in payload
    assert "content" not in payload


def test_validate_chunks_fails_on_text_too_short():
    from pydantic import ValidationError

    from scripts.ingest import validate_chunks

    with pytest.raises(ValidationError):
        validate_chunks([_valid_chunk(text="Court.")])


def test_validate_chunks_fails_on_invalid_matiere():
    from scripts.ingest import validate_chunks

    with pytest.raises(ValueError):
        validate_chunks([_valid_chunk(matiere="musique")])


def test_validate_chunks_fails_on_invalid_niveau():
    from scripts.ingest import validate_chunks

    with pytest.raises(ValueError):
        validate_chunks([_valid_chunk(niveau="maternelle")])


# ── L2 normalize ─────────────────────────────────────────────────────────────


def test_l2_normalize_produces_unit_vector():
    from schema import l2_normalize

    vec = [3.0, 4.0]  # norme = 5
    normed = l2_normalize(vec)
    norm = sum(v * v for v in normed) ** 0.5

    assert abs(norm - 1.0) < 1e-9


def test_l2_normalize_raises_on_zero_vector():
    from schema import l2_normalize

    with pytest.raises(ValueError, match="norme nulle"):
        l2_normalize([0.0, 0.0, 0.0])


# ── Sources dérivées du manifeste ────────────────────────────────────────────


def test_les_sources_viennent_du_manifeste():
    """Plus de constante écrite à la main : ce qui est ingéré et ce que le test
    de couverture attend viennent de la même source."""
    from scripts.ingest import sources_du_manifeste

    sources = sources_du_manifeste()
    assert sources
    for s in sources:
        assert isinstance(s["matiere"], Matiere)
        assert s["niveaux"], f"{s['file']} sans niveau"
        assert s["file"].endswith(".pdf")


def test_les_sources_couvrent_college_et_lycee():
    from scripts.ingest import sources_du_manifeste

    niveaux = {n for s in sources_du_manifeste() for n in s["niveaux"]}
    assert {"sixieme", "cinquieme", "quatrieme", "troisieme"} <= niveaux
    assert {"seconde", "premiere", "terminale"} <= niveaux


def test_seuls_les_documents_de_cycle_sont_decoupes():
    """Un PDF partagé par deux matières n'est pas forcément un document de
    cycle : le programme de spécialité d'arts en sert deux et s'ingère entier."""
    from scripts.ingest import sources_du_manifeste

    a_decouper = {s["url"] for s in sources_du_manifeste() if s["a_decouper"]}
    assert len(a_decouper) == 2, f"attendu les deux documents de cycle, trouvé {a_decouper}"
