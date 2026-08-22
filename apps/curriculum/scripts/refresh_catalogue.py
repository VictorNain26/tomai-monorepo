#!/usr/bin/env python3
"""Catalogue officiel des programmes du second degré.

Source : API Opendatasoft du ministère (Explore v2.1), dataset
`fr-en-programmes-enseignement-2nd-degre`. 688 enregistrements, 334 en vigueur.

Le cache est commité pour que les tests et l'ingestion tournent sans réseau ;
`tests/test_catalogue.py::test_le_cache_est_identique_a_l_api` rougit quand
l'amont bouge. Une copie figée sans ce test serait exactement le dispositif qui
nous a fait rater trois réformes.

Usage : uv run python scripts/refresh_catalogue.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import httpx

BASE = Path(__file__).resolve().parent.parent
CACHE = BASE / "data" / "raw" / "catalogue_second_degre.json"
API = (
    "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/"
    "fr-en-programmes-enseignement-2nd-degre/records"
)
TIMEOUT_S = 60.0
PAGE = 100
CHAMPS_ATTENDUS = {
    "descriptif",
    "voie",
    "niveau_d_enseignement",
    "discipline",
    "texte_officiel",
    "contenu_sur_le_site",
    "entre_en_vigueur_a_la_rentree",
    "abroge_a_la_rentree",
}


def telecharger_catalogue() -> list[dict]:
    """Pagination complète. Lève sur toute réponse non 200."""
    lignes: list[dict] = []
    offset = 0
    while True:
        reponse = httpx.get(API, params={"limit": PAGE, "offset": offset}, timeout=TIMEOUT_S)
        if reponse.status_code != 200:
            raise RuntimeError(f"API catalogue → HTTP {reponse.status_code} : {reponse.text[:200]}")
        charge = reponse.json()
        lignes.extend(charge["results"])
        offset += PAGE
        if offset >= charge["total_count"]:
            return lignes


def charger_catalogue() -> list[dict]:
    return json.loads(CACHE.read_text(encoding="utf-8"))


def main() -> None:
    lignes = telecharger_catalogue()
    ancien = len(charger_catalogue()) if CACHE.exists() else 0
    CACHE.write_text(json.dumps(lignes, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(lignes)} enregistrements écrits dans {CACHE} (avant : {ancien})")
    if ancien and ancien != len(lignes):
        print("⚠ le nombre d'entrées a changé — vérifier ce que le ministère a publié")
        sys.exit(1)


if __name__ == "__main__":
    main()
