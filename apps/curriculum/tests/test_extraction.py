"""Le découpage par matière des documents de cycle.

Sans lui, une matière n'est qu'une section noyée dans un document de 98 pages :
elle reçoit une poignée de chunks pendant qu'un programme de langue, publié
séparément, en reçoit des centaines. C'est la cause mesurée du déséquilibre
984 (allemand) contre 282 (mathématiques).

La fixture porte les lignes typées de quatre sections réelles du cycle 3 — le
découpage repose sur la taille de police, pas sur une heuristique de casse.
"""

import json
from pathlib import Path

import pytest

from scripts.extract_pdfs import decouper_par_matiere

FIXTURE = Path(__file__).parent / "fixtures" / "cycle3_lignes.json"


def _lignes():
    return [tuple(x) for x in json.loads(FIXTURE.read_text(encoding="utf-8"))]


def test_le_decoupage_trouve_chaque_matiere_de_la_fixture():
    parties = decouper_par_matiere(_lignes())
    assert set(parties) == {"arts_plastiques", "education_musicale", "histoire_des_arts", "eps"}


def test_chaque_partie_est_substantielle():
    for slug, texte in decouper_par_matiere(_lignes()).items():
        assert len(texte) > 500, f"{slug} : {len(texte)} caractères seulement"


def test_les_slugs_produits_existent_dans_le_schema():
    from schema import Matiere

    produits = set(decouper_par_matiere(_lignes()))
    inconnus = sorted(produits - {m.value for m in Matiere})
    assert not inconnus, f"slugs inconnus : {inconnus}"


def test_une_section_inconnue_leve():
    """Une matière que le ministère ajouterait doit arrêter le pipeline, pas
    disparaître dans le texte de la section précédente."""
    lignes = [(15.0, "Océanographie"), (11.0, "x" * 600)]
    with pytest.raises(ValueError, match="Océanographie"):
        decouper_par_matiere(lignes)


def test_une_section_commune_alimente_plusieurs_matieres():
    """Jusqu'en 2027-2028, le programme d'anglais de 4e EST la section commune
    « Langues vivantes » du cycle 4."""
    lignes = [(15.0, "Langues vivantes (étrangères ou régionales)"), (11.0, "y" * 600)]
    parties = decouper_par_matiere(lignes)
    assert {"langues_vivantes", "anglais", "espagnol", "allemand", "italien"} == set(parties)
    assert parties["anglais"] == parties["langues_vivantes"]


PDF_CYCLES = Path(__file__).resolve().parent.parent / "data" / "raw" / "pdf"


@pytest.mark.integration
@pytest.mark.skipif(
    not PDF_CYCLES.exists(), reason="corpus non téléchargé (scripts/fetch_sources.py)"
)
def test_le_decoupage_couvre_les_matieres_declarees_par_le_manifeste():
    """Le manifeste promet que ces documents portent ces matières. Si le
    découpage n'en trouve pas une, la promesse est fausse et la case de
    couverture restera vide sans qu'on sache pourquoi."""
    from schema.programmes import (
        _MATIERES_CYCLE_3,
        _MATIERES_CYCLE_4,
        _URL_CYCLE_3,
        _URL_CYCLE_4,
    )
    from scripts.extract_pdfs import lignes_typees
    from scripts.fetch_sources import nom_fichier

    for url, declarees in ((_URL_CYCLE_3, _MATIERES_CYCLE_3), (_URL_CYCLE_4, _MATIERES_CYCLE_4)):
        chemin = PDF_CYCLES / nom_fichier(url)
        if not chemin.exists():
            pytest.skip(f"{chemin.name} absent")
        produites = set(decouper_par_matiere(lignes_typees(chemin)))
        manquantes = sorted(set(declarees) - produites)
        assert not manquantes, f"{url[-30:]} : matières déclarées et non trouvées : {manquantes}"
