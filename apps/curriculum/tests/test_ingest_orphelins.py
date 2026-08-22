"""Réingérer une source ne doit pas laisser ses anciens chunks derrière.

Les identifiants dérivent du contenu : un texte modifié crée un point NEUF et
l'ancien reste servable. Des chunks périmés continueraient d'être présentés à des
élèves comme le programme officiel — c'est le scénario que ce test interdit.
"""

from qdrant_client import QdrantClient, models

from schema import chunk_point_id
from scripts.ingest import supprimer_source


def _collection_avec_deux_sources():
    client = QdrantClient(":memory:")
    client.create_collection(
        "t",
        vectors_config={"dense": models.VectorParams(size=2, distance=models.Distance.COSINE)},
    )
    client.upsert(
        "t",
        points=[
            models.PointStruct(
                id=chunk_point_id("mathematiques", "sixieme", "a"),
                vector={"dense": [0.1, 0.2]},
                payload={"source_file": "vieux", "matiere": "mathematiques", "niveau": "sixieme"},
            ),
            models.PointStruct(
                id=chunk_point_id("mathematiques", "sixieme", "b"),
                vector={"dense": [0.3, 0.4]},
                payload={"source_file": "autre", "matiere": "mathematiques", "niveau": "sixieme"},
            ),
        ],
        wait=True,
    )
    return client


def test_supprimer_source_retire_uniquement_ses_points():
    client = _collection_avec_deux_sources()
    supprimer_source("vieux", client=client, collection="t")
    restants = client.scroll("t", limit=10, with_payload=True)[0]
    assert len(restants) == 1
    assert restants[0].payload["source_file"] == "autre"


def test_supprimer_une_source_absente_ne_touche_a_rien():
    client = _collection_avec_deux_sources()
    supprimer_source("jamais_ingere", client=client, collection="t")
    assert client.count("t").count == 2
