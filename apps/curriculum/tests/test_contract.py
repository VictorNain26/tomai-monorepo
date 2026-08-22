"""Conformité du contrat curriculum.

Le contrat porte deux choses de nature différente :

- le **vocabulaire** (cycles, niveaux, matières, clés de payload), dérivé des
  enums Pydantic — vérifiable hors ligne, c'est l'objet de ces tests ;
- la **couverture** (`matieres_indexees`, `niveaux_indexes`, `couverture`),
  relevée dans la collection vivante — non reproductible sans réseau, donc seule
  sa cohérence est vérifiée ici.
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
    """L'identité inclut QUI produit chaque moitié : c'est ce qui permet de
    détecter une requête vectorisée par un autre modèle que l'index."""
    coll = build_vocabulary()["collection"]
    assert coll["dense"] == {
        "name": "dense",
        "size": 1024,
        "distance": "Cosine",
        "provider": "ovh-ai-endpoints",
        "model": "Qwen3-Embedding-8B",
        "dimensions": 1024,
    }
    assert coll["sparse"] == {
        "name": "bm25",
        "modifier": "idf",
        "provider": "qdrant-cloud-inference",
    }


def test_la_couverture_est_un_sous_ensemble_du_vocabulaire():
    """Une matière indexée hors vocabulaire signalerait un chunk écrit avec un
    slug que le schema n'autorise pas — donc un contournement de la validation."""
    indexees = set(COMMITTED["matieres_indexees"])
    autorisees = set(COMMITTED["matieres"])
    assert indexees <= autorisees, sorted(indexees - autorisees)


def test_la_couverture_est_renseignee():
    """`null` voudrait dire que le contrat a été exporté sans jamais lire la
    collection — le backend en dériverait une énumération vide."""
    assert COMMITTED["matieres_indexees"], "couverture matières absente ou vide"
    assert COMMITTED["niveaux_indexes"], "couverture niveaux absente ou vide"


def test_la_couverture_par_niveau_est_publiee():
    """Le correctif P0-1 avait fermé la dimension matière côté agent et laissé
    celle du niveau ouverte : un lycéen interrogeait un niveau sans le moindre
    point, et l'agent en concluait que le programme ne dit rien. Le backend a
    besoin de cette information pour fermer la seconde dimension."""
    niveaux = set(COMMITTED["niveaux_indexes"])
    assert niveaux <= set(COMMITTED["niveaux"]), sorted(niveaux - set(COMMITTED["niveaux"]))
    detail = COMMITTED["couverture"]
    assert set(detail) == niveaux, "le détail par couple ne couvre pas les mêmes niveaux"
    for niveau, matieres in detail.items():
        assert matieres, f"{niveau} annoncé indexé mais sans aucune matière"
        assert set(matieres) <= set(COMMITTED["matieres_indexees"])


def test_default_embed_model_matches_the_contract():
    """Le défaut du client DOIT être le modèle qui a construit l'index.

    C'est la seule panne de cette chaîne qui ne se signale pas d'elle-même
    lorsque deux modèles partagent la même dimension : la recherche répond,
    mais dans un espace vectoriel qui n'est pas celui de l'index.
    """
    import json
    from pathlib import Path as _Path

    from src.clients.ovh_embeddings import DEFAULT_MODEL

    contract = json.loads(
        (_Path(__file__).resolve().parent.parent / "contract.json").read_text(encoding="utf-8")
    )
    assert DEFAULT_MODEL == contract["collection"]["dense"]["model"]


def test_default_dimensions_match_the_contract():
    """La dimension MRL demandée doit être celle de l'index. Qdrant refuserait
    un vecteur de taille différente — mais autant échouer en test."""
    import json
    from pathlib import Path as _Path

    from src.clients.ovh_embeddings import DEFAULT_DIMENSIONS

    contract = json.loads(
        (_Path(__file__).resolve().parent.parent / "contract.json").read_text(encoding="utf-8")
    )
    dense = contract["collection"]["dense"]
    assert DEFAULT_DIMENSIONS == dense["dimensions"] == dense["size"]
