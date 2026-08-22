"""Le corpus est-il complet ?

Ce test compare deux choses INDÉPENDANTES : ce que le manifeste dit qui doit
exister, et ce que l'index contient. L'ancienne métrique comparait l'index à
lui-même et bornait le résultat à 100 % — elle ne pouvait pas échouer.
"""

import pytest

from schema.programmes import matrice_attendue
from scripts.coverage_report import cases_manquantes, matrice_reelle

pytestmark = pytest.mark.qdrant


def test_toute_case_attendue_a_du_contenu():
    manquantes = cases_manquantes()
    assert not manquantes, (
        f"{len(manquantes)} couples (niveau, matière) sans contenu indexé : "
        f"{sorted(manquantes)[:20]}"
    )


def test_l_index_ne_contient_rien_hors_manifeste():
    """Un couple indexé mais absent du manifeste signale un slug inventé, un
    programme abrogé ou un reliquat d'ingestion."""
    hors = sorted(set(matrice_reelle()) - matrice_attendue())
    assert not hors, f"couples indexés hors manifeste : {hors}"


def test_aucune_case_n_est_squelettique():
    """Une case à un ou deux chunks trahit une extraction ratée, pas une
    couverture."""
    maigres = {c: n for c, n in matrice_reelle().items() if 0 < n < 3}
    assert not maigres, f"couples à moins de 3 chunks : {maigres}"
