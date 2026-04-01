"""
<<<<<<< HEAD
Redis worker — BLPOP consumer for ai:recognition:queue.

Job lifecycle:
  1. BLPOP ai:recognition:queue (blocking, 2 s timeout to allow graceful shutdown)
  2. Deserialize JSON → AIJob (Pydantic)
  3. Delegate to FaceService.process_frame() via asyncio.wait_for (3 s SLA)
  4. Publish AIResult to ai:recognition:result:{job_id} via SETEX (TTL 60 s)
  5. frame_base64 is NEVER included in the result — LGPD compliance

Credentials (REDIS_URL) come exclusively from environment variables.
=======
VULTRA AI Service — Redis Worker (EmbeddingWorker)

Consumes jobs from `ai:recognition:queue` via BLPOP and publishes results
to `ai:recognition:result:{job_id}` via SETEX.

Loop invariant:
  - Frame bytes NEVER touch disk (LGPD)
  - Result is published even on error (error field populated)
  - Worker failure does not crash the FastAPI process — errors are logged
>>>>>>> 3e716ea (fix: ensure all dependencies and imports are correct for both api-core and ai-service (pyproject, package.json, venv, type imports, and all code))
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
<<<<<<< HEAD
from typing import TYPE_CHECKING
=======
>>>>>>> 3e716ea (fix: ensure all dependencies and imports are correct for both api-core and ai-service (pyproject, package.json, venv, type imports, and all code))

from config import Settings
from schemas.job_schemas import AIJob, AIResult
from services.face_service import FaceService, FaceServiceError

<<<<<<< HEAD
if TYPE_CHECKING:
    from redis.asyncio import Redis as AsyncRedis

=======
>>>>>>> 3e716ea (fix: ensure all dependencies and imports are correct for both api-core and ai-service (pyproject, package.json, venv, type imports, and all code))
logger = logging.getLogger(__name__)


class RedisWorker:
<<<<<<< HEAD
    def __init__(
        self,
        redis: "AsyncRedis",
        face_service: FaceService,
        settings: Settings,

    """
    VULTRA AI Service — Redis Worker (EmbeddingWorker)

    Consome jobs da fila `ai:recognition:queue` via BLPOP e publica resultados
    em `ai:recognition:result:{job_id}` via SETEX.

    Invariantes:
        - Frame NUNCA toca disco (LGPD)
        - Resultado é publicado mesmo em erro (campo error preenchido)
        - Falha do worker não derruba o FastAPI — apenas loga erro
    """
    from __future__ import annotations

    import asyncio
    import json
    import logging
    import time

    from config import Settings
    from schemas.job_schemas import AIJob, AIResult
    from services.face_service import FaceService, FaceServiceError

    logger = logging.getLogger(__name__)

    class RedisWorker:
            def __init__(self, redis, face_service: FaceService, settings: Settings) -> None:
                    self._redis = redis
                    self._face = face_service
                    self._settings = settings
                    self._task: asyncio.Task | None = None
                    self._running = False
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
<<<<<<< HEAD
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
=======
        logger.info("RedisWorker stopped.")

    # ── Main loop ────────────────────────────────────────────────────────────

    async def _loop(self) -> None:
        """
        BLPOP with 5s timeout avoids busy-looping while still responding to
        stop() within a reasonable time.
        """
        while self._running:
            try:
                item = await self._redis.blpop(self._settings.ai_queue_name, timeout=5)
                if item is None:
                    continue  # timeout — check _running and loop

                _, raw = item  # (queue_name, payload_bytes)
                await self._handle(raw)

            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.exception("RedisWorker loop error (will retry): %s", exc)
                await asyncio.sleep(1)  # brief backoff before next iteration

    async def _handle(self, raw: bytes | str) -> None:
        """Parse, process and publish result for one job."""
        start = time.monotonic()

        try:
            job = AIJob.model_validate_json(raw if isinstance(raw, str) else raw.decode())
        except Exception as exc:
            logger.error("Failed to parse job payload: %s | raw=%r", exc, raw[:200])
            return  # unparseable job — discard silently, nothing to publish to

        result: AIResult

        try:
            # Enforce per-job timeout (job_timeout_s)
            proc = await asyncio.wait_for(
>>>>>>> 3e716ea (fix: ensure all dependencies and imports are correct for both api-core and ai-service (pyproject, package.json, venv, type imports, and all code))
                self._face.process_frame(job.frame_base64),
                timeout=self._settings.job_timeout_s,
            )
            result = AIResult(
                job_id=job.job_id,
<<<<<<< HEAD
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
=======
                embedding=proc["embedding"],
                quality_score=proc["quality_score"],
                processing_ms=proc["processing_ms"],
            )

        except asyncio.TimeoutError:
            logger.warning("Job %s timed out after %.1fs", job.job_id, self._settings.job_timeout_s)
            result = AIResult(
                job_id=job.job_id,
                processing_ms=int((time.monotonic() - start) * 1000),
                error="PROCESSING_TIMEOUT",
            )

        except FaceServiceError as exc:
            logger.info("Job %s FaceServiceError: %s", job.job_id, exc.error_code)
            result = AIResult(
                job_id=job.job_id,
                processing_ms=int((time.monotonic() - start) * 1000),
                error=exc.error_code,
            )

        except Exception as exc:
            logger.exception("Job %s internal error: %s", job.job_id, exc)
            result = AIResult(
                job_id=job.job_id,
                processing_ms=int((time.monotonic() - start) * 1000),
                error="INTERNAL_ERROR",
            )

        finally:
            # Always ensure frame bytes are released from job object (LGPD)
            del job

        result_key = f"{self._settings.ai_result_prefix}{result.job_id}"
        await self._redis.setex(result_key, self._settings.result_ttl_s, result.model_dump_json())
        logger.debug("Job %s published to %s", result.job_id, result_key)
>>>>>>> 3e716ea (fix: ensure all dependencies and imports are correct for both api-core and ai-service (pyproject, package.json, venv, type imports, and all code))
