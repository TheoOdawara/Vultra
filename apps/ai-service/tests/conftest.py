"""
Shared test fixtures.

Strategy: mock FaceService, Redis, and RedisWorker at the `main` module level
so the FastAPI lifespan uses the mocks instead of real InsightFace / Redis.
This lets tests run without InsightFace or Redis installed.
"""
from __future__ import annotations

import asyncio
import base64
import io
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient


# ── Minimal valid test JPEG (100×100 grey square) ───────────────────────────


def _make_test_jpeg() -> str:
    """Generate a minimal valid JPEG and return it as a base64 string."""
    try:
        from PIL import Image

        img = Image.new("RGB", (100, 100), color=(128, 128, 128))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        return base64.b64encode(buf.getvalue()).decode()
    except ImportError:
        # Fallback: minimal 1×1 white JPEG (hard-coded bytes)
        raw = (
            b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
            b"\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t"
            b"\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a"
            b"\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\x1e"
            b"\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00"
            b"\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00"
            b"\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b"
            b"\xff\xc4\x00\xb5\x10\x00\x02\x01\x03\x03\x02\x04\x03\x05\x05\x04"
            b"\x04\x00\x00\x01}\x01\x02\x03\x00\x04\x11\x05\x12!1A\x06\x13Qa"
            b'\x07"q\x142\x81\x91\xa1\x08#B\xb1\xc1\x15R\xd1\xf0$3br'
            b"\x82\t\n\x16\x17\x18\x19\x1a%&'()*456789:CDEFGHIJ"
            b"STUVWXYZ\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xfb\xf0\x00\x00"
            b"\x00\x1f\xff\xd9"
        )
        return base64.b64encode(raw).decode()


TEST_FRAME_B64 = _make_test_jpeg()
TEST_EMBEDDING = [round((i % 100) / 100.0, 4) for i in range(512)]


# ── Mock factories ────────────────────────────────────────────────────────────


def make_face_service_mock() -> MagicMock:
    mock = MagicMock()
    mock.is_ready.return_value = True
    mock.model_name = "buffalo_l"
    mock.load_models = MagicMock()
    mock.process_frame = AsyncMock(
        return_value={
            "embedding": TEST_EMBEDDING,
            "quality_score": 0.85,
            "processing_ms": 42,
        }
    )
    return mock


def make_redis_mock() -> MagicMock:
    mock = MagicMock()
    mock.aclose = AsyncMock()
    mock.blpop = AsyncMock(return_value=None)
    mock.setex = AsyncMock()
    return mock


def make_worker_mock() -> MagicMock:
    mock = MagicMock()
    mock.start = AsyncMock()
    mock.stop = AsyncMock()
    return mock


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture(scope="session")
def face_service_mock():
    return make_face_service_mock()


@pytest.fixture(scope="session")
def client(face_service_mock):
    """
    TestClient with mocked FaceService, Redis, and RedisWorker.
    Lifespan runs with mocks; no real InsightFace or Redis connection needed.

    NOTE: `patch("main.FaceService", ...)` replaces the name in main's namespace
    directly — no need to invalidate the module cache, which avoids the class
    identity split that would break `except FaceServiceError` in main.py.
    """
    redis_mock = make_redis_mock()
    worker_mock = make_worker_mock()

    from unittest.mock import patch
    import main as _main  # ensure main is imported before patching

    with (
        patch("main.FaceService", return_value=face_service_mock),
        patch("main.redis_from_url", return_value=redis_mock),
        patch("main.RedisWorker", return_value=worker_mock),
    ):
        with TestClient(_main.app) as c:
            yield c
