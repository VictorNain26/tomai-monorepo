"""Le catalogue officiel, et la preuve qu'il n'a pas vieilli sans qu'on le voie.

Le jeu de données est GELÉ à la rentrée 2021 (vérifié : 11 entrées en 2021, zéro
après). Ce n'est pas un défaut du code, c'est un fait sur la source — et c'est
exactement pourquoi le manifeste a une seconde moitié.
"""

import pytest

from scripts.refresh_catalogue import CHAMPS_ATTENDUS, charger_catalogue


def test_le_cache_est_present_et_substantiel():
    lignes = charger_catalogue()
    assert len(lignes) >= 600, f"catalogue anormalement court : {len(lignes)}"


def test_les_champs_attendus_sont_tous_la():
    """Une colonne renommée en amont doit casser ici, pas produire un manifeste
    vide qui passerait tous les autres tests au vert."""
    manquants = CHAMPS_ATTENDUS - set(charger_catalogue()[0])
    assert not manquants, f"champs absents du catalogue : {manquants}"


@pytest.mark.network
def test_le_cache_est_identique_a_l_api():
    """Rougit quand le ministère publie. C'est le signal qu'on attend depuis
    2021 : il ne s'est encore jamais déclenché."""
    from scripts.refresh_catalogue import telecharger_catalogue

    distant = telecharger_catalogue()
    local = charger_catalogue()
    assert len(distant) == len(local), (
        f"l'API renvoie {len(distant)} lignes, le cache en a {len(local)} — "
        "relancer scripts/refresh_catalogue.py et vérifier ce qui a changé"
    )
