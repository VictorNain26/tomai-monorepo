"""Tests du client ai-service /embed — réseau mocké via monkeypatch httpx."""

from __future__ import annotations

import httpx
import pytest

from src.clients import ai_service
from src.clients.ai_service import EmbedItem, SparseVector


def _fake_response(payload: dict, status: int = 200):
    class _R:
        status_code = status

        def json(self):
            return payload

        def raise_for_status(self):
            if status >= 400:
                import httpx

                raise httpx.HTTPStatusError("err", request=None, response=None)

    return _R()


def test_embed_parses_dense_and_sparse(monkeypatch):
    monkeypatch.setenv("AI_SERVICE_URL", "http://localhost:8000")
    captured = {}

    def fake_post(url, headers=None, json=None, timeout=None):
        captured["url"] = url
        captured["json"] = json
        return _fake_response(
            {
                "model": "BAAI/bge-m3",
                "embeddings": [{"dense": [0.1, 0.2], "sparse": {"indices": [7], "values": [1.5]}}],
            }
        )

    monkeypatch.setattr(ai_service.httpx, "post", fake_post)
    items = ai_service.embed(["bonjour"], warm=False)

    assert items == [EmbedItem(dense=[0.1, 0.2], sparse=SparseVector(indices=[7], values=[1.5]))]
    assert captured["url"].endswith("/embed")
    assert captured["json"] == {"texts": ["bonjour"]}


def test_embed_empty_returns_empty(monkeypatch):
    monkeypatch.setattr(ai_service.httpx, "post", lambda *a, **k: pytest.fail("no call"))
    assert ai_service.embed([], warm=False) == []


def test_embed_batches_over_limit(monkeypatch):
    monkeypatch.setenv("AI_SERVICE_URL", "http://localhost:8000")
    monkeypatch.setattr(ai_service, "EMBED_BATCH_SIZE", 2)
    calls: list[int] = []

    def fake_post(url, headers=None, json=None, timeout=None):
        n = len(json["texts"])
        calls.append(n)
        item = {"dense": [0.0], "sparse": {"indices": [], "values": []}}
        return _fake_response({"model": "m", "embeddings": [item] * n})

    monkeypatch.setattr(ai_service.httpx, "post", fake_post)
    out = ai_service.embed(["a", "b", "c", "d", "e"], warm=False)

    assert len(out) == 5
    assert calls == [2, 2, 1]  # invariant : chaque requête <= EMBED_BATCH_SIZE


def test_bearer_header_sent_when_token_set(monkeypatch):
    monkeypatch.setenv("AI_SERVICE_URL", "http://x:8000")
    monkeypatch.setenv("AI_SERVICE_TOKEN", "secret")
    seen = {}

    def fake_post(url, headers=None, json=None, timeout=None):
        seen["auth"] = headers.get("Authorization")
        item = {"dense": [0.0], "sparse": {"indices": [], "values": []}}
        return _fake_response({"model": "m", "embeddings": [item]})

    monkeypatch.setattr(ai_service.httpx, "post", fake_post)
    ai_service.embed(["x"], warm=False)
    assert seen["auth"] == "Bearer secret"


def test_missing_url_raises(monkeypatch):
    monkeypatch.delenv("AI_SERVICE_URL", raising=False)
    with pytest.raises(RuntimeError, match="AI_SERVICE_URL"):
        ai_service.embed(["x"], warm=False)


def test_embed_raises_on_length_mismatch(monkeypatch):
    monkeypatch.setenv("AI_SERVICE_URL", "http://x:8000")

    def fake_post(url, headers=None, json=None, timeout=None):
        item = {"dense": [0.0], "sparse": {"indices": [], "values": []}}
        return _fake_response({"model": "m", "embeddings": [item]})

    monkeypatch.setattr(ai_service.httpx, "post", fake_post)
    with pytest.raises(RuntimeError, match="tronqu"):
        ai_service.embed(["a", "b"], warm=False)


def _raising_response(status: int):
    """Response whose raise_for_status raises a status-bearing HTTPStatusError."""

    class _R:
        status_code = status

        def json(self):
            return {}

        def raise_for_status(self):
            raise httpx.HTTPStatusError("err", request=None, response=self)

    return _R()


def test_embed_retries_then_raises_on_persistent_5xx(monkeypatch):
    # The sole embedding gate must fail loud after exhausting retries, never swallow.
    monkeypatch.setenv("AI_SERVICE_URL", "http://localhost:8000")
    monkeypatch.setattr(ai_service.time, "sleep", lambda *_a, **_k: None)
    calls = {"n": 0}

    def fake_post(url, headers=None, json=None, timeout=None):
        calls["n"] += 1
        return _raising_response(503)

    monkeypatch.setattr(ai_service.httpx, "post", fake_post)
    with pytest.raises(httpx.HTTPStatusError):
        ai_service.embed(["bonjour"], warm=False)
    assert calls["n"] == ai_service._MAX_RETRIES


def test_embed_raises_immediately_on_non_transient_401(monkeypatch):
    # A 401 is non-transient: raise on the first attempt, no retry, no backoff sleep.
    monkeypatch.setenv("AI_SERVICE_URL", "http://localhost:8000")
    slept = {"n": 0}
    monkeypatch.setattr(
        ai_service.time, "sleep", lambda *_a, **_k: slept.__setitem__("n", slept["n"] + 1)
    )
    calls = {"n": 0}

    def fake_post(url, headers=None, json=None, timeout=None):
        calls["n"] += 1
        return _raising_response(401)

    monkeypatch.setattr(ai_service.httpx, "post", fake_post)
    with pytest.raises(httpx.HTTPStatusError):
        ai_service.embed(["bonjour"], warm=False)
    assert calls["n"] == 1
    assert slept["n"] == 0
