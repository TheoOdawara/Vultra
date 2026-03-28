"""
Redis worker — BLPOP consumer for ai:recognition:queue.

Job lifecycle:
  1. BLPOP ai:recognition:queue (blocking, 2 s timeout to allow graceful shutdown)
  2. Deserialize JSON → AIJob (Pydantic)
  3. Delegate to FaceService.process_frame() via asyncio.wait_for (3 s SLA)
  4. Publish AIResult to ai:recognition:result:{job_id} via SETEX (TTL 60 s)
  5. frame_base64 is NEVER included in the result — LGPD compliance

Credentials (REDIS_URL) come exclusively from environment variables.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import TYPE_CHECKING

from config import Settings
from schemas.job_schemas import AIJob, AIResult
from services.face_service import FaceService, FaceServiceError

if TYPE_CHECKING:
    from redis.asyncio import Redis as AsyncRedis

logger = logging.getLogger(__name__)


class RedisWorker:
    def __init__(
        self,
        redis: "AsyncRedis",
        face_service: FaceService,
        settings: Settings,
    ) -> None:
        self._redis = redis
        self._face = face_service
        self._settings = settings
        self._running = False
        self._task: asyncio.Task | None = None

    # ── Lifecycle ────────────────────────────────────────────────────────────

    async def start(self) -> None:
        self._running = True
        self._task = asyncio.create_task(self._consume_loop(), name="redis-worker")
        logger.info(
            "Redis worker started — consuming '%s'", self._settings.ai_queue_name
        )

    async def stop(self) -> None:
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Redis worker stopped.")

    # ── Consumer loop ────────────────────────────────────────────────────────

    async def _consume_loop(self) -> None:
        while self._running:
            try:
                # BLPOP with 2 s timeout — re-checks _running flag on each iteration
                raw = await self._redis.blpop(self._settings.ai_queue_name, timeout=2)
                if raw is None:
                    continue
                _, payload = raw
                await self._handle_job(payload)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.error("Worker loop error: %s", exc, exc_info=True)
                await asyncio.sleep(0.5)  # brief back-off on unexpected errors

    # ── Job handler ──────────────────────────────────────────────────────────

    async def _handle_job(self, payload: bytes) -> None:
        start = time.monotonic()

        # Parse job payload
        try:
            job_data = json.loads(payload)
            job = AIJob(**job_data)
        except Exception as exc:
            logger.warning("Invalid job payload — discarding: %s", exc)
            return

        result_key = f"{self._settings.ai_result_prefix}{job.job_id}"

        try:
            outcome = await asyncio.wait_for(
                self._face.process_frame(job.frame_base64),
                timeout=self._settings.job_timeout_s,
            )
            result = AIResult(
                job_id=job.job_id,
                embedding=outcome["embedding"],
                quality_score=outcome["quality_score"],
                processing_ms=outcome["processing_ms"],
            )
        except asyncio.TimeoutError:
            result = AIResult(job_id=job.job_id, error="PROCESSING_TIMEOUT")
        except FaceServiceError as exc:
            result = AIResult(job_id=job.job_id, error=exc.error_code)
        except Exception as exc:
            logger.error(
                "Unexpected error processing job %s: %s", job.job_id, exc, exc_info=True
            )
            result = AIResult(job_id=job.job_id, error="INTERNAL_ERROR")

        # Publish result — frame_base64 is NEVER included (LGPD)
        result_json = result.model_dump_json(exclude_none=False)
        await self._redis.setex(result_key, self._settings.result_ttl_s, result_json)

        elapsed_ms = int((time.monotonic() - start) * 1000)
        logger.info(
            "Job %s completed in %d ms | error=%s",
            job.job_id,
            elapsed_ms,
            result.error or "none",
        )
