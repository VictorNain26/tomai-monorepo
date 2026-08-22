"""Tests du client OVH AI Endpoints — réseau mocké.

Le client remplace `ai_service` pour la moitié DENSE. Le creux ne passe plus
par lui : Qdrant le calcule côté serveur (Cloud Inference, modèle `bm25`).

Deux comportements méritent des tests parce qu'ils sont invisibles à l'œil et
faussent tout s'ils cassent :
- l'ORDRE des vecteurs doit suivre l'ordre des textes, y compris à travers le
  découpage en lots (OVH renvoie un champ `index`, qu'on doit honorer) ;
- le préfixe d'instruction ne s'applique qu'aux REQUÊTES, jamais aux documents
  (asymétrie exigée par Qwen3-Embedding ; l'ignorer dégrade silencieusement).
"""

from __future__ import annotations

import pytest

from src.clients import ovh_embeddings as ovh


class _Resp:
    def __init__(self, status: int, payload: dict | None = None):
        self.status_code = status
        self._payload = payload or {}
        self.text = "erreur simulée"

    def json(self):
        return self._payload


def _ok(vectors: list[list[float]], shuffled: bool = False) -> _Resp:
    """Réponse OpenAI-compatible. `shuffled` renvoie les éléments à l'envers
    pour prouver qu'on trie sur `index` et non sur l'ordre d'arrivée."""
    data = [{"object": "embedding", "index": i, "embedding": v} for i, v in enumerate(vectors)]
    if shuffled:
        data = list(reversed(data))
    return _Resp(200, {"data": data})


@pytest.fixture(autouse=True)
def _token(monkeypatch):
    monkeypatch.setenv("OVH_AI_ENDPOINTS_TOKEN", "tok-test")
    monkeypatch.setattr(ovh.time, "sleep", lambda _s: None)


def test_returns_one_vector_per_text_in_order(monkeypatch):
    monkeypatch.setattr(ovh.httpx, "post", lambda *a, **k: _ok([[1.0], [2.0], [3.0]]))

    assert ovh.embed(["a", "b", "c"]) == [[1.0], [2.0], [3.0]]


def test_respects_the_index_field_not_arrival_order(monkeypatch):
    """OVH garantit `index`, pas l'ordre du tableau. Trier dessus est la seule
    façon sûre d'associer un vecteur à son texte."""
    monkeypatch.setattr(ovh.httpx, "post", lambda *a, **k: _ok([[1.0], [2.0]], shuffled=True))

    assert ovh.embed(["a", "b"]) == [[1.0], [2.0]]


def test_splits_into_batches_and_concatenates_in_order(monkeypatch):
    monkeypatch.setattr(ovh, "EMBED_BATCH_SIZE", 2)
    seen: list[list[str]] = []

    def fake_post(url, **kwargs):
        texts = kwargs["json"]["input"]
        seen.append(list(texts))
        return _ok([[float(len(t))] for t in texts])

    monkeypatch.setattr(ovh.httpx, "post", fake_post)

    assert ovh.embed(["a", "bb", "ccc"]) == [[1.0], [2.0], [3.0]]
    assert seen == [["a", "bb"], ["ccc"]]


def test_sends_bearer_token(monkeypatch):
    captured = {}

    def fake_post(url, **kwargs):
        captured.update(kwargs["headers"])
        return _ok([[1.0]])

    monkeypatch.setattr(ovh.httpx, "post", fake_post)
    ovh.embed(["a"])

    assert captured["Authorization"] == "Bearer tok-test"


def test_retries_on_rate_limit_then_succeeds(monkeypatch):
    """400 req/min : une ingestion complète HEURTERA la limite. Sans reprise,
    elle s'arrête au milieu et laisse un index partiel."""
    calls = {"n": 0}

    def fake_post(url, **kwargs):
        calls["n"] += 1
        return _Resp(429) if calls["n"] == 1 else _ok([[7.0]])

    monkeypatch.setattr(ovh.httpx, "post", fake_post)

    assert ovh.embed(["a"]) == [[7.0]]
    assert calls["n"] == 2


def test_retries_on_a_dropped_connection(monkeypatch):
    """Une coupure réseau lève AVANT qu'un code HTTP existe.

    Le retry sur les codes retryables ne la voyait donc jamais : l'ingestion
    complète du corpus s'est arrêtée là, à la 52e source sur 78, en laissant un
    index à moitié rempli."""
    calls = {"n": 0}

    def fake_post(url, **kwargs):
        calls["n"] += 1
        if calls["n"] < 3:
            raise ovh.httpx.ConnectError("[Errno 101] Network is unreachable")
        return _ok([[5.0]])

    monkeypatch.setattr(ovh.httpx, "post", fake_post)

    assert ovh.embed(["a"]) == [[5.0]]
    assert calls["n"] == 3


def test_a_persistent_network_failure_still_raises(monkeypatch):
    """Réessayer n'est pas ignorer : au bout des tentatives, ça doit échouer."""

    def fake_post(url, **kwargs):
        raise ovh.httpx.ConnectError("[Errno 101] Network is unreachable")

    monkeypatch.setattr(ovh.httpx, "post", fake_post)

    with pytest.raises(RuntimeError, match="unreachable"):
        ovh.embed(["a"])


def test_raises_when_response_length_mismatches(monkeypatch):
    """Un vecteur manquant décalerait TOUS les suivants : mieux vaut échouer."""
    monkeypatch.setattr(ovh.httpx, "post", lambda *a, **k: _ok([[1.0]]))

    with pytest.raises(RuntimeError, match="attendus"):
        ovh.embed(["a", "b"])


def test_instruction_prefixes_queries_only(monkeypatch):
    sent: list[str] = []

    def fake_post(url, **kwargs):
        sent.extend(kwargs["json"]["input"])
        return _ok([[1.0]] * len(kwargs["json"]["input"]))

    monkeypatch.setattr(ovh.httpx, "post", fake_post)

    ovh.embed(["chunk de cours"])
    ovh.embed(["ma question"], instruction="Trouve le passage pertinent")

    assert sent[0] == "chunk de cours"
    assert sent[1] == "Instruct: Trouve le passage pertinent\nQuery:ma question"


def test_missing_token_raises(monkeypatch):
    monkeypatch.delenv("OVH_AI_ENDPOINTS_TOKEN", raising=False)

    with pytest.raises(RuntimeError, match="OVH_AI_ENDPOINTS_TOKEN"):
        ovh.embed(["a"])


def test_empty_input_makes_no_call(monkeypatch):
    monkeypatch.setattr(ovh.httpx, "post", lambda *a, **k: pytest.fail("aucun appel attendu"))

    assert ovh.embed([]) == []


# ── MRL : dimension réduite côté serveur ─────────────────────────────────────


def test_sends_the_dimensions_parameter_when_configured(monkeypatch):
    """Qwen3-Embedding est Matryoshka : OVH tronque ET renormalise côté serveur
    (vérifié — écart de 0,0013 avec le préfixe renormé, 0,085 avec le préfixe
    brut). Tronquer nous-mêmes referait mal ce qu'ils font bien."""
    captured = {}

    def fake_post(url, **kwargs):
        captured.update(kwargs["json"])
        return _ok([[0.1] * 1024])

    monkeypatch.setattr(ovh, "DEFAULT_DIMENSIONS", 1024)
    monkeypatch.setattr(ovh.httpx, "post", fake_post)
    ovh.embed(["a"])

    assert captured["dimensions"] == 1024


def test_omits_dimensions_when_not_configured(monkeypatch):
    """Un `dimensions` envoyé à un modèle non-Matryoshka est rejeté : on ne
    l'envoie que s'il est explicitement demandé."""
    captured = {}

    def fake_post(url, **kwargs):
        captured.update(kwargs["json"])
        return _ok([[0.1]])

    monkeypatch.setattr(ovh, "DEFAULT_DIMENSIONS", None)
    monkeypatch.setattr(ovh.httpx, "post", fake_post)
    ovh.embed(["a"])

    assert "dimensions" not in captured


def test_rejects_a_dimension_outside_the_documented_range(monkeypatch):
    """OVH borne à [32, 4096] et renvoie 400. Échouer ici évite un aller-retour
    réseau et donne un message qui nomme la contrainte."""
    monkeypatch.setattr(ovh, "DEFAULT_DIMENSIONS", 5000)
    monkeypatch.setattr(ovh.httpx, "post", lambda *a, **k: pytest.fail("aucun appel attendu"))

    with pytest.raises(ValueError, match="32.*4096"):
        ovh.embed(["a"])
