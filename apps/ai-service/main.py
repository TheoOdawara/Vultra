"""
Vultra AI Service — FastAPI application entry point.

Endpoints:
  POST /process-image  — synchronous HTTP handler (PoC / local camera path)
  GET  /health         — liveness probe

Lifespan (startup / shutdown):
  - Loads InsightFace models into RAM (warm-up)
  - Starts Redis BLPOP worker (production path)
  - On shutdown: stops worker and closes Redis connection gracefully

Security:
  - Payload size enforced via Content-Length middleware (max 1 MB)
  - Swagger UI and OpenAPI schema disabled in production (DEBUG=false)
  - No image data is ever logged or persisted
"""
from __future__ import annotations

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from redis.asyncio import from_url as redis_from_url

from config import get_settings
from schemas.http_schemas import (
    HealthResponse,
    ProcessImageRequest,
    ProcessImageResponse,
)
from services.face_service import FaceService, FaceServiceError
from workers.redis_worker import RedisWorker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()
_startup_time = time.monotonic()


# ── Lifespan ─────────────────────────────────────────────────────────────────


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
        return JSONResponse(
            status_code=413,
            content={
                "error": "PAYLOAD_TOO_LARGE",
                "max_bytes": settings.max_payload_bytes,
            },
        )
    return await call_next(request)


# ── Routes ────────────────────────────────────────────────────────────────────


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
    )


@app.post(
    "/process-image",
    response_model=ProcessImageResponse,
    tags=["inference"],
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
        )

    try:
        result = await asyncio.wait_for(
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
        )

    return ProcessImageResponse(
        embedding=result["embedding"],
        quality_score=result["quality_score"],
        processing_ms=result["processing_ms"],
    )
