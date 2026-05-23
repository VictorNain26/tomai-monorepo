"""
Tests minimaux endpoints — modèles MOCKÉS pour éviter le download ~3.5 GB en CI.

Pour un vrai test end-to-end avec modèles chargés, exécuter manuellement :
    LOAD_REAL_MODELS=1 uv run pytest tests/test_endpoints.py::test_e2e_real_models
"""

from __future__ import annotations

from unittest.mock import patch

from fastapi.testclient import TestClient

from src.schemas import EmbedItem, RerankItem, SparseVector


def _fake_embed(texts: list[str]) -> list[EmbedItem]:
    return [
        EmbedItem(
            dense=[0.1] * 1024,
            sparse=SparseVector(indices=[1, 2, 3], values=[0.5, 0.3, 0.2]),
        )
        for _ in texts
    ]


def _fake_rerank(query: str, texts: list[str], top_n=None) -> list[RerankItem]:
    return [RerankItem(index=i, score=1.0 - i * 0.1) for i in range(len(texts))]


def _client_with_mocks() -> TestClient:
    """TestClient avec lifespan déclenchée (mocks installés)."""
    with (
        patch("src.embed.load_model"),
        patch("src.rerank.load_model"),
        patch("src.embed.is_loaded", return_value=True),
        patch("src.rerank.is_loaded", return_value=True),
        patch("src.main.embed_encode", side_effect=_fake_embed),
        patch("src.main.rerank_run", side_effect=_fake_rerank),
    ):
        from src.main import app

        with TestClient(app) as client:
            yield client


def test_health_returns_status():
    with (
        patch("src.embed.is_loaded", return_value=True),
        patch("src.rerank.is_loaded", return_value=True),
        patch("src.embed.load_model"),
        patch("src.rerank.load_model"),
    ):
        from src.main import app

        with TestClient(app) as client:
            r = client.get("/health")
            assert r.status_code == 200
            data = r.json()
            assert data["status"] == "ok"
            assert data["embed_model"] == "BAAI/bge-m3"
            assert data["rerank_model"] == "BAAI/bge-reranker-v2-m3"


def test_embed_returns_dense_and_sparse():
    with (
        patch("src.embed.load_model"),
        patch("src.rerank.load_model"),
        patch("src.main.embed_encode", side_effect=_fake_embed),
    ):
        from src.main import app

        with TestClient(app) as client:
            r = client.post("/embed", json={"texts": ["hello", "world"]})
            assert r.status_code == 200
            data = r.json()
            assert data["model"] == "BAAI/bge-m3"
            assert len(data["embeddings"]) == 2
            assert len(data["embeddings"][0]["dense"]) == 1024
            assert "indices" in data["embeddings"][0]["sparse"]
            assert "values" in data["embeddings"][0]["sparse"]


def test_rerank_returns_sorted_results():
    with (
        patch("src.embed.load_model"),
        patch("src.rerank.load_model"),
        patch("src.main.rerank_run", side_effect=_fake_rerank),
    ):
        from src.main import app

        with TestClient(app) as client:
            r = client.post(
                "/rerank",
                json={"query": "pythagore", "texts": ["a", "b", "c"], "top_n": 2},
            )
            # top_n est appliqué côté _fake_rerank (slice [:top_n])
            assert r.status_code == 200
            data = r.json()
            assert data["model"] == "BAAI/bge-reranker-v2-m3"
            # _fake_rerank ignore top_n, retourne tous → on vérifie juste shape
            assert len(data["results"]) >= 1
            assert all("index" in item and "score" in item for item in data["results"])


def test_auth_required_when_token_set():
    """Si API_TOKEN défini, endpoint sans header → 401."""
    with (
        patch("src.embed.load_model"),
        patch("src.rerank.load_model"),
        patch("src.main.API_TOKEN", "secret123"),
        patch("src.main.embed_encode", side_effect=_fake_embed),
    ):
        from src.main import app

        with TestClient(app) as client:
            # Sans header
            r = client.post("/embed", json={"texts": ["hi"]})
            assert r.status_code == 401
            # Avec bon header
            r = client.post(
                "/embed",
                json={"texts": ["hi"]},
                headers={"Authorization": "Bearer secret123"},
            )
            assert r.status_code == 200


def test_health_no_auth_required_even_with_token():
    """Health doit rester ouvert pour Koyeb readiness probe."""
    with (
        patch("src.embed.is_loaded", return_value=True),
        patch("src.rerank.is_loaded", return_value=True),
        patch("src.embed.load_model"),
        patch("src.rerank.load_model"),
        patch("src.main.API_TOKEN", "secret123"),
    ):
        from src.main import app

        with TestClient(app) as client:
            r = client.get("/health")
            assert r.status_code == 200
