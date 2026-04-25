"""
Redis worker — BLPOP consumer for ai:recognition:queue.

Job lifecycle:
  1. BLPOP ai:recognition:queue
  2. Deserialize JSON → AIJob
  3. Delegate to FaceService.process_frame() with timeout
  4. Publish AIResult to ai:recognition:result:{job_id}
"""
from __future__ import annotations

import asyncio
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
        self._task: asyncio.Task[None] | None = None
        self._running = False

    async def start(self) -> None:
        if self._task is not None and not self._task.done():
            return
        self._running = True
        self._task = asyncio.create_task(self._consume_loop(), name="redis-worker")
        logger.info("Redis worker started.")

    async def stop(self) -> None:
        self._running = False
        if self._task is None:
            return
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        finally:
            self._task = None
        logger.info("Redis worker stopped.")

    async def _consume_loop(self) -> None:
        while self._running:
            try:
                raw = await self._redis.blpop(self._settings.ai_queue_name, timeout=2)
                if raw is None:
                    continue
                _, payload = raw
                await self._handle_job(payload)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.exception("Worker loop error: %s", exc)
                await asyncio.sleep(0.5)

    async def _handle_job(self, payload: bytes | str) -> None:
        start = time.monotonic()

        try:
            job = AIJob.model_validate_json(payload if isinstance(payload, str) else payload.decode())
        except Exception as exc:
            logger.warning("Invalid job payload discarded: %s", exc)
            return

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
            result = AIResult(
                job_id=job.job_id,
                processing_ms=int((time.monotonic() - start) * 1000),
                error="PROCESSING_TIMEOUT",
            )
        except FaceServiceError as exc:
            result = AIResult(
                job_id=job.job_id,
                processing_ms=int((time.monotonic() - start) * 1000),
                error=exc.error_code,
            )
        except Exception as exc:
            logger.exception("Unexpected error processing job %s: %s", job.job_id, exc)
            result = AIResult(
                job_id=job.job_id,
                processing_ms=int((time.monotonic() - start) * 1000),
                error="INTERNAL_ERROR",
            )

        result_key = f"{self._settings.ai_result_prefix}{result.job_id}"
        await self._redis.setex(result_key, self._settings.result_ttl_s, result.model_dump_json())
        logger.info(
            "Job %s completed in %d ms | error=%s",
            result.job_id,
            int((time.monotonic() - start) * 1000),
            result.error or "none",
        )
