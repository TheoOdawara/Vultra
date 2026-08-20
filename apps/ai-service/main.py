"""
Vultra AI Service — FastAPI application entry point.

Endpoints:
  POST /process-image  — synchronous HTTP handler (PoC / local camera path)
  GET  /health         — liveness probe
"""
from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import AsyncGenerator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from redis.asyncio import from_url as redis_from_url

from config import get_settings
from schemas.http_schemas import HealthResponse, ProcessImageRequest, ProcessImageResponse
from services.face_service import FaceService, FaceServiceError
from workers.redis_worker import RedisWorker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()
_startup_time = time.monotonic()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    face_service = FaceService(settings)
    face_service.load_models()

    redis = redis_from_url(settings.redis_url, decode_responses=False)
    worker = RedisWorker(redis, face_service, settings)
    await worker.start()

    app.state.face_service = face_service
    app.state.redis = redis
    app.state.worker = worker

    logger.info("Vultra AI Service ready.")
    try:
        yield
    finally:
        await worker.stop()
        await redis.aclose()
        logger.info("AI Service shutdown complete.")


app = FastAPI(
    title="Vultra AI Service",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    openapi_url="/openapi.json" if settings.debug else None,
)


@app.middleware("http")
async def enforce_payload_limit(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
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


@app.get("/health", response_model=HealthResponse, tags=["monitoring"])
async def health(request: Request) -> HealthResponse:
    face_service: FaceService | None = getattr(request.app.state, "face_service", None)
    return HealthResponse(
        status="ok" if face_service and face_service.is_ready() else "degraded",
        model=face_service.model_name if face_service else "unknown",
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
async def process_image(body: ProcessImageRequest, request: Request) -> ProcessImageResponse:
    face_service: FaceService | None = getattr(request.app.state, "face_service", None)

    if not face_service or not face_service.is_ready():
        raise HTTPException(status_code=503, detail={"error": "MODEL_NOT_READY"})

    try:
        result = await asyncio.wait_for(
            face_service.process_frame(body.frame_base64),
            timeout=settings.job_timeout_s,
        )
    except TimeoutError as exc:
        raise HTTPException(status_code=503, detail={"error": "PROCESSING_TIMEOUT"}) from exc
    except FaceServiceError as exc:
        raise HTTPException(status_code=422, detail={"error": exc.error_code}) from exc

    return ProcessImageResponse(
        embedding=result["embedding"],
        quality_score=result["quality_score"],
        processing_ms=result["processing_ms"],
    )
