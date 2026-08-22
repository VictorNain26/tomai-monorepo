"""L'identifiant de point est le lien entre l'index et tout le reste.

Ces tests importent la SEULE définition. Une copie qui diverge doit casser ici,
pas six mois plus tard sur un index à moitié orphelin.
"""

import uuid
from pathlib import Path

from schema import chunk_point_id


def test_identifiant_stable_pour_le_meme_contenu():
    a = chunk_point_id("mathematiques", "cinquieme", "Théorème de Pythagore")
    b = chunk_point_id("mathematiques", "cinquieme", "Théorème de Pythagore")
    assert a == b


def test_la_matiere_fait_partie_de_l_identite():
    """Les préambules pédagogiques sont identiques entre langues vivantes.
    Sans la matière dans le seed, le dernier upsert écraserait les autres."""
    a = chunk_point_id("anglais", "cinquieme", "Préambule commun")
    b = chunk_point_id("espagnol", "cinquieme", "Préambule commun")
    assert a != b


def test_le_niveau_fait_partie_de_l_identite():
    a = chunk_point_id("mathematiques", "cinquieme", "Nombres relatifs")
    b = chunk_point_id("mathematiques", "quatrieme", "Nombres relatifs")
    assert a != b


def test_le_texte_fait_partie_de_l_identite():
    a = chunk_point_id("mathematiques", "cinquieme", "Nombres relatifs")
    b = chunk_point_id("mathematiques", "cinquieme", "Nombres rationnels")
    assert a != b


def test_forme_uuid_acceptee_par_qdrant():
    assert uuid.UUID(chunk_point_id("svt", "sixieme", "La respiration cellulaire"))


def test_ingest_utilise_la_fonction_partagee():
    """Garde-fou contre la réapparition d'une copie."""
    source = Path(__file__).resolve().parent.parent / "scripts" / "ingest.py"
    assert "uuid5" not in source.read_text(encoding="utf-8"), (
        "ingest.py recalcule un identifiant au lieu d'importer chunk_point_id"
    )
