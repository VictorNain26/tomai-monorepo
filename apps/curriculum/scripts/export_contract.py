#!/usr/bin/env python3
"""Exporte le contrat de données curriculum → contract.json.

Source de vérité : schema/document.py. Le contrat fige les valeurs d'enum
(niveaux/cycles/matières), les clés de payload Qdrant, et l'identité de la
collection (named vectors + dims). Consommé en test-time par apps/server.

Usage : uv run python scripts/export_contract.py
"""

from __future__ import annotations

import json
from pathlib import Path

from schema import Cycle, Matiere, NiveauCollege, NiveauLycee
from schema.document import Chunk

CONTRACT_PATH = Path(__file__).resolve().parent.parent / "contract.json"
CONTRACT_VERSION = 1


def build_contract() -> dict:
    niveaux = [n.value for n in NiveauCollege] + [n.value for n in NiveauLycee]
    sample = Chunk(
        text="x" * 50,
        source_file="programme_maths_cycle4_BO2026",
        matiere=Matiere.MATHEMATIQUES,
        niveau=NiveauCollege.CINQUIEME,
        section="Nombres et calculs",
        chunk_index=0,
    )
    return {
        "version": CONTRACT_VERSION,
        "collection": {
            "name": "tomai_educational",
            "dense": {"name": "dense", "size": 1024, "distance": "Cosine"},
            "sparse": {"name": "bm25", "modifier": "idf"},
        },
        "payload_keys": sorted(sample.to_qdrant_payload().keys()),
        "cycles": [c.value for c in Cycle],
        "niveaux": niveaux,
        "matieres": [m.value for m in Matiere],
    }


def main() -> None:
    contract = build_contract()
    CONTRACT_PATH.write_text(
        json.dumps(contract, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"✓ contract.json écrit "
        f"({len(contract['matieres'])} matières, {len(contract['niveaux'])} niveaux)"
    )


if __name__ == "__main__":
    main()
