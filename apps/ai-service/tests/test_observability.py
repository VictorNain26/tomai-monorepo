"""
Tests de l'instrumentation — phase A1 du plan de consolidation.

Chaque test est rattaché à une des 5 questions que l'observabilité doit rendre
répondables (cf. docs/superpowers/plans/2026-08-21-ai-service-consolidation.md).
Un test qui ne l'est pas ne devrait pas exister ici.

Q1 le service répond-il et échoue-t-il ?
Q2 le temps part-il en attente du lock ou en inférence ?   <- le discriminant de A3
Q3 combien de requêtes arrivent en même temps ?
Q4 quand ça casse, pourquoi ?
Q5 quel modèle tourne réellement ?

Garde-fou de périmètre (ADR 0002) : le texte embeddé ne doit apparaître dans
aucun signal.
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from unittest.mock import patch

import anyio
import pytest
from fastapi.testclient import TestClient

from src.schemas import EmbedItem, SparseVector

SLOW_INFERENCE_S = 0.1


def _fake_embed(texts: list[str]) -> list[EmbedItem]:
    return [
        EmbedItem(
            dense=[0.1] * 1024,
            sparse=SparseVector(indices=[1, 2, 3], values=[0.5, 0.3, 0.2]),
        )
        for _ in texts
    ]


@pytest.fixture
def records() -> Iterator[list[dict]]:
    """Capture les enregistrements émis par l'instrumentation."""
    captured: list[dict] = []
    with patch("src.main.emit_record", side_effect=captured.append):
        yield captured


@pytest.fixture
def client() -> Iterator[TestClient]:
    with (
        patch("src.embed.load_model"),
        patch("src.embed.is_loaded", return_value=True),
        patch("src.main.embed_encode", side_effect=_fake_embed),
    ):
        from src.main import app

        with TestClient(app) as test_client:
            yield test_client


# ── Q1 — le service répond-il, et échoue-t-il ? ──────────────────────────────


def test_embed_emits_one_structured_record(client: TestClient, records: list[dict]) -> None:
    """Q1 — chaque appel /embed produit exactement un enregistrement exploitable."""
    resp = client.post("/embed", json={"texts": ["alpha", "beta"]})

    assert resp.status_code == 200
    assert len(records) == 1
    record = records[0]
    assert record["event"] == "embed"
    assert record["status"] == "ok"
    assert record["texts"] == 2
    assert record["chars"] == len("alpha") + len("beta")
    assert record["duration_ms"] >= 0


# ── Garde-fou de périmètre — jamais le texte ─────────────────────────────────


def test_record_never_contains_the_embedded_text(client: TestClient, records: list[dict]) -> None:
    """ADR 0002 — aucune trace du contenu embeddé dans un signal, à aucun niveau.

    Le texte est distinctif pour qu'une fuite ne puisse pas passer inaperçue.
    """
    secret = "Marie a 14 ans et redouble sa quatrieme"

    client.post("/embed", json={"texts": [secret]})

    assert len(records) == 1
    serialized = json.dumps(records[0], default=str)
    assert secret not in serialized
    for word in ("Marie", "redouble", "quatrieme"):
        assert word not in serialized


def test_record_never_contains_the_text_on_failure(client: TestClient, records: list[dict]) -> None:
    """Le chemin d'erreur est celui qui fuit d'habitude : il fait remonter l'entrée."""
    secret = "Marie a 14 ans et redouble sa quatrieme"

    with patch("src.main.embed_encode", side_effect=RuntimeError(f"boom on {secret}")):
        client.post("/embed", json={"texts": [secret]})

    assert len(records) == 1
    assert secret not in json.dumps(records[0], default=str)


# ── Q2 — attente du lock vs inférence (le discriminant de A3) ────────────────


def test_measured_lock_reports_no_wait_when_uncontended() -> None:
    """Q2 — sans contention, l'attente est nulle et le corps est mesuré."""
    from src.instrumentation import measured_lock

    async def scenario() -> tuple[float, float]:
        lock = anyio.Lock()
        async with measured_lock(lock) as timings:
            await anyio.sleep(SLOW_INFERENCE_S)
        return timings.wait_ms, timings.body_ms

    wait_ms, body_ms = anyio.run(scenario)

    assert wait_ms < SLOW_INFERENCE_S * 1000 / 2
    assert body_ms >= SLOW_INFERENCE_S * 1000 * 0.8


def test_measured_lock_attributes_queueing_to_wait_not_to_inference() -> None:
    """Q2 — LE test du lot.

    Deux appels concurrents sur le même lock : le second doit voir son attente
    ≈ la durée d'inférence du premier, et sa propre inférence rester courte.
    Si l'instrumentation confondait les deux, ce test passerait avec un
    `body_ms` gonflé et un `wait_ms` nul — et A3 déciderait sur un faux signal.
    """
    from src.instrumentation import measured_lock

    async def scenario() -> list[tuple[float, float]]:
        lock = anyio.Lock()
        results: list[tuple[float, float]] = []

        async def worker() -> None:
            async with measured_lock(lock) as timings:
                await anyio.sleep(SLOW_INFERENCE_S)
            results.append((timings.wait_ms, timings.body_ms))

        async with anyio.create_task_group() as tg:
            tg.start_soon(worker)
            await anyio.sleep(0.01)  # garantit l'ordre d'arrivée
            tg.start_soon(worker)

        return results

    results = anyio.run(scenario)

    assert len(results) == 2
    first_wait, first_body = results[0]
    second_wait, second_body = results[1]

    # Le premier n'attend pas, le second attend que le premier ait fini.
    assert first_wait < SLOW_INFERENCE_S * 1000 / 2
    assert second_wait >= SLOW_INFERENCE_S * 1000 * 0.7
    # L'inférence de chacun reste celle de son propre travail.
    assert first_body >= SLOW_INFERENCE_S * 1000 * 0.8
    assert second_body < SLOW_INFERENCE_S * 1000 * 1.6


def test_embed_record_separates_lock_wait_from_inference(
    client: TestClient, records: list[dict]
) -> None:
    """Q2 — l'endpoint publie bien les deux durées, pas seulement le total."""
    client.post("/embed", json={"texts": ["alpha"]})

    record = records[0]
    assert "lock_wait_ms" in record
    assert "inference_ms" in record
    assert record["lock_wait_ms"] >= 0
    assert record["inference_ms"] >= 0
    assert record["duration_ms"] >= record["inference_ms"]


# ── Q3 — concurrence réellement observée ─────────────────────────────────────


def test_embed_record_reports_inflight_count(client: TestClient, records: list[dict]) -> None:
    """Q3 — une requête seule voit une concurrence de 1, jamais 0."""
    client.post("/embed", json={"texts": ["alpha"]})

    assert records[0]["inflight"] >= 1


# ── Q4 — quand ça casse, pourquoi ────────────────────────────────────────────


def test_embed_failure_emits_error_record(client: TestClient, records: list[dict]) -> None:
    """Q4 — un échec d'inférence est observable, typé, et n'est pas silencieux."""
    with patch("src.main.embed_encode", side_effect=RuntimeError("model exploded")):
        resp = client.post("/embed", json={"texts": ["alpha"]})

    assert resp.status_code == 500
    assert len(records) == 1
    record = records[0]
    assert record["status"] == "error"
    assert record["error_type"] == "RuntimeError"


def test_sentry_is_not_initialised_without_dsn() -> None:
    """Q4 — pas de DSN (dev, CI) = pas d'init. Aucun effet de bord silencieux."""
    from src.instrumentation import setup_sentry

    with patch("src.instrumentation.SENTRY_DSN", ""):
        assert setup_sentry() is False


def test_sentry_is_initialised_with_dsn() -> None:
    """Q4 — DSN présent = init effectuée, une seule fois."""
    from src import instrumentation

    with (
        patch.object(instrumentation, "SENTRY_DSN", "https://key@example.ingest.de.sentry.io/1"),
        patch.object(instrumentation, "_sentry_started", False),
        patch("sentry_sdk.init") as sentry_init,
    ):
        assert instrumentation.setup_sentry() is True
        assert sentry_init.call_count == 1


# ── Q5 — quel modèle tourne réellement ───────────────────────────────────────


def test_embed_record_reports_model_identity(client: TestClient, records: list[dict]) -> None:
    """Q5 — sans l'identité du modèle dans le signal, A4 ne peut rien vérifier."""
    from src.config import EMBED_MODEL

    client.post("/embed", json={"texts": ["alpha"]})

    assert records[0]["model"] == EMBED_MODEL


def test_health_reports_model_precision(client: TestClient) -> None:
    """Q5 — la probe doit dire en quelle précision tourne l'instance déployée."""
    data = client.get("/health").json()

    assert data["embed_model"] == "BAAI/bge-m3"
    assert data["use_fp16"] is False


def test_lifespan_initialises_sentry() -> None:
    """Q4 — sans appel au boot, l'intégration est du code mort en production."""
    with (
        patch("src.embed.load_model"),
        patch("src.embed.is_loaded", return_value=True),
        patch("src.main.setup_sentry") as setup,
    ):
        from src.main import app

        with TestClient(app):
            pass

    assert setup.call_count == 1


def test_emitted_record_actually_reaches_the_log_stream(capsys: pytest.CaptureFixture) -> None:
    """Un enregistrement que personne ne voit ne vaut rien.

    Sans configuration, un logger applicatif en INFO ne propage vers aucun
    handler : uvicorn n'appelle pas basicConfig. Le record serait construit,
    sérialisé, puis silencieusement jeté — et A2 lirait un fichier vide.
    """
    import logging

    from src.instrumentation import emit_record, setup_logging

    # Un handler posé par un test précédent est lié à l'ancien stdout : capsys
    # ne le verrait pas. On repart d'un logger vierge pour que ce test dise
    # quelque chose sur le code et non sur l'ordre d'exécution de la suite.
    logger = logging.getLogger("ai_service")
    logger.handlers.clear()
    try:
        setup_logging()
        emit_record({"event": "embed", "status": "ok", "duration_ms": 1.5})
    finally:
        logger.handlers.clear()

    written = capsys.readouterr()
    payload = json.loads((written.out + written.err).strip().splitlines()[-1])
    assert payload["event"] == "embed"
    assert payload["duration_ms"] == 1.5
