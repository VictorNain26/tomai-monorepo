"""Conformité du contrat : contract.json committé == régénéré depuis les enums."""
from __future__ import annotations

import json
from pathlib import Path

from scripts.export_contract import build_contract

CONTRACT_PATH = Path(__file__).resolve().parent.parent / "contract.json"


def test_contract_file_matches_source():
    committed = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
    assert committed == build_contract(), (
        "contract.json est désynchronisé du schema Pydantic — "
        "relancer `uv run python scripts/export_contract.py`."
    )


def test_payload_keys_are_the_seven_canonical():
    contract = build_contract()
    assert contract["payload_keys"] == sorted(
        ["text", "source_file", "matiere", "niveau", "cycle", "section", "chunk_index"]
    )


def test_collection_identity():
    coll = build_contract()["collection"]
    assert coll["dense"] == {"name": "dense", "size": 1024, "distance": "Cosine"}
    assert coll["sparse"] == {"name": "bm25", "modifier": "idf"}
