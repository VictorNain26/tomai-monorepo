#!/usr/bin/env python3
"""Télécharge les PDF que le manifeste déclare en vigueur.

Échoue bruyamment : un fichier manquant ou tronqué doit se voir ici, pas trois
étapes plus loin sous la forme d'une case de couverture vide.

Usage : uv run python scripts/fetch_sources.py [--rentree 2026]
"""

from __future__ import annotations

import argparse
import hashlib
import sys
import urllib.parse
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from schema.programmes import RENTREE_COURANTE, en_vigueur  # noqa: E402

DESTINATION = Path(__file__).resolve().parent.parent / "data" / "raw" / "pdf"
TIMEOUT_S = 120.0


def nom_fichier(url: str) -> str:
    """Nom stable dérivé de l'URL. Les URL officielles contiennent des espaces et
    des tirets cadratins ; un hash évite d'en dépendre."""
    return hashlib.sha256(url.encode("utf-8")).hexdigest()[:16] + ".pdf"


def telecharger_un(url: str, destination: Path) -> Path:
    reponse = httpx.get(
        urllib.parse.quote(url, safe=":/?&=%"), timeout=TIMEOUT_S, follow_redirects=True
    )
    if reponse.status_code != 200:
        raise RuntimeError(f"{url} → HTTP {reponse.status_code}")
    if reponse.content[:4] != b"%PDF":
        raise RuntimeError(f"{url} → contenu non PDF ({reponse.content[:40]!r})")
    chemin = destination / nom_fichier(url)
    chemin.write_bytes(reponse.content)
    return chemin


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rentree", type=int, default=RENTREE_COURANTE)
    args = parser.parse_args()

    DESTINATION.mkdir(parents=True, exist_ok=True)
    programmes = en_vigueur(args.rentree)
    urls = sorted({p.url for p in programmes})
    print(f"rentrée {args.rentree} : {len(programmes)} entrées → {len(urls)} PDF uniques\n")

    echecs = []
    for i, url in enumerate(urls, start=1):
        if (DESTINATION / nom_fichier(url)).exists():
            print(f"  [{i}/{len(urls)}] déjà présent")
            continue
        try:
            telecharger_un(url, DESTINATION)
            print(f"  [{i}/{len(urls)}] ✓ {url[:90]}")
        except Exception as e:  # noqa: BLE001 - on veut la liste complète des échecs
            echecs.append((url, str(e)))
            print(f"  [{i}/{len(urls)}] ✗ {e}")

    if echecs:
        print(f"\n{len(echecs)} échec(s) :")
        for url, message in echecs:
            print(f"  {url}\n    {message}")
        sys.exit(1)
    print(f"\n{len(urls)} PDF disponibles dans {DESTINATION}")


if __name__ == "__main__":
    main()
