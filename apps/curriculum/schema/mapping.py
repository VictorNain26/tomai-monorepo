"""Correspondance entre les libellés officiels et nos slugs.

L'API porte 62 libellés de discipline sur le périmètre ; notre schéma en a 24.
Cette table fait le pont — et c'est précisément là qu'un décalage devient
invisible : Qdrant ne renvoie pas d'erreur pour un filtre qui ne matche rien, il
renvoie zéro résultat, et l'agent conclut que le programme ne dit rien.

RÈGLE : toute entrée du périmètre est soit mappée, soit exclue AVEC UN MOTIF.
`tests/test_mapping.py` échoue sinon. Si le ministère publie une discipline l'an
prochain, le test rougit au lieu de la laisser disparaître.

PÉRIMÈTRE : collège + lycée GÉNÉRAL. La voie technologique est exclue parce que
notre payload ne porte pas la série : indexer le programme de maths STMG sous
`premiere` le servirait à un élève de première générale.
"""

from __future__ import annotations

NIVEAUX_COLLEGE = frozenset({"Collège", "Cycle 3", "Cycle 4"})
NIVEAUX_LYCEE_GENERAL = frozenset(
    {"Seconde générale et technologique", "Première générale", "Terminale générale"}
)


def lignes_du_perimetre(lignes: list[dict]) -> list[dict]:
    """Entrées en vigueur du périmètre produit.

    « Abrogé à la rentrée » vaut `-` ou `None` quand le texte est toujours en
    vigueur : tester la vacuité seule exclurait tout le jeu de données.
    """
    retenues = []
    for r in lignes:
        if (r.get("abroge_a_la_rentree") or "-").strip() not in ("", "-"):
            continue
        niveau = (r.get("niveau_d_enseignement") or "").strip()
        if niveau in NIVEAUX_COLLEGE or niveau in NIVEAUX_LYCEE_GENERAL:
            retenues.append(r)
    return retenues


NIVEAU_VERS_NIVEAU: dict[str, str] = {
    "Seconde générale et technologique": "seconde",
    "Première générale": "premiere",
    "Terminale générale": "terminale",
}

NIVEAUX_EXCLUS: dict[str, str] = {
    # Le collège n'apparaît dans le catalogue que sous forme de documents de
    # cycle sans discipline. Ils sont déclarés explicitement dans
    # schema/programmes.py, avec la liste des matières qu'ils portent.
    "Collège": "programmes du collège déclarés dans schema/programmes.py",
    "Cycle 3": "document multi-matières, déclaré dans schema/programmes.py",
    "Cycle 4": "document multi-matières, déclaré dans schema/programmes.py",
}

_LLCER = "Langues, littératures et cultures étrangères et régionales"

DISCIPLINE_VERS_SLUG: dict[str, str] = {
    "Français": "francais",
    "Mathématiques": "mathematiques",
    # Options de terminale : le contenu est mathématique, l'élève les cherchera
    # sous « maths ».
    "Mathématiques complémentaires": "mathematiques",
    "Mathématiques expertes": "mathematiques",
    "Histoire-géographie": "histoire_geo",
    "Histoire-géographie, géopolitique et sciences politiques": "hggsp",
    "Humanités, littérature et philosophie": "hlp",
    "Philosophie": "philosophie",
    "Physique-chimie": "physique_chimie",
    "Sciences de la vie et de la Terre": "svt",
    "Sciences économiques et sociales": "ses",
    "Numérique et sciences informatiques": "nsi",
    "Sciences numériques et technologie": "snt",
    "Enseignement scientifique": "enseignement_scientifique",
    "Enseignement moral et civique": "emc",
    "Éducation physique et sportive": "eps",
    "Enseignement optionnel d'éducation physique et sportive": "eps",
    "Langues vivantes": "langues_vivantes",
    f"{_LLCER} - anglais": "anglais",
    f"{_LLCER} - allemand": "allemand",
    f"{_LLCER} - espagnol": "espagnol",
    f"{_LLCER} - italien": "italien",
    # Les arts sont publiés en documents multi-disciplines (arts plastiques,
    # cinéma, danse, histoire des arts, théâtre dans un même PDF). Le slug
    # `arts_plastiques` les porte : c'est la seule entrée de l'enum qui
    # corresponde, et les laisser dehors priverait les lycéens de toute la
    # spécialité.
    "Enseignement de spécialité d'arts": "arts_plastiques",
    "Enseignement de spécialité d'arts (Arts plastiques, Cinéma-audiovisuel, "
    "Danse, Histoire des arts, Théâtre)": "arts_plastiques",
    "Enseignement optionnel d'arts": "arts_plastiques",
    "Enseignement optionnel d'arts (Arts plastiques, Cinéma-audiovisuel, "
    "Danse, Histoire des arts, Théâtre)": "arts_plastiques",
    "Enseignement de spécialité d'arts (musique)": "education_musicale",
    "Enseignement optionnel d'arts (musique)": "education_musicale",
}

_AGRICOLE = "enseignement de lycée agricole, hors périmètre produit"
_SPECIALITE = "spécialité sans équivalent dans l'enum Matiere"
_ANTIQUITE = "langues anciennes, hors périmètre produit"
_REGIONALE = "langue régionale ou étrangère hors périmètre produit"

DISCIPLINES_EXCLUES: dict[str, str] = {
    "-": "document multi-matières de cycle, déclaré dans schema/programmes.py",
    "Enseignement facultatif de chant choral": (
        "enseignement facultatif du collège ; le collège est décrit par ses documents de cycle"
    ),
    # Lycées agricoles — publiés par le ministère de l'agriculture.
    "Agronomie-Economie-Territoires": _AGRICOLE,
    "Biologie-écologie": _AGRICOLE,
    "Écologie-agronomie-territoires-développement durable": _AGRICOLE,
    "Hippologie et équitation": _AGRICOLE,
    "Hippologie et équitation ou Autres pratiques sportives": _AGRICOLE,
    "Pratiques professionnelles": _AGRICOLE,
    "Pratiques sociales et culturelles": _AGRICOLE,
    # Spécialités et options sans équivalent dans le vocabulaire du produit.
    "Droit et grands enjeux du monde contemporain": _SPECIALITE,
    "Enseignement optionnel d'arts du cirque": _SPECIALITE,
    "Enseignement optionnel de biotechnologies": _SPECIALITE,
    "Enseignement optionnel de création et culture-design": _SPECIALITE,
    "Enseignement optionnel de création et innovation technologiques": _SPECIALITE,
    "Enseignement optionnel de culture et pratique de la danse, de la musique "
    "ou du théâtre": _SPECIALITE,
    "Enseignement optionnel de management et gestion": _SPECIALITE,
    "Enseignement optionnel de santé et social": _SPECIALITE,
    "Enseignement optionnel de sciences de l'ingénieur": _SPECIALITE,
    "Enseignement optionnel de sciences et laboratoire": _SPECIALITE,
    "Sciences de l'ingénieur": _SPECIALITE,
    "Sciences physiques (complément de l'enseignement de spécialité de sciences "
    "de l'ingénieur)": _SPECIALITE,
    # Langues anciennes et régionales.
    "Enseignement optionnel de langues et cultures de l'Antiquité": _ANTIQUITE,
    "Langues et cultures de l'Antiquité": _ANTIQUITE,
    "Littérature et langues et cultures de l'Antiquité": _ANTIQUITE,
    f"{_LLCER} -  catalan": _REGIONALE,
    f"{_LLCER} -  occitan": _REGIONALE,
    f"{_LLCER} - basque": _REGIONALE,
    f"{_LLCER} - breton": _REGIONALE,
    f"{_LLCER} - catalan": _REGIONALE,
    f"{_LLCER} - corse": _REGIONALE,
    f"{_LLCER} - créole": _REGIONALE,
    f"{_LLCER} - occitan - langue d'oc": _REGIONALE,
    f"{_LLCER} - tahitien": _REGIONALE,
}

# URL du périmètre qui ne pointent pas un PDF, pour une discipline et un niveau
# tous deux mappés. Vide aujourd'hui : les treize lignes concernées relèvent
# toutes de l'enseignement agricole, déjà exclu par discipline.
URLS_EXCLUES: dict[str, str] = {}


# ── Titres de section des documents de cycle ─────────────────────────────────
# Les deux documents BO2020 portent toutes les matières non réformées dans un
# seul PDF, sous des titres de 15 pt. Ces titres ne sont pas les libellés du
# catalogue : le document dit « Histoire et géographie » là où le catalogue dit
# « Histoire-géographie ». D'où cette table, distincte de DISCIPLINE_VERS_SLUG.
#
# Une section peut alimenter PLUSIEURS slugs. C'est le cas des langues vivantes
# du cycle 4 : jusqu'aux rentrées 2027 (4e) et 2028 (3e), le programme d'anglais
# applicable à ces niveaux EST cette section commune — les programmes par langue
# de 2025 ne les concernent pas encore. Ne pas la dupliquer laisserait un élève
# de 4e sans aucun résultat sur « anglais ».
SECTION_VERS_SLUGS: dict[str, tuple[str, ...]] = {
    "Français": ("francais",),
    "Mathématiques": ("mathematiques",),
    "Histoire et géographie": ("histoire_geo",),
    "Sciences et technologie": ("sciences_technologie",),
    "Physique-Chimie": ("physique_chimie",),
    "Sciences de la vie et de la Terre": ("svt",),
    "Technologie": ("technologie",),
    "Arts plastiques": ("arts_plastiques",),
    "Éducation musicale": ("education_musicale",),
    "Histoire des arts": ("histoire_des_arts",),
    "Éducation physique et sportive": ("eps",),
    "Enseignement moral et civique": ("emc",),
    "Langues vivantes (étrangères ou régionales)": (
        "langues_vivantes",
        "anglais",
        "espagnol",
        "allemand",
        "italien",
    ),
}

_VOLET = "volet transversal, pas une matière"

SECTIONS_IGNOREES: dict[str, str] = {
    "Programme d’enseignement du cycle de consolidation": "titre du document",
    "Programme d’enseignement du cycle des approfondissements": "titre du document",
    "(cycle 3)": "suite du titre du document",
    "(cycle 4)": "suite du titre du document",
    "Volet 1 : les spécificités du cycle de consolidation (cycle 3)": _VOLET,
    "Volet 1 : Les spécificités du cycle des approfondissements (cycle 4)": _VOLET,
    "Volet 2 : contributions essentielles des différents enseignements": _VOLET,
    "Volet 2 : Contributions essentielles des différents enseignements": _VOLET,
    "au socle commun": "suite du titre du volet 2",
    "et champs éducatifs au socle commun": "suite du titre du volet 2",
    "Volet 3 : les enseignements (cycle 3)": "en-tête du volet, pas une matière",
    "Volet 3 : les enseignements (cycle 4)": "en-tête du volet, pas une matière",
    "Volet 3 : Les enseignements (cycle 4)": "en-tête du volet, pas une matière",
    "Éducation aux médias et à l'information": "enseignement transversal absent de l'enum Matiere",
    "Éducation aux médias et à l’information": "enseignement transversal absent de l'enum Matiere",
}
