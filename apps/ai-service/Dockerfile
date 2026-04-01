<<<<<<< HEAD
FROM python:3.11-slim AS builder

WORKDIR /app

# Build deps for insightface (Cython + C extensions) and OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ---------------------------------------------------------------------------

FROM python:3.11-slim

WORKDIR /app

# Runtime libs only (no build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local

# Non-root user for security
RUN useradd -m -u 1001 -s /bin/bash appuser

COPY --chown=appuser:appuser . .

USER appuser

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
=======
# =============================================================================
# VULTRA — AI Service Dockerfile
# Base: python:3.11-slim
# Model pre-downloaded at build time to eliminate cold-start latency.
# =============================================================================

FROM python:3.11-slim AS base

# System dependencies required by OpenCV and InsightFace
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv (fast Python package manager)
RUN pip install --no-cache-dir uv

WORKDIR /app

# ── Dependencies ──────────────────────────────────────────────────────────────

COPY pyproject.toml ./
RUN uv pip install --system --no-cache -e .

# ── Pre-download InsightFace model (buffalo_l) ────────────────────────────────
# This runs at build time so the container starts instantly in production.
# Model is cached at ~/.insightface/models/buffalo_l/
RUN python - <<'EOF'
from insightface.app import FaceAnalysis
app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
app.prepare(ctx_id=0, det_size=(640, 640))
print("Model buffalo_l pre-downloaded successfully.")
EOF

# ── Application code ──────────────────────────────────────────────────────────

COPY . .

# ── Runtime ───────────────────────────────────────────────────────────────────

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
>>>>>>> 3e716ea (fix: ensure all dependencies and imports are correct for both api-core and ai-service (pyproject, package.json, venv, type imports, and all code))
