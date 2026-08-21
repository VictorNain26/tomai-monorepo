"""Conformité du contrat curriculum.

Le contrat porte deux choses de nature différente :

- le **vocabulaire** (cycles, niveaux, matières, clés de payload), dérivé des
  enums Pydantic — vérifiable hors ligne, c'est l'objet de ces tests ;
- la **couverture** (`matieres_indexees`), relevée dans la collection vivante —
  non reproductible sans réseau, donc seule sa cohérence est vérifiée ici.
"""

from __future__ import annotations

import json
from pathlib import Path

from scripts.export_contract import build_vocabulary

CONTRACT_PATH = Path(__file__).resolve().parent.parent / "contract.json"
COMMITTED = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))


def test_le_vocabulaire_commite_correspond_aux_enums():
    vocabulaire = build_vocabulary()
    commite = {cle: COMMITTED[cle] for cle in vocabulaire}
    assert commite == vocabulaire, (
        "contract.json est désynchronisé du schema Pydantic — "
        "relancer `uv run python scripts/export_contract.py --offline`."
    )


def test_les_sept_cles_de_payload_canoniques():
    assert build_vocabulary()["payload_keys"] == sorted(
        ["text", "source_file", "matiere", "niveau", "cycle", "section", "chunk_index"]
    )


def test_identite_de_la_collection():
    coll = build_vocabulary()["collection"]
    assert coll["dense"] == {"name": "dense", "size": 1024, "distance": "Cosine"}
    assert coll["sparse"] == {"name": "bm25", "modifier": "idf"}


def test_la_couverture_est_un_sous_ensemble_du_vocabulaire():
    """Une matière indexée hors vocabulaire signalerait un chunk écrit avec un
    slug que le schema n'autorise pas — donc un contournement de la validation."""
    indexees = set(COMMITTED["matieres_indexees"])
    autorisees = set(COMMITTED["matieres"])
    assert indexees <= autorisees, sorted(indexees - autorisees)


def test_la_couverture_est_renseignee():
    """`null` voudrait dire que le contrat a été exporté sans jamais lire la
    collection — le backend en dériverait une énumération vide."""
    assert COMMITTED["matieres_indexees"], "couverture absente ou vide"
