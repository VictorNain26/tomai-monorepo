"""
Instrumentation — répond à 5 questions, et rien d'autre.

Q1 le service répond-il et échoue-t-il ?
Q2 le temps part-il en attente du lock ou en inférence ?
Q3 combien de requêtes arrivent en même temps ?
Q4 quand ça casse, pourquoi ?
Q5 quel modèle tourne réellement ?

Contrainte de périmètre (ADR 0002) : aucune identité utilisateur ne peut
légitimement atteindre ce service, donc il n'y a rien à masquer — mais le
**texte embeddé** ne doit jamais être attaché à un signal. Longueurs, comptes,
durées et types d'erreur uniquement. Le test
`test_record_never_contains_the_embedded_text` garde cette porte.
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import Any

import anyio

from .config import ENVIRONMENT

SENTRY_DSN = os.getenv("SENTRY_DSN", "")

_sentry_started = False
_logger = logging.getLogger("ai_service")


# ── Enregistrement structuré ─────────────────────────────────────────────────


def setup_logging() -> None:
    """Attache un handler stdout au logger applicatif.

    Sans ça, un logger applicatif en INFO ne propage vers aucun handler :
    uvicorn n'appelle pas `basicConfig`, donc l'enregistrement serait construit,
    sérialisé, puis jeté. Idempotent — le lifespan peut être rejoué (tests).
    """
    if _logger.handlers:
        return
    handler = logging.StreamHandler(sys.stdout)
    # La ligne EST déjà du JSON : pas de préfixe, sinon elle cesse d'être
    # analysable par le script de charge de la phase A2.
    handler.setFormatter(logging.Formatter("%(message)s"))
    _logger.addHandler(handler)
    _logger.setLevel(logging.INFO)
    # Les enregistrements ne remontent pas au root : pas de doublon si uvicorn
    # configure le root de son côté.
    _logger.propagate = False


def emit_record(record: dict[str, Any]) -> None:
    """Émet un enregistrement structuré sur une ligne, lisible par un humain
    comme par un script de charge (phase A2 du plan)."""
    _logger.info(json.dumps(record, default=str, ensure_ascii=False))


# ── Q2 — séparer l'attente du lock du temps d'inférence ──────────────────────


@dataclass
class Timings:
    """Deux durées distinctes, jamais confondues : c'est tout l'intérêt.

    Un total seul ne permet pas de choisir entre « il faut plus de débit »
    (attente) et « il faut plus de CPU » (inférence).
    """

    wait_ms: float = field(default=0.0)
    body_ms: float = field(default=0.0)


@asynccontextmanager
async def measured_lock(lock: anyio.Lock) -> AsyncIterator[Timings]:
    """Acquiert le lock en mesurant séparément l'attente et le corps.

    Les durées sont écrites sur l'objet cédé, donc lisibles après la sortie du
    bloc — y compris quand le corps a levé une exception.
    """
    timings = Timings()
    requested_at = time.perf_counter()
    await lock.acquire()
    acquired_at = time.perf_counter()
    timings.wait_ms = (acquired_at - requested_at) * 1000
    try:
        yield timings
    finally:
        timings.body_ms = (time.perf_counter() - acquired_at) * 1000
        lock.release()


# ── Q4 — remontée d'erreur ───────────────────────────────────────────────────


def setup_sentry() -> bool:
    """Initialise Sentry si un DSN est configuré. Retourne True si initialisé.

    Sans DSN (dev, CI), aucun effet de bord : pas d'init, pas de réseau.
    """
    global _sentry_started
    if not SENTRY_DSN or _sentry_started:
        return False

    import sentry_sdk

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=ENVIRONMENT,
        # Le service ne reçoit jamais d'identité utilisateur (ADR 0002) et le
        # texte embeddé ne doit pas voyager : on ne collecte rien par défaut.
        send_default_pii=False,
        # Les durées vivent dans les enregistrements structurés, pas dans des
        # transactions Sentry — pas de double instrumentation du chemin chaud.
        traces_sample_rate=0.0,
    )
    _sentry_started = True
    return True
