# ============================================================
# tomai-ai-service — Dockerfile (2026)
# Multi-stage: builder + runtime slim
# Runtime: Python 3.12-slim
# Models: BGE-M3 (~2.4 GB) + bge-reranker-v2-m3 (~1.1 GB)
# Target: Koyeb eco-large (4 GB RAM, CPU)
# ============================================================

# Stage 1: Builder (uv install des deps)
FROM python:3.12-slim AS builder

WORKDIR /build

# uv = installer mature, plus rapide que pip
RUN pip install --no-cache-dir uv

COPY pyproject.toml ./
RUN uv pip install --system --no-cache-dir \
    fastapi>=0.115 \
    "uvicorn[standard]>=0.32" \
    pydantic>=2.9 \
    FlagEmbedding>=1.3 \
    sentence-transformers>=3.0 \
    torch>=2.5 \
    numpy>=1.26

# Stage 2: Runtime
FROM python:3.12-slim AS runtime

WORKDIR /app

# Copie les site-packages du builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin/uvicorn /usr/local/bin/uvicorn

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
# start-period long car le boot précharge les 2 modèles (~3.5 GB → 30-60s)
HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
