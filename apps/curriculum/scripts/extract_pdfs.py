#!/usr/bin/env python3
"""
Extraction PDF → Markdown via pymupdf4llm.

Remplace `pdftotext` pour les PDFs où la structure sectionnelle compte (cycle 3
et cycle 4 BO 2020 monolithiques qui regroupent toutes les matières).
Le markdown généré préserve les vrais titres en `## Titre` (extraits depuis
les attributs typographiques du PDF : gras, taille de police).

ingest.py préfère le .md s'il existe, sinon retombe sur .txt.

Usage :
  uv run python scripts/extract_pdfs.py                          # tous les PDFs
  uv run python scripts/extract_pdfs.py --pdf=programme_cycle3_BO2020
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pymupdf
import pymupdf4llm

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from schema.mapping import SECTION_VERS_SLUGS, SECTIONS_IGNOREES  # noqa: E402

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE = Path(__file__).parent.parent
RAW = BASE / "data" / "raw"


def extract_one(pdf_path: Path, output_md: Path) -> tuple[int, int]:
    """Extrait un PDF → markdown. Retourne (n_chars, n_h2)."""
    md = pymupdf4llm.to_markdown(str(pdf_path), page_chunks=False)
    output_md.write_text(md, encoding="utf-8")
    n_h2 = md.count("\n## ")
    return len(md), n_h2


# Les documents de cycle BO2020 titrent leurs matières en 15 pt et leurs
# sous-sections en 14 pt. Le repère est typographique parce qu'il est le seul
# fiable : les titres n'ont ni numérotation ni casse distinctive, et « Français »
# apparaît des dizaines de fois dans le corps du texte.
TAILLE_TITRE_MATIERE = 15.0


def lignes_typees(chemin_pdf: Path) -> list[tuple[float, str]]:
    """Lignes du PDF avec la taille de police maximale de chacune."""
    lignes: list[tuple[float, str]] = []
    for page in pymupdf.open(chemin_pdf):
        for bloc in page.get_text("dict")["blocks"]:
            for ligne in bloc.get("lines", []):
                texte = "".join(s["text"] for s in ligne["spans"]).strip()
                if texte:
                    lignes.append((round(max(s["size"] for s in ligne["spans"]), 1), texte))
    return lignes


def decouper_par_matiere(lignes: list[tuple[float, str]]) -> dict[str, str]:
    """Découpe un document de cycle en une entrée par matière.

    Une section inconnue LÈVE : si le ministère ajoute un enseignement, son
    contenu ne doit pas se retrouver silencieusement collé à la matière
    précédente. Il faut alors trancher dans `schema/mapping.py` — mapper ou
    ignorer avec un motif.
    """
    parties: dict[str, list[str]] = {}
    courants: tuple[str, ...] = ()
    for taille, texte in lignes:
        if taille >= TAILLE_TITRE_MATIERE:
            if texte in SECTIONS_IGNOREES:
                courants = ()
                continue
            slugs = SECTION_VERS_SLUGS.get(texte)
            if slugs is None:
                raise ValueError(
                    f"section inconnue dans un document de cycle : {texte!r} — "
                    "la mapper ou l'ignorer explicitement dans schema/mapping.py"
                )
            courants = slugs
            for slug in slugs:
                parties.setdefault(slug, [])
            continue
        for slug in courants:
            parties[slug].append(texte)
    return {slug: "\n".join(lignes_slug) for slug, lignes_slug in parties.items()}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--pdf",
        help="Nom du PDF sans extension (ex: programme_cycle3_BO2020). "
        "Sinon tous les PDFs de data/raw/ sont traités.",
    )
    args = parser.parse_args()

    if args.pdf:
        pdfs = [RAW / f"{args.pdf}.pdf"]
    else:
        pdfs = sorted(RAW.glob("*.pdf"))

    if not pdfs:
        print("Aucun PDF trouvé.", file=sys.stderr)
        sys.exit(1)

    print(f"Traitement de {len(pdfs)} PDF(s) :\n")
    for pdf in pdfs:
        md_path = pdf.with_suffix(".md")
        try:
            n_chars, n_h2 = extract_one(pdf, md_path)
            print(f"  ✓ {pdf.name:55} → {md_path.name:55} ({n_chars:>7} chars, {n_h2:3} H2)")
        except Exception as e:
            print(f"  ✗ {pdf.name}: {e}", file=sys.stderr)
            raise

    print("\n✓ Tous les PDFs convertis. ingest.py utilisera les .md prioritairement.")


if __name__ == "__main__":
    main()
