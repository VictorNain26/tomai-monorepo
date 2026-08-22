"""Le manifeste dit ce qui DOIT exister, et à partir de quand.

Le datage n'est pas un raffinement : les réformes 2025 et 2026 s'appliquent
niveau par niveau sur quatre rentrées. Servir le nouveau programme de français à
un élève de 4e en 2026 serait lui enseigner un texte qui ne le concerne pas.
"""

from schema.programmes import (
    RENTREE_COURANTE,
    en_vigueur,
    manifeste,
    matrice_attendue,
    programmes_pour,
)


def test_le_manifeste_couvre_le_college_et_le_lycee_general():
    niveaux = {p.niveau for p in manifeste()}
    assert {"sixieme", "cinquieme", "quatrieme", "troisieme"} <= niveaux
    assert {"seconde", "premiere", "terminale"} <= niveaux


def test_un_programme_futur_n_est_pas_servi_avant_sa_rentree():
    """Français cycle 4 : 5e en 2026, 4e en 2027, 3e en 2028."""
    en_2026 = programmes_pour("quatrieme", "francais", 2026)
    assert [p.vigueur for p in en_2026] == [2020], (
        "la 4e suit encore le programme BO2020 à la rentrée 2026"
    )
    en_2027 = programmes_pour("quatrieme", "francais", 2027)
    assert {p.nor for p in en_2027} == {"MENE2602912A"}


def test_la_reforme_deja_applicable_remplace_l_ancienne():
    assert {p.nor for p in programmes_pour("cinquieme", "francais", 2026)} == {"MENE2602912A"}
    assert [p.vigueur for p in programmes_pour("cinquieme", "francais", 2025)] == [2020]


def test_les_langues_du_lycee_ne_sont_plus_celles_de_l_api():
    """Le programme de langues 2025 couvre AUSSI le lycée : l'API, gelée en 2021,
    sert un texte abrogé."""
    entrees = programmes_pour("seconde", "anglais", 2026)
    assert entrees, "aucun programme d'anglais en seconde"
    assert {p.nor for p in entrees} == {"MENE2504621A"}
    assert {p.vigueur for p in entrees} == {2025}


def test_chaque_entree_porte_une_url_et_une_reference():
    for p in manifeste():
        assert p.url.startswith("https://"), f"URL invalide : {p}"
        assert p.reference.strip(), f"référence vide : {p}"
        assert p.origine in {"api", "bo"}


def test_aucune_url_de_miroir_tiers():
    """Un programme officiel ne se lit que sur un domaine officiel."""
    for p in manifeste():
        assert p.url.startswith(
            ("https://www.education.gouv.fr/", "https://cache.media.education.gouv.fr/")
        ), f"domaine non officiel : {p.url}"


def test_la_matrice_attendue_couvre_le_lycee_et_les_documents_de_cycle():
    matrice = matrice_attendue(RENTREE_COURANTE)
    assert ("terminale", "philosophie") in matrice
    assert ("cinquieme", "mathematiques") in matrice
    assert ("sixieme", "histoire_geo") in matrice, (
        "les matières des documents de cycle doivent être attendues, sinon elles "
        "ne sont vérifiées nulle part"
    )
    assert ("seconde", "mathematiques") in matrice


def test_aucun_programme_futur_dans_ce_qui_est_en_vigueur():
    for p in en_vigueur(RENTREE_COURANTE):
        assert p.vigueur <= RENTREE_COURANTE, f"programme futur servi : {p}"


def test_un_couple_ne_porte_qu_une_generation_de_programme():
    """Deux documents peuvent couvrir le même couple (spécialité et option
    d'arts, par exemple) — mais jamais deux générations différentes."""
    generations: dict[tuple[str, str], set[int]] = {}
    for p in en_vigueur(RENTREE_COURANTE):
        generations.setdefault((p.niveau, p.matiere), set()).add(p.vigueur)
    melanges = {c: v for c, v in generations.items() if len(v) > 1}
    assert not melanges, f"couples servant deux générations : {melanges}"


def test_aucun_nor_sans_origine():
    """La garde contre l'invention.

    Un NOR n'entre dans le manifeste que s'il est prouvé par le catalogue
    officiel, ou listé dans NOR_A_CONFIRMER avec l'endroit où il a été lu. Un
    NOR inventé enverrait la veille chercher un arrêté qui n'existe pas, et
    laisserait le vrai passer.
    """
    from schema.programmes import NOR_A_CONFIRMER, nors_du_catalogue

    portes = {p.nor for p in manifeste() if p.nor}
    sans_origine = portes - set(NOR_A_CONFIRMER) - nors_du_catalogue()
    assert not sans_origine, f"NOR sans origine documentée : {sorted(sans_origine)}"


def test_les_documents_de_cycle_portent_le_nor_du_catalogue():
    """Preuve de première main : le catalogue officiel donne l'arrêté du 17-7-2020."""
    from schema.programmes import nors_du_catalogue

    nors = {p.nor for p in programmes_pour("sixieme", "histoire_geo", 2026)}
    assert nors <= nors_du_catalogue()
    assert nors != {None}
