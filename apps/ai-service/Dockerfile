# ============================================================
# tomai-ai-service — Dockerfile (2026)
# Multi-stage: builder + runtime slim
# Runtime: Python 3.12-slim
# Models: BGE-M3 (~2.4 GB), downloaded at first boot into HF_HOME
# Target: Koyeb eco-large (4 GB RAM, CPU)
# ============================================================

# Stage 1: Builder (uv install des deps in isolated venv)
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

WORKDIR /build

# Create isolated venv
ENV VIRTUAL_ENV=/opt/venv
ENV UV_PROJECT_ENVIRONMENT=/opt/venv
RUN uv venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Install deps : torch CPU via [tool.uv.sources] + déterministe via uv.lock.
# --no-install-project : seules les deps (le code src/ est copié au stage runtime).
# --no-dev : exclut le dependency-group dev (ruff/pytest/httpx).
COPY pyproject.toml uv.lock README.md ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

# Stage 2: Runtime
FROM python:3.12-slim AS runtime

WORKDIR /app

# Copy isolated venv from builder
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
COPY --from=builder /opt/venv /opt/venv

# HF cache persistant si volume monté, sinon /tmp
ENV HF_HOME=/data/hf_cache
ENV TRANSFORMERS_OFFLINE=0

# Code applicatif
COPY src/ ./src/

# Non-root user
RUN groupadd --gid 1001 ai && \
    useradd --uid 1001 --gid ai --shell /bin/bash --create-home ai && \
    mkdir -p /data/hf_cache && \
    chown -R ai:ai /app /data
USER ai

EXPOSE 8000

# Healthcheck — Koyeb appellera GET /health
# start-period long car le boot précharge le modèle BGE-M3 (~2.4 GB → 30-60s)
HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
