#!/usr/bin/env python3
"""
Pipeline RAG — ingestion des programmes officiels Éduscol dans Qdrant.

Flux :
  data/raw/*.md|*.txt
    → load_source_text()
    → chunk_text()            # markdown + tokenizer mistral-common
    → expand_for_niveaux()
    → validate_chunks()
    → ovh_embeddings.embed()  # dense via OVH AI Endpoints ; le creux est
                              # calculé par Qdrant (Cloud Inference, `bm25`)
    → upsert_to_qdrant()      # named vectors {dense, bm25} + id idempotent

Usage :
  uv run python scripts/ingest.py
  uv run python scripts/ingest.py --dry-run
  uv run python scripts/ingest.py --matiere=mathematiques
  uv run python scripts/ingest.py --status
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import pymupdf4llm
from dotenv import load_dotenv

from schema import (
    MATIERE_LABELS,
    Chunk,
    Matiere,
    NiveauCollege,
    NiveauLycee,
    build_contextual_text,
    chunk_point_id,
    get_qdrant_client,
)
from schema.programmes import DOCUMENTS_A_DECOUPER, RENTREE_COURANTE, en_vigueur
from schema.retrieval import SPARSE_MODEL
from scripts.extract_pdfs import decouper_par_matiere, lignes_typees
from scripts.fetch_sources import nom_fichier
from src.clients import ovh_embeddings

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

load_dotenv()

BASE = Path(__file__).parent.parent
RAW = BASE / "data" / "raw"
PDF_SOURCES = RAW / "pdf"

COLLECTION = os.environ.get("QDRANT_COLLECTION", "tomai_educational")

# Batch d'upsert : Qdrant Cloud peut timeout sur des payloads >20 MB en une
# seule requête. 200 points × ~5 KB ≈ 1 MB par batch — confortable.
UPSERT_BATCH_SIZE = 200

# ── Sources : dérivées du manifeste ──────────────────────────────────────────


def sources_du_manifeste(rentree: int = RENTREE_COURANTE) -> list[dict]:
    """Une source = un document × une matière, avec les niveaux qu'elle couvre.

    Remplace la constante `SOURCES` écrite à la main, qui était jusqu'ici
    l'unique définition de « ce qu'on indexe » — et donc invérifiable. Ici, ce
    qui est ingéré et ce que le test de couverture attend viennent du même
    manifeste.
    """
    par_document: dict[tuple[str, str], set[str]] = {}
    for programme in en_vigueur(rentree):
        par_document.setdefault((programme.url, programme.matiere), set()).add(programme.niveau)

    sources = []
    for (url, matiere), niveaux in sorted(par_document.items()):
        enum_matiere = Matiere(matiere)
        sources.append(
            {
                "url": url,
                "file": nom_fichier(url),
                "matiere": enum_matiere,
                "niveaux": sorted(niveaux),
                "section_name": MATIERE_LABELS[enum_matiere],
                # Seuls les documents de cycle se découpent. Un autre document
                # partagé par deux matières est le programme de chacune d'elles.
                "a_decouper": url in DOCUMENTS_A_DECOUPER,
            }
        )
    return sources


# ── Extraction texte ─────────────────────────────────────────────────────────


def texte_de_la_source(source: dict) -> str:
    """Texte d'une source, découpé si le document porte plusieurs matières.

    Les PDF mono-matière passent par `pymupdf4llm`, qui restitue les titres en
    `##` — ce sont les points de coupe prioritaires du chunker.
    """
    chemin = PDF_SOURCES / source["file"]
    if not chemin.exists():
        raise FileNotFoundError(
            f"{chemin.name} absent pour {source['section_name']} — "
            f"lancer scripts/fetch_sources.py ({source['url'][:80]})"
        )

    if source["a_decouper"]:
        parties = decouper_par_matiere(lignes_typees(chemin))
        texte = parties.get(source["matiere"].value, "")
        if len(texte.strip()) < 200:
            raise ValueError(
                f"section '{source['section_name']}' absente ou vide dans "
                f"{chemin.name} — le manifeste la déclare pourtant"
            )
        return texte.strip()

    texte = pymupdf4llm.to_markdown(str(chemin), page_chunks=False)
    if len(texte.strip()) < 200:
        raise ValueError(f"{chemin.name} : extraction vide ({len(texte)} caractères)")
    return texte.strip()


# ── Chunking : RecursiveChunker avec tokenizer Mistral ───────────────────────


_MISTRAL_TOKENIZER = None


def _get_mistral_token_counter():
    """
    Retourne un callable `str -> int` qui compte les vrais tokens Mistral.

    Lazy import + lazy init : mistral_common charge ~500MB de tokenizer state,
    on ne le charge qu'au premier appel du chunker.
    """
    global _MISTRAL_TOKENIZER
    if _MISTRAL_TOKENIZER is None:
        from mistral_common.tokens.tokenizers.mistral import MistralTokenizer

        _MISTRAL_TOKENIZER = MistralTokenizer.v3()

    def counter(text: str) -> int:
        return len(
            _MISTRAL_TOKENIZER.instruct_tokenizer.tokenizer.encode(text, bos=False, eos=False)
        )

    return counter


def chunk_text(text: str, source: dict) -> list[dict]:
    """
    Découpe le texte en chunks avec chonkie RecursiveChunker.

    Règles de découpe en cascade (Chonkie RecursiveRules) :
    1. Titres markdown (`\\n## `, `\\n### `) → garde le titre AVANT le chunk suivant
    2. Paragraphes (`\\n\\n`) → garde la fin du paragraphe à la fin du chunk
    3. Phrases (`. `, `! `, `? `) → fin de phrase à la fin du chunk
    4. Mots (whitespace) → fallback ultime

    chunk_size=400 = 400 tokens Mistral vrais (et non 400 caractères comme avant).
    """
    from chonkie import RecursiveChunker, RecursiveLevel, RecursiveRules

    rules = RecursiveRules(
        levels=[
            RecursiveLevel(delimiters=["\n## ", "\n### "], include_delim="next"),
            RecursiveLevel(delimiters=["\n\n"], include_delim="prev"),
            RecursiveLevel(delimiters=[". ", "! ", "? "], include_delim="prev"),
            RecursiveLevel(whitespace=True),
        ]
    )

    chunker = RecursiveChunker(
        # Chonkie 1.6 : `tokenizer` accepte un Callable[[str], int] via
        # CallableAutoTokenizer. Sûr ici car nos `rules` couvrent tous les niveaux
        # avec delimiters/whitespace — le fallback encode/decode (non implémenté
        # pour callables) n'est jamais déclenché.
        tokenizer=_get_mistral_token_counter(),
        chunk_size=400,  # tokens Mistral vrais
        rules=rules,
        min_characters_per_chunk=100,
    )

    raw_chunks = chunker(text)
    result = []
    for i, c in enumerate(raw_chunks):
        chunk_text_val = c.text.strip()
        if len(chunk_text_val) < 50:
            continue
        result.append(
            {
                "text": chunk_text_val,
                "source_file": source["file"],
                "matiere": source["matiere"].value,
                "section": source["section_name"],
                "chunk_index": i,
            }
        )
    return result


# ── Expansion multi-niveaux ──────────────────────────────────────────────────


def expand_for_niveaux(chunks: list[dict], niveaux: list[str]) -> list[dict]:
    """Duplique chaque chunk une fois par niveau que la source couvre.

    Les niveaux viennent du MANIFESTE, qui les date : la même section de cycle 4
    peut valoir pour la 4e et la 3e cette année et plus l'an prochain, quand la
    réforme les atteindra. Les dériver du nom de fichier, comme avant, rendait ce
    glissement impossible à exprimer.

    Un seul embedding par texte : le préfixe contextuel n'inclut pas le niveau.
    """
    expanded = []
    for chunk in chunks:
        for niveau in niveaux:
            nouveau = dict(chunk)
            nouveau["niveau"] = niveau
            expanded.append(nouveau)
    return expanded


# ── Validation Pydantic ──────────────────────────────────────────────────────


def validate_chunks(chunks: list[dict]) -> list[dict]:
    """
    Valide les chunks via Chunk Pydantic, retourne les payloads Qdrant.

    Lève ValidationError au premier échec (pas de silence sur les bugs schema).
    """
    validated = []
    for c in chunks:
        # Cast niveau str → enum (NiveauCollege ou NiveauLycee selon valeur)
        niveau_str = c["niveau"]
        try:
            niveau = NiveauCollege(niveau_str)
        except ValueError:
            niveau = NiveauLycee(niveau_str)

        chunk = Chunk(
            text=c["text"],
            source_file=c["source_file"],
            matiere=Matiere(c["matiere"]),
            niveau=niveau,
            section=c["section"],
            chunk_index=c["chunk_index"],
        )
        validated.append(chunk.to_qdrant_payload())
    return validated


# ── Suppression des orphelins ────────────────────────────────────────────────


def supprimer_source(source_file: str, *, client=None, collection: str | None = None) -> None:
    """Retire tous les points issus d'un fichier source.

    Appelé AVANT de réingérer ce fichier : les identifiants dérivant du contenu,
    un texte modifié produirait un point neuf en laissant l'ancien servable
    indéfiniment — un élève lirait alors un programme abrogé sans que rien ne le
    signale.
    """
    from qdrant_client import models

    (client or get_qdrant_client()).delete(
        collection_name=collection or COLLECTION,
        points_selector=models.FilterSelector(
            filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="source_file", match=models.MatchValue(value=source_file)
                    )
                ]
            )
        ),
        wait=True,
    )


# ── Upsert Qdrant (named vectors + sparse BM25) ──────────────────────────────


def upsert_to_qdrant(
    payloads: list[dict],
    dense_vectors: list[list[float]],
    sparse_texts: list[str],
) -> int:
    """
    Upsert dans la collection cible (named vectors `dense` + sparse `bm25`).

    - ID stable : chunk_point_id() (schema/document.py)
      → idempotent : re-run = pas de doublons, modif text = nouveau point.
    """
    from qdrant_client import models

    client = get_qdrant_client()

    existing = {c.name for c in client.get_collections().collections}
    if COLLECTION not in existing:
        raise RuntimeError(
            f"Collection '{COLLECTION}' absente. "
            f"Exécuter d'abord : uv run python scripts/migrate_collection.py"
        )

    points = []
    for i, (payload, dense_vec) in enumerate(zip(payloads, dense_vectors, strict=True)):
        text = payload["text"]
        niveau = payload["niveau"]
        matiere = payload["matiere"]

        point_id = chunk_point_id(matiere, niveau, text)

        # Le creux est calculé par Qdrant à l'écriture, sur le MÊME texte que le
        # dense (contextualisé) : deux branches qui verraient des contenus
        # différents ne chercheraient plus dans le même document.
        sparse_doc = models.Document(text=sparse_texts[i], model=SPARSE_MODEL)

        points.append(
            models.PointStruct(
                id=point_id,
                vector={
                    "dense": dense_vec,
                    "bm25": sparse_doc,
                },
                payload=payload,
            )
        )

    # Batch upsert par chunks de UPSERT_BATCH_SIZE points. Sans batching,
    # un payload >20 MB peut faire timeout sur Qdrant Cloud (write op).
    # L'identifiant dérivé du contenu garantit l'idempotence : retry sans
    # craindre les doublons.
    upserted = 0
    for i in range(0, len(points), UPSERT_BATCH_SIZE):
        batch = points[i : i + UPSERT_BATCH_SIZE]
        for attempt in range(3):
            try:
                client.upsert(collection_name=COLLECTION, points=batch, wait=True)
                upserted += len(batch)
                break
            except Exception as e:
                if attempt == 2:
                    raise
                wait = 5 * (2**attempt)  # 5, 10 s
                print(
                    f"  ⚠ upsert batch {i // UPSERT_BATCH_SIZE + 1} fail "
                    f"(essai {attempt + 1}/3) : {e}, retry dans {wait}s"
                )
                time.sleep(wait)
    return upserted


def show_status() -> None:
    """Affiche les statistiques de la collection v2."""
    client = get_qdrant_client()
    try:
        info = client.get_collection(COLLECTION)
        counts = client.count(collection_name=COLLECTION)
        print(f"Collection : {COLLECTION}")
        print(f"  Points   : {counts.count}")
        print(f"  Status   : {info.status}")
        print(f"  Vectors  : {info.config.params.vectors}")
        sparse = getattr(info.config.params, "sparse_vectors", None)
        if sparse:
            print(f"  Sparse   : {sparse}")
    except Exception as e:
        print(f"Collection '{COLLECTION}' introuvable : {e}")


# ── Pipeline principal ───────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Affiche chunks sans upserter")
    parser.add_argument("--matiere", help="Filtre sur une matière (ex: mathematiques)")
    parser.add_argument("--status", action="store_true", help="État collection Qdrant")
    parser.add_argument(
        "--rentree",
        type=int,
        default=RENTREE_COURANTE,
        help="Rentrée de référence : décide quel programme s'applique à quel niveau",
    )
    parser.add_argument(
        "--collection",
        default=None,
        help=(
            "Override la collection cible (sinon QDRANT_COLLECTION env ou "
            "'tomai_educational'). Utile pour bench un embedder alternatif "
            "dans une sandbox sans toucher l'index prod."
        ),
    )
    args = parser.parse_args()

    # Override collection si demandé (avant que upsert_to_qdrant lise la globale)
    global COLLECTION
    if args.collection:
        COLLECTION = args.collection

    if args.status:
        show_status()
        return

    toutes = sources_du_manifeste(args.rentree)
    sources = toutes
    if args.matiere:
        sources = [s for s in toutes if s["matiere"].value == args.matiere]
        if not sources:
            available = sorted({s["matiere"].value for s in toutes})
            print(f"Matière '{args.matiere}' inconnue. Disponibles : {available}")
            sys.exit(1)

    print(
        f"rentrée {args.rentree} : {len(sources)} sources "
        f"({len({s['file'] for s in sources})} documents)"
    )

    total_points = 0
    errors: list[str] = []
    fichiers_purges: set[str] = set()

    for source in sources:
        niveaux = ", ".join(source["niveaux"])
        print(f"\n▶ {source['section_name']} ({source['matiere'].value}) — {niveaux}")
        try:
            text = texte_de_la_source(source)
        except (FileNotFoundError, ValueError) as e:
            print(f"  ✗ {e}", file=sys.stderr)
            errors.append(source["matiere"].value)
            continue

        chunks = chunk_text(text, source)
        print(f"  {len(chunks)} chunks bruts")

        expanded = expand_for_niveaux(chunks, source["niveaux"])
        print(f"  {len(expanded)} chunks après expansion multi-niveaux")

        if args.dry_run:
            for c in expanded[:3]:
                contextual = build_contextual_text(
                    Chunk(
                        text=c["text"],
                        source_file=c["source_file"],
                        matiere=Matiere(c["matiere"]),
                        niveau=NiveauCollege(c["niveau"])
                        if c["niveau"] in {n.value for n in NiveauCollege}
                        else NiveauLycee(c["niveau"]),
                        section=c["section"],
                        chunk_index=c["chunk_index"],
                    )
                )
                print(f"  [{c['chunk_index']}|{c['niveau']}] {contextual[:200]}…")
            continue

        if not expanded:
            errors.append(source["matiere"].value)
            continue

        if not args.dry_run and source["file"] not in fichiers_purges:
            # Les identifiants dérivent du contenu : sans cette purge, un texte
            # modifié créerait un point neuf en laissant l'ancien servable.
            supprimer_source(source["file"])
            fichiers_purges.add(source["file"])

        print("  Validation…", end=" ", flush=True)
        payloads = validate_chunks(expanded)
        print(f"{len(payloads)} valides")

        # Optimisation : embedder UNE fois chaque texte unique, puis broadcaster
        # aux duplications de niveau.
        unique_texts: dict[str, int] = {}
        embed_inputs: list[str] = []
        for p in payloads:
            text = p["text"]
            if text not in unique_texts:
                # Préfixe contextuel SANS niveau (cf. schema/contextual.py)
                chunk_for_prefix = Chunk(
                    text=text,
                    source_file=p["source_file"],
                    matiere=Matiere(p["matiere"]),
                    niveau=NiveauCollege(p["niveau"])
                    if p["niveau"] in {n.value for n in NiveauCollege}
                    else NiveauLycee(p["niveau"]),
                    section=p["section"],
                    chunk_index=p["chunk_index"],
                )
                unique_texts[text] = len(embed_inputs)
                embed_inputs.append(build_contextual_text(chunk_for_prefix))

        # Dense via OVH ; documents embeddés BRUTS (aucune instruction : elle
        # est réservée aux requêtes, cf. src/clients/ovh_embeddings.py).
        model = ovh_embeddings.model_name()
        print(
            f"  Embedding ({len(embed_inputs)} textes uniques via OVH {model})…",
            end=" ",
            flush=True,
        )
        unique_vectors = ovh_embeddings.embed(embed_inputs)
        print(f"{len(unique_vectors)} vecteurs")

        dense_vectors = [unique_vectors[unique_texts[p["text"]]] for p in payloads]
        sparse_texts = [embed_inputs[unique_texts[p["text"]]] for p in payloads]

        print(f"  Upsert {len(payloads)} points…", end=" ", flush=True)
        n = upsert_to_qdrant(payloads, dense_vectors, sparse_texts)
        print(f"✓ ({n} points dans '{COLLECTION}')")
        total_points += n

    if errors:
        print(f"\n✗ {len(errors)} matière(s) en erreur : {errors}", file=sys.stderr)
        sys.exit(1)

    if not args.dry_run:
        print(f"\nTotal : {total_points} points upsertés")
        show_status()


if __name__ == "__main__":
    main()
