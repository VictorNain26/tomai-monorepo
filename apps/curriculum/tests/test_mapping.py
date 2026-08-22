"""Aucune ligne du périmètre ne peut disparaître en silence.

Une discipline officielle ni mappée ni exclue est un trou dans le corpus que rien
d'autre ne signalerait : Qdrant ne renvoie pas d'erreur pour un filtre qui ne
matche rien, il renvoie zéro résultat.
"""

from schema.mapping import (
    DISCIPLINE_VERS_SLUG,
    DISCIPLINES_EXCLUES,
    NIVEAU_VERS_NIVEAU,
    NIVEAUX_EXCLUS,
    URLS_EXCLUES,
    lignes_du_perimetre,
)
from scripts.refresh_catalogue import charger_catalogue


def _perimetre():
    return lignes_du_perimetre(charger_catalogue())


def _discipline(ligne):
    return (ligne.get("discipline") or "-").strip()


def _niveau(ligne):
    return (ligne.get("niveau_d_enseignement") or "").strip()


def test_le_perimetre_n_est_pas_vide():
    """Le garde-fou du garde-fou : une colonne renommée en amont ferait passer
    tous les autres tests au vert sur un périmètre vide."""
    assert len(_perimetre()) >= 90, f"périmètre anormalement petit : {len(_perimetre())} lignes"


def test_chaque_discipline_du_perimetre_est_mappee_ou_exclue():
    manquantes = sorted(
        {
            _discipline(r)
            for r in _perimetre()
            if _discipline(r) not in DISCIPLINE_VERS_SLUG
            and _discipline(r) not in DISCIPLINES_EXCLUES
        }
    )
    assert not manquantes, f"disciplines ni mappées ni exclues : {manquantes}"


def test_chaque_niveau_du_perimetre_est_mappe_ou_exclu():
    manquants = sorted(
        {
            _niveau(r)
            for r in _perimetre()
            if _niveau(r) not in NIVEAU_VERS_NIVEAU and _niveau(r) not in NIVEAUX_EXCLUS
        }
    )
    assert not manquants, f"niveaux ni mappés ni exclus : {manquants}"


def test_aucune_ligne_retenue_n_est_ecartee_pour_son_url():
    """Treize lignes du périmètre ne pointent pas un PDF. Les filtrer en silence
    serait la même faute que celle qu'on répare, en plus discret : une ligne dont
    la discipline ET le niveau sont mappés doit avoir un PDF, ou un motif."""
    orphelines = sorted(
        {
            f"{_niveau(r)} · {_discipline(r)}"
            for r in _perimetre()
            if _discipline(r) in DISCIPLINE_VERS_SLUG
            and _niveau(r) in NIVEAU_VERS_NIVEAU
            and not (r.get("contenu_sur_le_site") or "").strip().lower().endswith(".pdf")
            and (r.get("contenu_sur_le_site") or "").strip() not in URLS_EXCLUES
        }
    )
    assert not orphelines, f"lignes sans PDF ni motif d'exclusion : {orphelines}"


def test_toute_exclusion_porte_un_motif_non_vide():
    for table in (DISCIPLINES_EXCLUES, NIVEAUX_EXCLUS, URLS_EXCLUES):
        vides = [k for k, motif in table.items() if not motif.strip()]
        assert not vides, f"exclusions sans motif : {vides}"


def test_les_slugs_cibles_existent_dans_le_schema():
    from schema import Matiere

    inconnus = sorted(set(DISCIPLINE_VERS_SLUG.values()) - {m.value for m in Matiere})
    assert not inconnus, f"slugs absents de l'enum Matiere : {inconnus}"


def test_les_niveaux_cibles_existent_dans_le_schema():
    from schema import NiveauCollege, NiveauLycee

    connus = {n.value for n in NiveauCollege} | {n.value for n in NiveauLycee}
    inconnus = sorted(set(NIVEAU_VERS_NIVEAU.values()) - connus)
    assert not inconnus, f"niveaux absents des enums : {inconnus}"


def test_le_lycee_general_reste_couvert_apres_mapping():
    """Sans cette borne, tout exclure ferait passer les autres tests au vert."""
    retenues = [
        r
        for r in _perimetre()
        if _discipline(r) in DISCIPLINE_VERS_SLUG and _niveau(r) in NIVEAU_VERS_NIVEAU
    ]
    assert len(retenues) >= 50, f"seulement {len(retenues)} lignes mappées sur le lycée"
