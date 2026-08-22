#!/usr/bin/env python3
"""Couverture réelle de l'index, par couple (niveau, matière).

Remplace `audit_coverage.py`, dont la métrique était bornée par
`min(indexed / source * 100, 100.0)`. Avec l'expansion multi-niveaux ce ratio
vaut structurellement ×3 : l'indicateur affichait « 100 % » tant qu'on ne perdait
pas plus des deux tiers du corpus.

Ici il n'y a pas de ratio à borner : une case a du contenu, ou elle n'en a pas.

Usage : uv run python scripts/coverage_report.py
"""

from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv  # noqa: E402

from schema.programmes import matrice_attendue  # noqa: E402
from schema.retrieval import get_collection_name, get_qdrant_client  # noqa: E402

load_dotenv()


def matrice_reelle(collection: str | None = None) -> dict[tuple[str, str], int]:
    """Nombre de points indexés par couple (niveau, matière)."""
    client = get_qdrant_client()
    nom = collection or get_collection_name()
    compte: Counter[tuple[str, str]] = Counter()
    offset = None
    while True:
        points, offset = client.scroll(
            nom,
            limit=1000,
            offset=offset,
            with_payload=["niveau", "matiere"],
            with_vectors=False,
        )
        for p in points:
            compte[(p.payload.get("niveau"), p.payload.get("matiere"))] += 1
        if offset is None:
            return dict(compte)


def cases_manquantes(collection: str | None = None) -> list[tuple[str, str]]:
    reelle = matrice_reelle(collection)
    return sorted(c for c in matrice_attendue() if reelle.get(c, 0) == 0)


def main() -> None:
    reelle = matrice_reelle()
    attendue = matrice_attendue()
    manquantes = sorted(c for c in attendue if reelle.get(c, 0) == 0)
    hors = sorted(set(reelle) - attendue)

    print(f"attendu : {len(attendue)} couples (niveau × matière)")
    print(f"couvert : {len(attendue) - len(manquantes)}")
    print(f"manquant: {len(manquantes)}\n")
    for niveau, matiere in manquantes:
        print(f"  ✗ {niveau:<12} {matiere}")
    if hors:
        print(f"\n{len(hors)} couple(s) indexés hors manifeste :")
        for niveau, matiere in hors:
            print(f"  ? {niveau:<12} {matiere}  ({reelle[(niveau, matiere)]} points)")
    if manquantes or hors:
        sys.exit(1)


if __name__ == "__main__":
    main()
