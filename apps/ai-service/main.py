"""
<<<<<<< HEAD
Vultra AI Service — FastAPI application entry point.

Endpoints:
  POST /process-image  — synchronous HTTP handler (PoC / local camera path)
  GET  /health         — liveness probe

Lifespan (startup / shutdown):
  - Loads InsightFace models into RAM (warm-up)
  - Starts Redis BLPOP worker (production path)
  - On shutdown: stops worker and closes Redis connection gracefully

"""
VULTRA AI Service — FastAPI application entry point.

Startup sequence (lifespan):
    1. Load InsightFace model into RAM (FaceService.load_models)
    2. Connect to Redis
    3. Start RedisWorker asyncio task (BLPOP consumer)

Shutdown sequence (lifespan teardown):
    1. Stop RedisWorker gracefully
    2. Close Redis connection

HTTP endpoints (PoC / health only):
    GET  /health        → service health + circuit breaker state
    POST /process-image → synchronous HTTP path (PoC / ADR-005)

Production recognition path: Redis queue (RedisWorker), not HTTP.
"""
from __future__ import annotations

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request, Response
import time
from contextlib import asynccontextmanager
<<<<<<< HEAD
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException, Request
=======
from typing import Any

from fastapi import FastAPI, Request, Response
>>>>>>> 3e716ea (fix: ensure all dependencies and imports are correct for both api-core and ai-service (pyproject, package.json, venv, type imports, and all code))
from fastapi.responses import JSONResponse
from redis.asyncio import from_url as redis_from_url

from config import get_settings
<<<<<<< HEAD
from schemas.http_schemas import (
    HealthResponse,
    ProcessImageRequest,
    ProcessImageResponse,
)
=======
from schemas.http_schemas import HealthResponse, ProcessImageRequest, ProcessImageResponse
>>>>>>> 3e716ea (fix: ensure all dependencies and imports are correct for both api-core and ai-service (pyproject, package.json, venv, type imports, and all code))
from services.face_service import FaceService, FaceServiceError
from workers.redis_worker import RedisWorker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

<<<<<<< HEAD
settings = get_settings()
_startup_time = time.monotonic()
=======
# ── Module-level singletons (replaced by mocks in tests) ─────────────────────
_face_service: FaceService | None = None
_worker: RedisWorker | None = None
_redis: Any = None
_start_time: float = 0.0
>>>>>>> 3e716ea (fix: ensure all dependencies and imports are correct for both api-core and ai-service (pyproject, package.json, venv, type imports, and all code))


# ── Lifespan ─────────────────────────────────────────────────────────────────

<<<<<<< HEAD

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    # ── Startup ──────────────────────────────────────────────────────────────
    face_service = FaceService(settings)
    face_service.load_models()

    redis = redis_from_url(settings.redis_url, decode_responses=False)

    worker = RedisWorker(redis, face_service, settings)
    await worker.start()

    app.state.face_service = face_service
    app.state.redis = redis
    app.state.worker = worker

    yield

    # ── Shutdown ──────────────────────────────────────────────────────────────
    await worker.stop()
    await redis.aclose()
    logger.info("AI Service shutdown complete.")


# ── App factory ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="Vultra AI Service",
    version="1.0.0",
    lifespan=lifespan,
    # Disable API docs in production — never expose internal schemas publicly
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    openapi_url="/openapi.json" if settings.debug else None,
)


# ── Middleware ────────────────────────────────────────────────────────────────


@app.middleware("http")
async def enforce_payload_limit(request: Request, call_next):
    """
    Reject requests whose Content-Length exceeds max_payload_bytes before
    reading the body. This is an early guard against large-payload DoS attacks.
    """
    content_length = request.headers.get("content-length")
    if content_length is not None and int(content_length) > settings.max_payload_bytes:
=======
@asynccontextmanager
async def lifespan(app: FastAPI):
    global _face_service, _worker, _redis, _start_time

    settings = get_settings()
    _start_time = time.monotonic()

    # 1. Load InsightFace model
    _face_service = FaceService(settings)
    _face_service.load_models()

    # 2. Connect to Redis
    _redis = redis_from_url(settings.redis_url, decode_responses=False)

    # 3. Start worker
    _worker = RedisWorker(_redis, _face_service, settings)
    await _worker.start()

    logger.info("VULTRA AI Service ready.")
    yield

    # Teardown
    if _worker:
        await _worker.stop()
    if _redis:
        await _redis.aclose()
    logger.info("VULTRA AI Service shut down.")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="VULTRA AI Service",
    version="1.0.0",
    docs_url="/docs" if get_settings().debug else None,
    redoc_url=None,
    lifespan=lifespan,
)


# ── Payload size guard (before routing) ───────────────────────────────────────

@app.middleware("http")
async def reject_oversized_payloads(request: Request, call_next):
    settings = get_settings()
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > settings.max_payload_bytes:
>>>>>>> 3e716ea (fix: ensure all dependencies and imports are correct for both api-core and ai-service (pyproject, package.json, venv, type imports, and all code))
        return JSONResponse(
            status_code=413,
            content={
                "error": "PAYLOAD_TOO_LARGE",
                "max_bytes": settings.max_payload_bytes,
            },
        )
    return await call_next(request)


# ── Routes ────────────────────────────────────────────────────────────────────

<<<<<<< HEAD

@app.get("/health", response_model=HealthResponse, tags=["monitoring"])
async def health(request: Request) -> HealthResponse:
    """
    Liveness probe. Returns service status without exposing infrastructure details.
    """
    face_service: FaceService = request.app.state.face_service
    return HealthResponse(
        status="ok" if face_service.is_ready() else "degraded",
        model=face_service.model_name,
        uptime_s=int(time.monotonic() - _startup_time),
=======
@app.get("/health", response_model=HealthResponse, tags=["ops"])
async def health() -> HealthResponse:
    """
    Health check consumed by Docker and the API Core Circuit Breaker.
    Never exposes Redis URL, passwords, or internal configuration.
    """
    svc = _face_service
    uptime = int(time.monotonic() - _start_time)
    status = "ok" if (svc and svc.is_ready()) else "degraded"
    return HealthResponse(
        status=status,
        model=svc.model_name if svc else "unknown",
        uptime_s=uptime,
>>>>>>> 3e716ea (fix: ensure all dependencies and imports are correct for both api-core and ai-service (pyproject, package.json, venv, type imports, and all code))
    )


@app.post(
    "/process-image",
    response_model=ProcessImageResponse,
    tags=["inference"],
<<<<<<< HEAD
    responses={
        413: {"description": "Payload too large"},
        422: {"description": "Face validation failed (structured error code in body)"},
        503: {"description": "Model not ready or processing timeout"},
    },
)
async def process_image(
    body: ProcessImageRequest,
    request: Request,
) -> ProcessImageResponse:
    """
    Synchronous HTTP path (PoC / local camera).

    Pipeline (RAM-only, LGPD compliant):
      base64 → numpy → RetinaFace → quality checks → ArcFace → embedding
    Image is discarded from memory before returning.
    """
    face_service: FaceService = request.app.state.face_service

    if not face_service.is_ready():
        raise HTTPException(
            status_code=503,
            detail={"error": "MODEL_NOT_READY"},
=======
    summary="Synchronous face processing (PoC / ADR-005 HTTP path)",
)
async def process_image(body: ProcessImageRequest) -> ProcessImageResponse:
    """
    Synchronous HTTP path for PoC (ADR-005).
    Production recognition uses the Redis queue (RedisWorker).

    LGPD: frame_base64 is NEVER echoed back or logged.
    """
    svc = _face_service
    settings = get_settings()

    if not svc or not svc.is_ready():
        return JSONResponse(
            status_code=503,
            content={"detail": {"error": "MODEL_NOT_READY"}},
>>>>>>> 3e716ea (fix: ensure all dependencies and imports are correct for both api-core and ai-service (pyproject, package.json, venv, type imports, and all code))
        )

    try:
        result = await asyncio.wait_for(
<<<<<<< HEAD
            face_service.process_frame(body.frame_base64),
            timeout=settings.job_timeout_s,
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=503,
            detail={"error": "PROCESSING_TIMEOUT"},
        )
    except FaceServiceError as exc:
        raise HTTPException(
            status_code=422,
            detail={"error": exc.error_code},
=======
            svc.process_frame(body.frame_base64),
            timeout=settings.job_timeout_s,
        )
    except asyncio.TimeoutError:
        return JSONResponse(
            status_code=503,
            content={"detail": {"error": "PROCESSING_TIMEOUT"}},
        )
    except FaceServiceError as exc:
        return JSONResponse(
            status_code=422,
            content={"detail": {"error": exc.error_code}},
>>>>>>> 3e716ea (fix: ensure all dependencies and imports are correct for both api-core and ai-service (pyproject, package.json, venv, type imports, and all code))
        )

    return ProcessImageResponse(
        embedding=result["embedding"],
        quality_score=result["quality_score"],
        processing_ms=result["processing_ms"],
    )
