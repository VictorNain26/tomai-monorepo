#!/usr/bin/env python3
"""Exporte le contrat de données curriculum → contract.json.

Le contrat porte **deux choses distinctes**, et les confondre coûte cher :

- `matieres` / `niveaux` / `cycles` : le **vocabulaire autorisé**, figé par
  `schema/document.py`. Ce qu'un chunk a le droit de déclarer.
- `matieres_indexees` et `niveaux_indexes` : la **couverture réelle**, lue dans
  la collection vivante. Ce qui a effectivement du contenu.
- `couverture` : le détail par couple `(niveau, matière)`. C'est ce qui permet
  au backend de refuser une combinaison vide au lieu de la chercher.

L'écart entre les deux peut exister, et c'est la couverture qui fait foi côté
backend : proposer une matière ou un niveau vide ne provoque aucune erreur, juste
zéro résultat, et l'agent conclut « le programme ne dit rien » puis répond de
mémoire (constat P0-1 de l'audit du 2026-08-21). Le correctif de juillet avait
fermé la dimension matière et laissé celle du niveau ouverte — d'où
`niveaux_indexes`.

Usage : uv run python scripts/export_contract.py
        uv run python scripts/export_contract.py --offline   # sans Qdrant
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from schema import Cycle, Matiere, NiveauCollege, NiveauLycee
from schema.document import Chunk

CONTRACT_PATH = Path(__file__).resolve().parent.parent / "contract.json"
CONTRACT_VERSION = 1


def read_coverage() -> dict:
    """Couverture réelle de la collection vivante, par matière, niveau et couple."""
    import sys

    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from dotenv import load_dotenv

    from scripts.coverage_report import matrice_reelle

    load_dotenv()
    matrice = matrice_reelle()
    return {
        "matieres_indexees": sorted({matiere for _, matiere in matrice}),
        "niveaux_indexes": sorted({niveau for niveau, _ in matrice}),
        "couverture": {
            niveau: sorted(m for n, m in matrice if n == niveau)
            for niveau in sorted({n for n, _ in matrice})
        },
    }


def build_vocabulary() -> dict:
    """Partie du contrat dérivée des enums Pydantic — pure, sans accès réseau.

    Séparée de la couverture pour rester vérifiable hors ligne : le test de
    conformité compare ce que produit cette fonction au fichier commité, sans
    dépendre d'une collection vivante.
    """
    niveaux = [n.value for n in NiveauCollege] + [n.value for n in NiveauLycee]
    sample = Chunk(
        text="x" * 50,
        source_file="programme_maths_cycle4_BO2026",
        matiere=Matiere.MATHEMATIQUES,
        niveau=NiveauCollege.CINQUIEME,
        section="Nombres et calculs",
        chunk_index=0,
    )
    return {
        "version": CONTRACT_VERSION,
        "collection": {
            "name": "tomai_educational",
            # Le modèle fait partie du contrat : un index construit par un modèle
            # et interrogé par un autre renvoie des résultats faux SANS erreur.
            # C'est la seule panne de cette chaîne qui ne se signale pas.
            "dense": {
                "name": "dense",
                "size": 1024,
                "distance": "Cosine",
                "provider": "ovh-ai-endpoints",
                "model": "Qwen3-Embedding-8B",
                # Matryoshka : le modèle rend 4096D nativement, tronqué et
                # renormalisé à 1024 côté OVH. La dimension fait donc partie du
                # contrat au même titre que le modèle.
                "dimensions": 1024,
            },
            # Calculé par Qdrant (Cloud Inference), pas par nous.
            "sparse": {"name": "bm25", "modifier": "idf", "provider": "qdrant-cloud-inference"},
        },
        "payload_keys": sorted(sample.to_qdrant_payload().keys()),
        "cycles": [c.value for c in Cycle],
        "niveaux": niveaux,
        "matieres": [m.value for m in Matiere],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--offline",
        action="store_true",
        help="Conserve la couverture déjà présente dans contract.json (pas d'accès Qdrant)",
    )
    args = parser.parse_args()

    if args.offline:
        existant = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
        couverture = {
            cle: existant.get(cle) for cle in ("matieres_indexees", "niveaux_indexes", "couverture")
        }
    else:
        couverture = read_coverage()

    contract = build_vocabulary()
    contract.update(couverture)
    CONTRACT_PATH.write_text(
        json.dumps(contract, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"✓ contract.json écrit "
        f"({len(contract['matieres_indexees'] or [])}/{len(contract['matieres'])} matières et "
        f"{len(contract['niveaux_indexes'] or [])}/{len(contract['niveaux'])} niveaux couverts)"
    )


if __name__ == "__main__":
    main()
