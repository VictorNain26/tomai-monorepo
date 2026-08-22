"""Le manifeste : ce qui DOIT exister dans l'index, et à partir de quelle rentrée.

Deux moitiés, et c'est nécessaire :

- l'API du ministère couvre le lycée général, mais elle est GELÉE à la rentrée
  2021 (vérifié : 11 entrées en 2021, aucune après) ;
- la table BO ci-dessous porte tout ce qui a été publié depuis, avec son NOR et
  son calendrier d'application.

Le calendrier est le point délicat. Les programmes récents entrent en vigueur
NIVEAU PAR NIVEAU, sur quatre rentrées. `en_vigueur(rentree)` ne retient, pour
chaque couple (niveau, matière), que la génération la plus récente déjà
applicable — le remplacement d'un programme par un autre n'est donc pas un cas
particulier, c'est le fonctionnement normal du tri.

SOURCE DU CALENDRIER : les arrêtés eux-mêmes ne sont pas lisibles par machine
(403 Cloudflare sur education.gouv.fr et legifrance.gouv.fr). Les dates viennent
de sources secondaires concordantes et sont À CONFIRMER par le rattrapage PISTE
(plan 2). Toute correction se fait ici, en un seul endroit.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from functools import cache

from .mapping import DISCIPLINE_VERS_SLUG, NIVEAU_VERS_NIVEAU, lignes_du_perimetre

# Rentrée de référence. À avancer chaque été — c'est ce qui fait basculer un
# niveau vers un programme réformé.
RENTREE_COURANTE = 2026

CYCLE_3 = ("sixieme",)
CYCLE_4 = ("cinquieme", "quatrieme", "troisieme")

# Le catalogue officiel porte le NOR de chaque arrêté dans son lien Légifrance
# (`…UnTexteDeJorf?numjo=MENE2018714A`) : c'est une preuve de première main, et
# la seule dont on dispose puisque ni le BO ni Légifrance ne répondent aux
# requêtes automatisées.
_MOTIF_NOR = re.compile(r"numjo=([A-Z]{4}\d{7}[A-Z])")

# NOR lus dans un Bulletin officiel mais JAMAIS vérifiés contre le texte de
# l'arrêté. Le rattrapage PISTE (plan 2, tâche 5) les confirme ou les corrige.
# Rien d'autre n'a le droit d'entrer dans le manifeste : `test_programmes.py`
# échoue sur tout NOR qui ne vient ni du catalogue ni de cette table.
NOR_A_CONFIRMER: dict[str, str] = {
    "MENE2504620A": (
        "français et mathématiques cycle 3, BO du 17-4-2025 — data/raw/sources_officielles.md"
    ),
    "MENE2504621A": (
        "langues vivantes, arrêté du 5-5-2025, BO n°22 du 29-5-2025 — "
        "data/raw/sources_officielles.md"
    ),
    "MENE2602912A": (
        "français et mathématiques cycle 4, BO du 5-3-2026 — data/raw/sources_officielles.md"
    ),
}


@cache
def nors_du_catalogue() -> frozenset[str]:
    """Les NOR que le catalogue officiel prouve lui-même."""
    from scripts.refresh_catalogue import charger_catalogue

    trouves = (
        _MOTIF_NOR.search(r.get("lien_vers_le_texte_officiel") or "") for r in charger_catalogue()
    )
    return frozenset(m.group(1) for m in trouves if m)


def _nor_pour_url(url: str) -> str | None:
    """NOR de la ligne du catalogue qui sert ce document.

    Écrire le NOR à la main serait une affirmation ; le lire ici en est une
    dérivation.
    """
    from scripts.refresh_catalogue import charger_catalogue

    for r in charger_catalogue():
        if (r.get("contenu_sur_le_site") or "").strip().replace("http://", "https://", 1) == url:
            trouve = _MOTIF_NOR.search(r.get("lien_vers_le_texte_officiel") or "")
            if trouve:
                return trouve.group(1)
    return None


@dataclass(frozen=True, slots=True)
class Programme:
    matiere: str
    niveau: str
    url: str
    reference: str
    vigueur: int
    origine: str  # "api" | "bo"
    nor: str | None = None


def _bo(
    url: str,
    reference: str,
    nor: str | None,
    matieres: tuple[str, ...],
    calendrier: dict[str, int],
) -> list[Programme]:
    """Développe un document du BO en une entrée par (matière, niveau).

    `calendrier` porte la rentrée d'application POUR CHAQUE NIVEAU : c'est ce qui
    distingue « la 5e applique le nouveau programme en 2026 » de « le cycle 4
    l'applique ».
    """
    return [
        Programme(matiere, niveau, url, reference, rentree, "bo", nor)
        for matiere in matieres
        for niveau, rentree in calendrier.items()
    ]


# ── Programmes publiés depuis le gel de l'API (rentrée 2022 et après) ─────────
# URL vérifiées le 2026-08-22 : HTTP 200 et signature %PDF.

_BASE_BO = "https://www.education.gouv.fr/sites/default/files"

# Langues vivantes 2025 : 25 annexes, 13 langues × collège et lycée. Le produit
# n'en porte que quatre ; les autres sont exclues par schema/mapping.py.
_REF_LV = "BO n°22 du 29-5-2025 · NOR MENE2504621A"
_NOR_LV = "MENE2504621A"
_LV_COLLEGE = {"sixieme": 2025, "cinquieme": 2026, "quatrieme": 2027, "troisieme": 2028}
_LV_LYCEE = {"seconde": 2025, "premiere": 2026, "terminale": 2026}
_ANNEXES_LV = {
    "allemand": (1, 2),
    "anglais": (3, 4),
    "espagnol": (9, 10),
    "italien": (13, 14),
}

# Français et mathématiques du cycle 4 : 5e en 2026, 4e en 2027, 3e en 2028.
_CYCLE4_2026 = {"cinquieme": 2026, "quatrieme": 2027, "troisieme": 2028}
_REF_C4 = "BO du 5-3-2026 · NOR MENE2602912A"
_NOR_C4 = "MENE2602912A"

# Français et mathématiques du cycle 3 : applicables en 6e dès 2025.
_REF_C3 = "BO du 5-5-2025 · NOR MENE2504620A"
_NOR_C3 = "MENE2504620A"

BO_POST_2021: tuple[Programme, ...] = tuple(
    [
        p
        for langue, (annexe_college, annexe_lycee) in _ANNEXES_LV.items()
        for p in (
            _bo(
                f"{_BASE_BO}/ensel621_annexe{annexe_college}.pdf",
                _REF_LV,
                _NOR_LV,
                (langue,),
                _LV_COLLEGE,
            )
            + _bo(
                f"{_BASE_BO}/ensel621_annexe{annexe_lycee}.pdf",
                _REF_LV,
                _NOR_LV,
                (langue,),
                _LV_LYCEE,
            )
        )
    ]
    + _bo(f"{_BASE_BO}/ensel620_annexe1.pdf", _REF_C3, _NOR_C3, ("francais",), {"sixieme": 2025})
    + _bo(
        f"{_BASE_BO}/ensel620_annexe2-v2.pdf",
        _REF_C3,
        _NOR_C3,
        ("mathematiques",),
        {"sixieme": 2025},
    )
    + _bo(
        f"{_BASE_BO}/document/Annexe 1 – Programme de français pour le cycle 4-480713.pdf",
        _REF_C4,
        _NOR_C4,
        ("francais",),
        _CYCLE4_2026,
    )
    + _bo(
        f"{_BASE_BO}/document/Annexe 2 – Programme de mathématiques pour le cycle 4-480716.pdf",
        _REF_C4,
        _NOR_C4,
        ("mathematiques",),
        _CYCLE4_2026,
    )
    # Technologie du cycle 4. Le BO du 29-2-2024 est la seule référence dont on
    # dispose : ce programme est postérieur au gel du catalogue, son annexe PDF
    # ne cite aucun arrêté, et le BO est inaccessible par machine. NOR et
    # calendrier restent donc inconnus — le rattrapage PISTE les établira.
    + _bo(
        f"{_BASE_BO}/document/Annexe — Programme de technologie du cycle 4-368016.pdf",
        "BO du 29-2-2024 (technologie cycle 4) · NOR inconnu",
        None,
        ("technologie",),
        dict.fromkeys(CYCLE_4, 2024),
    )
)

# ── Documents multi-matières du collège (BO 2020) ─────────────────────────────
# Ils portent les matières NON réformées. Les déclarer ici est ce qui permet au
# test de couverture de les attendre : une matière noyée dans un document de
# 98 pages ne serait sinon vérifiée nulle part.

_MATIERES_CYCLE_3 = (
    "francais",
    "mathematiques",
    "histoire_geo",
    "sciences_technologie",
    "langues_vivantes",
    "arts_plastiques",
    "education_musicale",
    "histoire_des_arts",
    "eps",
    "emc",
)
_MATIERES_CYCLE_4 = (
    "francais",
    "mathematiques",
    "histoire_geo",
    "physique_chimie",
    "svt",
    "technologie",
    "anglais",
    "espagnol",
    "allemand",
    "italien",
    # Le document de cycle 4 porte aussi une partie « Langues vivantes »
    # commune, indépendante de la langue étudiée.
    "langues_vivantes",
    "arts_plastiques",
    "education_musicale",
    "histoire_des_arts",
    "eps",
    "emc",
)

_URL_CYCLE_3 = "https://cache.media.education.gouv.fr/file/31/88/7/ensel714_annexe2_1312887.pdf"
_URL_CYCLE_4 = "https://cache.media.education.gouv.fr/file/31/89/1/ensel714_annexe3_1312891.pdf"


def _cycles_bo2020() -> tuple[Programme, ...]:
    """Les deux documents de cycle, dont le catalogue porte l'arrêté et le NOR."""
    return tuple(
        _bo(
            _URL_CYCLE_3,
            "Arrêté du 17-7-2020, J.O. du 28-7-2020 (cycle 3)",
            _nor_pour_url(_URL_CYCLE_3),
            _MATIERES_CYCLE_3,
            dict.fromkeys(CYCLE_3, 2020),
        )
        + _bo(
            _URL_CYCLE_4,
            "Arrêté du 17-7-2020, J.O. du 28-7-2020 (cycle 4)",
            _nor_pour_url(_URL_CYCLE_4),
            _MATIERES_CYCLE_4,
            dict.fromkeys(CYCLE_4, 2020),
        )
    )


def nor_traites() -> frozenset[str]:
    """NOR que le manifeste porte déjà — ce que la veille ne doit PAS signaler."""
    return frozenset(p.nor for p in manifeste() if p.nor)


def _depuis_api() -> list[Programme]:
    """Lycée général, depuis le catalogue officiel."""
    from scripts.refresh_catalogue import charger_catalogue

    programmes: list[Programme] = []
    for r in lignes_du_perimetre(charger_catalogue()):
        slug = DISCIPLINE_VERS_SLUG.get((r.get("discipline") or "-").strip())
        niveau = NIVEAU_VERS_NIVEAU.get((r.get("niveau_d_enseignement") or "").strip())
        url = (r.get("contenu_sur_le_site") or "").strip()
        if not slug or not niveau or not url.lower().endswith(".pdf"):
            continue  # exclusions validées par tests/test_mapping.py
        # La moitié du catalogue est encore en clair ; le même document répond
        # en https sur le même hôte (vérifié). Un programme officiel n'a pas de
        # raison d'être téléchargé sans chiffrement.
        url = url.replace("http://", "https://", 1)
        vigueur = int(str(r.get("entre_en_vigueur_a_la_rentree") or "0").split(".")[0])
        nor = _MOTIF_NOR.search(r.get("lien_vers_le_texte_officiel") or "")
        programmes.append(
            Programme(
                slug,
                niveau,
                url,
                (r.get("texte_officiel") or "").strip(),
                vigueur,
                "api",
                nor.group(1) if nor else None,
            )
        )
    return programmes


def manifeste() -> list[Programme]:
    """Tout ce qui a été publié, toutes époques confondues."""
    return list(BO_POST_2021) + list(_cycles_bo2020()) + _depuis_api()


def en_vigueur(rentree: int = RENTREE_COURANTE) -> list[Programme]:
    """Les programmes applicables à cette rentrée.

    Pour chaque couple (niveau, matière), seule la génération la plus récente
    déjà entrée en vigueur est retenue — mais TOUS ses documents le sont : une
    matière peut légitimement être décrite par plusieurs PDF (la spécialité et
    l'option d'arts, par exemple).
    """
    applicables = [p for p in manifeste() if p.vigueur <= rentree]
    generation: dict[tuple[str, str], int] = {}
    for p in applicables:
        cle = (p.niveau, p.matiere)
        generation[cle] = max(generation.get(cle, 0), p.vigueur)
    return [p for p in applicables if generation[(p.niveau, p.matiere)] == p.vigueur]


def programmes_pour(niveau: str, matiere: str, rentree: int = RENTREE_COURANTE) -> list[Programme]:
    """Ce qu'un élève de ce niveau doit voir pour cette matière, à cette rentrée."""
    return [p for p in en_vigueur(rentree) if p.niveau == niveau and p.matiere == matiere]


def matrice_attendue(rentree: int = RENTREE_COURANTE) -> set[tuple[str, str]]:
    """Couples (niveau, matière) qui doivent avoir du contenu indexé."""
    return {(p.niveau, p.matiere) for p in en_vigueur(rentree)}
