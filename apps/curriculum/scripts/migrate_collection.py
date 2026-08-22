#!/usr/bin/env python3
"""
Administration de la collection Qdrant.

Config canonique :
- Vecteurs nommés `dense` (dimension sondée depuis le modèle, cosine) +
  `bm25` (sparse, Modifier.IDF, calculé par Qdrant)
- Quantization scalar int8 always_ram (4× compression RAM, <1% perte recall)
- Payload indexes KEYWORD sur : niveau, matiere, cycle, source_file

`QDRANT_COLLECTION` (défaut `tomai_educational`) est un ALIAS : il pointe une
collection horodatée. Une réindexation complète se fait donc dans une collection
NEUVE, puis bascule l'alias — réindexer en place laisserait le serveur servir un
index à moitié vide pendant l'opération, et un index mixte si elle échoue.

Usage :
  uv run python scripts/migrate_collection.py             # crée si absente
  uv run python scripts/migrate_collection.py --nouvelle  # collection neuve pour réindexer
  uv run python scripts/migrate_collection.py --promote X # bascule l'alias sur X
  uv run python scripts/migrate_collection.py --recreate  # drop+create (DESTRUCTIF)
  uv run python scripts/migrate_collection.py --status    # état des collections

Sources :
- https://qdrant.tech/documentation/concepts/indexing/ (sparse + payload index)
- https://qdrant.tech/documentation/guides/quantization/ (scalar int8)
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from datetime import date
from pathlib import Path

from dotenv import load_dotenv
from qdrant_client import QdrantClient, models

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from schema.retrieval import get_qdrant_client  # noqa: E402

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

load_dotenv()

COLLECTION_NAME = os.environ.get("QDRANT_COLLECTION", "tomai_educational")

PAYLOAD_INDEX_FIELDS = ("niveau", "matiere", "cycle", "source_file")


def get_client() -> QdrantClient:
    """Accesseur unique (schema/retrieval.py).

    Fabriquer un client ici en dupliquait la configuration, et celui-ci omettait
    `cloud_inference=True` — le drapeau sans lequel Qdrant refuse de vectoriser
    nos `models.Document` côté serveur.
    """
    return get_qdrant_client()


def collection_pointee(client: QdrantClient) -> str | None:
    """Collection que l'alias désigne aujourd'hui."""
    for alias in client.get_aliases().aliases:
        if alias.alias_name == COLLECTION_NAME:
            return alias.collection_name
    return None


def nom_de_collection_neuve(client: QdrantClient) -> str:
    """Nom horodaté dérivé de la collection en service."""
    actuelle = collection_pointee(client) or COLLECTION_NAME
    base = re.sub(r"_\d{8}$", "", actuelle)
    return f"{base}_{date.today():%Y%m%d}"


def promouvoir(client: QdrantClient, cible: str) -> None:
    """Bascule l'alias sur `cible`, en une opération atomique.

    C'est le moment où la nouvelle indexation devient visible du serveur. Elle
    ne doit l'être qu'une fois complète : le test de couverture est le feu vert.
    """
    if cible not in {c.name for c in client.get_collections().collections}:
        raise RuntimeError(f"collection '{cible}' inexistante")
    ancienne = collection_pointee(client)
    operations = []
    if ancienne:
        operations.append(
            models.DeleteAliasOperation(delete_alias=models.DeleteAlias(alias_name=COLLECTION_NAME))
        )
    operations.append(
        models.CreateAliasOperation(
            create_alias=models.CreateAlias(collection_name=cible, alias_name=COLLECTION_NAME)
        )
    )
    client.update_collection_aliases(change_aliases_operations=operations)
    print(f"✓ alias '{COLLECTION_NAME}' : {ancienne or '(aucune)'} → {cible}")
    if ancienne:
        print(f"  '{ancienne}' reste en place — la supprimer une fois la bascule vérifiée")


def probe_dense_dim() -> int:
    """Dimension réelle du modèle d'embedding configuré, demandée au fournisseur.

    Sondée plutôt que codée en dur : une table de correspondance modèle→dimension
    se périme en silence, et une collection créée à la mauvaise dimension ne se
    découvre qu'à l'ingestion, après coup.
    """
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from src.clients import ovh_embeddings

    model = ovh_embeddings.model_name()
    dim = len(ovh_embeddings.embed(["sonde de dimension"], model=model)[0])
    print(f"  · {model} → {dim}D (sondé)")
    return dim


def create_collection(
    client: QdrantClient,
    recreate: bool = False,
    dense_dim: int | None = None,
    nom: str | None = None,
) -> None:
    """Crée la collection avec la config cible. Idempotent sauf si recreate=True."""
    global COLLECTION_NAME
    if nom:
        COLLECTION_NAME = nom
    dense_dim = dense_dim or probe_dense_dim()
    existing = {c.name for c in client.get_collections().collections}

    if COLLECTION_NAME in existing:
        if not recreate:
            print(
                f"✓ Collection '{COLLECTION_NAME}' existe déjà "
                "(skip — utiliser --recreate pour drop+create)"
            )
            _ensure_payload_indexes(client)
            return
        print(f"⚠ --recreate : suppression de '{COLLECTION_NAME}'")
        client.delete_collection(COLLECTION_NAME)

    print(f"▶ Création collection '{COLLECTION_NAME}'")
    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config={
            "dense": models.VectorParams(
                size=dense_dim,
                distance=models.Distance.COSINE,
                on_disk=False,  # corpus <1M points, RAM OK
            ),
        },
        sparse_vectors_config={
            "bm25": models.SparseVectorParams(
                # Modifier.IDF : Qdrant calcule IDF server-side à partir des
                # indices+values fournis par le client.
                modifier=models.Modifier.IDF,
                index=models.SparseIndexParams(on_disk=False),
            ),
        },
        quantization_config=models.ScalarQuantization(
            scalar=models.ScalarQuantizationConfig(
                type=models.ScalarType.INT8,
                quantile=0.99,  # exclut top 1% outliers pour préserver le recall
                always_ram=True,  # int8 en RAM même si vectors on_disk=True
            ),
        ),
    )
    print(f"  ✓ {COLLECTION_NAME} créée (dense {dense_dim}D cosine + sparse bm25 IDF + int8)")
    _ensure_payload_indexes(client)


def _ensure_payload_indexes(client: QdrantClient) -> None:
    """Crée les payload indexes KEYWORD (idempotent : recréer = no-op côté Qdrant)."""
    for field in PAYLOAD_INDEX_FIELDS:
        try:
            client.create_payload_index(
                collection_name=COLLECTION_NAME,
                field_name=field,
                field_schema=models.PayloadSchemaType.KEYWORD,
            )
            print(f"  ✓ index KEYWORD sur '{field}'")
        except Exception as e:
            msg = str(e).lower()
            if "already exists" in msg or "exists" in msg:
                print(f"  · index '{field}' déjà présent")
            else:
                raise


def show_status(client: QdrantClient) -> None:
    """Affiche l'état actuel des collections + aliases."""
    collections = client.get_collections().collections
    print("── Collections ──────────────────────────────")
    for c in collections:
        info = client.get_collection(c.name)
        count = client.count(c.name).count
        print(f"  {c.name}")
        print(f"    points : {count}")
        print(f"    status : {info.status}")
        print(f"    vectors: {info.config.params.vectors}")
        sparse = getattr(info.config.params, "sparse_vectors", None)
        if sparse:
            print(f"    sparse : {sparse}")

    print("\n── Aliases ──────────────────────────────────")
    try:
        aliases = client.get_aliases().aliases
        if not aliases:
            print("  (aucun alias)")
        for a in aliases:
            print(f"  {a.alias_name} → {a.collection_name}")
    except Exception as e:
        print(f"  (impossible de lister les aliases : {e})")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--recreate", action="store_true", help="Drop + create (destructif)")
    parser.add_argument(
        "--nouvelle",
        action="store_true",
        help="Crée une collection neuve horodatée, pour réindexer sans toucher au service",
    )
    parser.add_argument("--promote", metavar="COLLECTION", help="Bascule l'alias sur COLLECTION")
    parser.add_argument("--status", action="store_true", help="Affiche état des collections")
    parser.add_argument(
        "--dim", type=int, help="Dimension dense (défaut : sondée depuis OVH_EMBED_MODEL)"
    )
    args = parser.parse_args()

    client = get_client()

    if args.status:
        show_status(client)
        return

    if args.promote:
        promouvoir(client, args.promote)
        return

    if args.nouvelle:
        nom = nom_de_collection_neuve(client)
        create_collection(client, dense_dim=args.dim, nom=nom)
        print(
            f"\n▶ Réindexer dedans :\n"
            f"    QDRANT_COLLECTION={nom} uv run python scripts/ingest.py\n"
            f"    QDRANT_COLLECTION={nom} uv run python scripts/coverage_report.py\n"
            f"  puis, une fois vert :\n"
            f"    uv run python scripts/migrate_collection.py --promote {nom}"
        )
        return

    # Défaut : créer la collection canonique (idempotent)
    create_collection(client, recreate=args.recreate, dense_dim=args.dim)


if __name__ == "__main__":
    main()
