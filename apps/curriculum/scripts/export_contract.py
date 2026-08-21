#!/usr/bin/env python3
"""Exporte le contrat de données curriculum → contract.json.

Le contrat porte **deux choses distinctes**, et les confondre coûte cher :

- `matieres` / `niveaux` / `cycles` : le **vocabulaire autorisé**, figé par
  `schema/document.py`. Ce qu'un chunk a le droit de déclarer.
- `matieres_indexees` : la **couverture réelle**, lue dans la collection
  vivante. Ce qui a effectivement du contenu.

L'écart entre les deux est normal — le vocabulaire anticipe le lycée que le
corpus ne couvre pas encore. Mais c'est `matieres_indexees` que le backend doit
exposer à l'agent : proposer une matière vide ne provoque aucune erreur, juste
zéro résultat, et l'agent conclut « le programme ne dit rien » puis répond de
mémoire (constat P0-1 de l'audit du 2026-08-21).

Usage : uv run python scripts/export_contract.py
        uv run python scripts/export_contract.py --offline   # sans Qdrant
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from schema import Cycle, Matiere, NiveauCollege, NiveauLycee
from schema.document import Chunk

CONTRACT_PATH = Path(__file__).resolve().parent.parent / "contract.json"
CONTRACT_VERSION = 1


def read_indexed_matieres() -> list[str]:
    """Matières ayant au moins un point dans la collection vivante."""
    from dotenv import load_dotenv

    from schema.retrieval import get_collection_name, get_qdrant_client

    load_dotenv()
    client = get_qdrant_client()
    collection = get_collection_name()
    return sorted(
        m.value
        for m in Matiere
        if client.count(
            collection_name=collection,
            count_filter={"must": [{"key": "matiere", "match": {"value": m.value}}]},
        ).count
        > 0
    )


def build_vocabulary() -> dict:
    """Partie du contrat dérivée des enums Pydantic — pure, sans accès réseau.

    Séparée de la couverture pour rester vérifiable hors ligne : le test de
    conformité compare ce que produit cette fonction au fichier commité, sans
    dépendre d'une collection vivante.
    """
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
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--offline",
        action="store_true",
        help="Conserve la couverture déjà présente dans contract.json (pas d'accès Qdrant)",
    )
    args = parser.parse_args()

    if args.offline:
        existant = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
        matieres_indexees = existant.get("matieres_indexees")
    else:
        matieres_indexees = read_indexed_matieres()

    contract = build_vocabulary()
    contract["matieres_indexees"] = matieres_indexees
    CONTRACT_PATH.write_text(
        json.dumps(contract, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"✓ contract.json écrit "
        f"({len(contract['matieres'])} matières au vocabulaire, "
        f"{len(contract['matieres_indexees'] or [])} réellement indexées, "
        f"{len(contract['niveaux'])} niveaux)"
    )


if __name__ == "__main__":
    main()
