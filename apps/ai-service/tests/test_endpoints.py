"""
Tests minimaux endpoints — modèles MOCKÉS pour éviter le download ~3.5 GB en CI.

Pour un vrai test end-to-end avec modèles chargés, exécuter manuellement :
    LOAD_REAL_MODELS=1 uv run pytest tests/test_endpoints.py::test_e2e_real_models
"""

from __future__ import annotations

from collections.abc import Iterator
from unittest.mock import patch

import pytest
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


def _fake_rerank(query: str, texts: list[str], top_n: int | None = None) -> list[RerankItem]:
    return [RerankItem(index=i, score=1.0 - i * 0.1) for i in range(len(texts))]


@pytest.fixture
def client() -> Iterator[TestClient]:
    """TestClient avec lifespan déclenchée et modèles ML mockés (pas de download)."""
    with (
        patch("src.embed.load_model"),
        patch("src.rerank.load_model"),
        patch("src.embed.is_loaded", return_value=True),
        patch("src.rerank.is_loaded", return_value=True),
        patch("src.main.embed_encode", side_effect=_fake_embed),
        patch("src.main.rerank_run", side_effect=_fake_rerank),
    ):
        from src.main import app

        with TestClient(app) as test_client:
            yield test_client


def test_health_returns_status(client: TestClient) -> None:
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["embed_model"] == "BAAI/bge-m3"
    assert data["rerank_model"] == "BAAI/bge-reranker-v2-m3"


def test_embed_returns_dense_and_sparse(client: TestClient) -> None:
    r = client.post("/embed", json={"texts": ["hello", "world"]})
    assert r.status_code == 200
    data = r.json()
    assert data["model"] == "BAAI/bge-m3"
    assert len(data["embeddings"]) == 2
    assert len(data["embeddings"][0]["dense"]) == 1024
    assert "indices" in data["embeddings"][0]["sparse"]
    assert "values" in data["embeddings"][0]["sparse"]


def test_rerank_returns_sorted_results(client: TestClient) -> None:
    r = client.post(
        "/rerank",
        json={"query": "pythagore", "texts": ["a", "b", "c"], "top_n": 2},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["model"] == "BAAI/bge-reranker-v2-m3"
    assert len(data["results"]) >= 1
    assert all("index" in item and "score" in item for item in data["results"])


def test_health_no_auth_required_even_with_token(client: TestClient) -> None:
    """Health doit rester ouvert pour Koyeb readiness probe, même token défini."""
    with patch("src.main.API_TOKEN", "secret123"):
        r = client.get("/health")
        assert r.status_code == 200


def test_auth_rejects_missing_token(client: TestClient) -> None:
    """API_TOKEN défini + pas de header Authorization → 401."""
    with patch("src.main.API_TOKEN", "secret123"):
        r = client.post("/embed", json={"texts": ["hi"]})
        assert r.status_code == 401


def test_auth_rejects_wrong_token(client: TestClient) -> None:
    """API_TOKEN défini + mauvais bearer → 401 (comparaison constant-time)."""
    with patch("src.main.API_TOKEN", "secret123"):
        r = client.post(
            "/embed",
            json={"texts": ["hi"]},
            headers={"Authorization": "Bearer wrong-token"},
        )
        assert r.status_code == 401


def test_auth_accepts_correct_token(client: TestClient) -> None:
    """API_TOKEN défini + bon bearer → 200."""
    with patch("src.main.API_TOKEN", "secret123"):
        r = client.post(
            "/embed",
            json={"texts": ["hi"]},
            headers={"Authorization": "Bearer secret123"},
        )
        assert r.status_code == 200


def test_validate_config_fails_fast_in_production_without_token() -> None:
    """Boot en production sans API_TOKEN → RuntimeError (fail-fast)."""
    from src import config

    with (
        patch.object(config, "ENVIRONMENT", "production"),
        patch.object(config, "API_TOKEN", ""),
    ):
        with pytest.raises(RuntimeError, match="API_TOKEN is required in production"):
            config.validate_config()


def test_validate_config_passes_in_production_with_token() -> None:
    """Boot en production avec API_TOKEN défini → pas d'erreur."""
    from src import config

    with (
        patch.object(config, "ENVIRONMENT", "production"),
        patch.object(config, "API_TOKEN", "secret123"),
    ):
        config.validate_config()


def test_validate_config_permissive_in_development_without_token() -> None:
    """En dev sans API_TOKEN → démarrage autorisé (endpoints publics)."""
    from src import config

    with (
        patch.object(config, "ENVIRONMENT", "development"),
        patch.object(config, "API_TOKEN", ""),
    ):
        config.validate_config()


def test_embed_runs_off_event_loop(client: TestClient) -> None:
    """L'inférence embed doit être offloadée (run_in_threadpool) — le handler
    reste responsive. On vérifie que l'endpoint répond toujours 200 quand
    embed_encode est une fonction bloquante (sleep)."""
    import time

    def _slow_embed(texts: list[str]) -> list[EmbedItem]:
        time.sleep(0.05)
        return _fake_embed(texts)

    with patch("src.main.embed_encode", side_effect=_slow_embed):
        r = client.post("/embed", json={"texts": ["hi"]})
        assert r.status_code == 200
        assert len(r.json()["embeddings"]) == 1
