#!/usr/bin/env python3
"""Le corpus téléchargé est-il bien celui que le manifeste annonce ?

Un HTTP 200 et une signature `%PDF` ne prouvent rien sur le CONTENU. Trois
pannes silencieuses passent ce filtre et arrivent jusqu'à l'index :

- un PDF scanné, dont on n'extrait aucun texte : la matière paraît couverte et
  ne contient rien ;
- un document qui n'est pas celui qu'on croit, parce que le catalogue officiel
  est gelé à la rentrée 2021 et ignore les abrogations postérieures — il
  continue par exemple d'annoncer « en vigueur » les programmes de langues du
  lycée que le BO de mai 2025 a remplacés ;
- deux entrées qui pointent le même fichier sans qu'on l'ait voulu.

Ce script les cherche AVANT l'ingestion, parce qu'après, un trou de corpus
ressemble à une mauvaise réponse du modèle.

Usage : uv run python scripts/verify_corpus.py [--rentree 2026] [--verbeux]
"""

from __future__ import annotations

import argparse
import hashlib
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

import pymupdf

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from schema import MATIERE_LABELS, Matiere  # noqa: E402
from schema.programmes import (  # noqa: E402
    DOCUMENTS_A_DECOUPER,
    RENTREE_COURANTE,
    en_vigueur,
)
from scripts.fetch_sources import DESTINATION, nom_fichier  # noqa: E402

# Sous ce seuil, l'extraction n'a rien donné d'exploitable : PDF scanné, page
# d'erreur déguisée, ou document tronqué.
MIN_CARACTERES = 2000

# Mots des libellés de niveau tels qu'ils apparaissent dans les titres officiels.
NIVEAU_VERS_MOTS: dict[str, tuple[str, ...]] = {
    "sixieme": ("cycle 3", "sixieme", "college", "consolidation"),
    "cinquieme": ("cycle 4", "college", "approfondissements"),
    "quatrieme": ("cycle 4", "college", "approfondissements"),
    "troisieme": ("cycle 4", "college", "approfondissements"),
    # « lycee » suffit : plusieurs programmes (EPS, langues vivantes) couvrent
    # les trois niveaux et s'intitulent « du lycée général et technologique ».
    "seconde": ("seconde", "lycee"),
    "premiere": ("premiere", "premieres", "lycee"),
    "terminale": ("terminale", "terminales", "lycee"),
}


def normaliser(texte: str) -> str:
    """Minuscules, sans accents, apostrophes et tirets réduits à des espaces.

    Les titres officiels écrivent « Programme d’histoire-géographie » : sans
    cette normalisation, ni « histoire » ni « geographie » n'est retrouvable.
    """
    decompose = unicodedata.normalize("NFD", texte.casefold())
    sans_diacritiques = "".join(c for c in decompose if unicodedata.category(c) != "Mn")
    for signe in ("’", "'", "-", "–", "—", "\n", ",", ";", ":"):
        sans_diacritiques = sans_diacritiques.replace(signe, " ")
    return " ".join(sans_diacritiques.split())


def entete(doc: pymupdf.Document) -> str:
    """Texte de la première page.

    Le titre ne se repère pas à la police : plusieurs documents officiels
    écrivent « Sommaire » dans la même taille que leur titre. La page entière
    est un repère plus sûr et tout aussi discriminant.
    """
    return normaliser(doc[0].get_text())[:1500]


# Le titre officiel ne reprend pas toujours le libellé du produit. Ces alias
# sont des décisions, pas des approximations : chacun dit quel intitulé
# ministériel recouvre notre slug.
ALIAS_MATIERE: dict[str, tuple[str, ...]] = {
    "arts_plastiques": ("arts",),  # « Programme d'enseignement optionnel d'arts »
    "education_musicale": ("arts", "musique"),  # spécialité d'arts, mention musique
    "sciences_technologie": ("sciences", "technologie"),
    "langues_vivantes": ("langues", "vivantes"),
}


def mots_significatifs(matiere: str) -> set[str]:
    """Mots par lesquels un document peut se réclamer de cette matière."""
    libelle = MATIERE_LABELS[Matiere(matiere)]
    mots = {mot for mot in normaliser(libelle).split() if len(mot) >= 5}
    return mots | set(ALIAS_MATIERE.get(matiere, ()))


def verifier(rentree: int, verbeux: bool) -> int:
    programmes = en_vigueur(rentree)
    par_document: dict[str, set[str]] = defaultdict(set)
    for p in programmes:
        par_document[p.url].add(p.matiere)

    absents: list[str] = []
    vides: list[str] = []
    hors_sujet: list[str] = []
    niveaux_douteux: list[str] = []
    empreintes: dict[str, list[str]] = defaultdict(list)

    niveaux_par_url: dict[str, set[str]] = defaultdict(set)
    for p in programmes:
        niveaux_par_url[p.url].add(p.niveau)

    print(f"rentrée {rentree} : {len(par_document)} documents, {len(programmes)} entrées\n")

    for url in sorted(par_document):
        chemin = DESTINATION / nom_fichier(url)
        matieres = sorted(par_document[url])
        if not chemin.exists():
            absents.append(f"{chemin.name} — {url}")
            continue

        octets = chemin.read_bytes()
        empreintes[hashlib.sha256(octets).hexdigest()].append(url)

        doc = pymupdf.open(chemin)
        texte = "\n".join(page.get_text() for page in doc)
        premiere_page = entete(doc)

        if len(texte.strip()) < MIN_CARACTERES:
            vides.append(f"{len(texte.strip()):>7} car. · {matieres} · {url[-70:]}")
            continue

        if url in DOCUMENTS_A_DECOUPER:
            # Document de cycle : il ne se réclame d'aucune matière, il les
            # contient toutes. Ce qu'on vérifie, c'est qu'il annonce son cycle.
            if "cycle" not in premiere_page:
                hors_sujet.append(f"document de cycle sans mention de cycle · {url[-70:]}")
            continue

        mots_pris = set(premiere_page.split())
        if not any(mots_significatifs(m) & mots_pris for m in matieres):
            hors_sujet.append(f"{matieres} ≠ « {premiere_page[:110]} » · {url[-60:]}")

        mots_attendus = {mot for niveau in niveaux_par_url[url] for mot in NIVEAU_VERS_MOTS[niveau]}
        if not any(mot in premiere_page for mot in mots_attendus):
            niveaux_douteux.append(
                f"{sorted(niveaux_par_url[url])} ≠ « {premiere_page[:100]} » · {url[-55:]}"
            )

        if verbeux:
            print(f"  ✓ {len(doc):>3}p {len(texte):>7}c {matieres} — {premiere_page[:70]}")

    doublons = {h: urls for h, urls in empreintes.items() if len(urls) > 1}

    def bloc(titre: str, lignes: list[str], dur: bool) -> None:
        if not lignes:
            return
        print(f"\n{'✗' if dur else '⚠'} {titre} ({len(lignes)})")
        for ligne in lignes:
            print(f"    {ligne}")

    bloc("documents absents", absents, True)
    bloc(f"documents sans texte exploitable (< {MIN_CARACTERES} car.)", vides, True)
    bloc("titre sans rapport avec la matière annoncée", hors_sujet, True)
    bloc("niveau non confirmé par le titre", niveaux_douteux, False)
    if doublons:
        print(f"\n⚠ fichiers identiques sous plusieurs URL ({len(doublons)})")
        for urls in doublons.values():
            for url in urls:
                print(f"    {url[-80:]}")
            print()

    # Ce que ce contrôle ne peut pas établir, et qu'il ne faut pas laisser
    # croire : le catalogue officiel est gelé à la rentrée 2021, donc il ignore
    # les abrogations postérieures. Un document qu'il annonce « en vigueur »
    # peut avoir été remplacé depuis — c'est arrivé aux programmes de langues du
    # lycée, remplacés en 2025. Seul le texte des arrêtés (PISTE) tranche.
    avant_2022 = {p.url for p in programmes if p.vigueur < 2022}
    print(
        f"\n⚠ {len(avant_2022)} documents sur {len(par_document)} datent d'avant 2022 : "
        "leur non-abrogation repose sur un catalogue gelé en 2021, pas sur un texte."
    )

    dur = absents or vides or hors_sujet
    print(
        f"\n{len(par_document) - len(absents) - len(vides)} documents exploitables "
        f"sur {len(par_document)}"
    )
    return 1 if dur else 0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rentree", type=int, default=RENTREE_COURANTE)
    parser.add_argument("--verbeux", action="store_true", help="Liste chaque document")
    args = parser.parse_args()
    sys.exit(verifier(args.rentree, args.verbeux))


if __name__ == "__main__":
    main()
