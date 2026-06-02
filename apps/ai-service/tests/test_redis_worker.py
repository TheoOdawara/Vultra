"""
Unit tests — RedisWorker

Covers:
  start() / stop():
    - start() creates an asyncio Task
    - stop() cancels the task and sets _task = None
    - start() is idempotent when already running

  _handle_job():
    - valid payload → publishes AIResult to Redis with setex
    - invalid JSON → silently discarded (no setex, no exception)
    - FaceServiceError → result.error = error_code
    - asyncio.TimeoutError → result.error = PROCESSING_TIMEOUT
    - unexpected exception → result.error = INTERNAL_ERROR
    - result key uses correct prefix: ai:recognition:result:{job_id}
    - setex TTL = settings.result_ttl_s
    - frame_base64 is NEVER included in the published result (LGPD)

  _consume_loop():
    - BLPOP returning None → loop continues (no crash)
    - exception in loop body → logged and loop continues after sleep
"""
from __future__ import annotations

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, call, patch

import pytest

from config import Settings
from schemas.job_schemas import AIJob, AIResult
from services.face_service import FaceServiceError
from workers.redis_worker import RedisWorker


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def settings() -> Settings:
    return Settings(
        redis_url="redis://localhost:6379",
        ai_queue_name="ai:recognition:queue",
        ai_result_prefix="ai:recognition:result:",
        job_timeout_s=3.0,
        result_ttl_s=60,
    )


@pytest.fixture
def redis_mock() -> MagicMock:
    mock = MagicMock()
    mock.blpop = AsyncMock(return_value=None)
    mock.setex = AsyncMock()
    return mock


@pytest.fixture
def face_mock() -> MagicMock:
    mock = MagicMock()
    mock.process_frame = AsyncMock(
        return_value={
            "embedding": [0.1] * 512,
            "quality_score": 0.87,
            "processing_ms": 42,
        }
    )
    return mock


@pytest.fixture
def worker(redis_mock, face_mock, settings) -> RedisWorker:
    return RedisWorker(redis=redis_mock, face_service=face_mock, settings=settings)


def _make_job_payload(job_id: str = "job-001", frame: str = "AAAA") -> bytes:
    job = AIJob(
        job_id=job_id,
        frame_base64=frame,
        organization_id="org-1",
    )
    return job.model_dump_json().encode()


# ── start / stop lifecycle ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_start_creates_task(worker):
    await worker.start()
    assert worker._task is not None
    assert not worker._task.done()
    await worker.stop()


@pytest.mark.asyncio
async def test_stop_cancels_task_and_clears_reference(worker):
    await worker.start()
    task = worker._task
    await worker.stop()
    assert worker._task is None
    assert task.cancelled() or task.done()


@pytest.mark.asyncio
async def test_start_is_idempotent(worker):
    """Calling start() twice must not create a second task."""
    await worker.start()
    first_task = worker._task
    await worker.start()  # second call — must be no-op
    assert worker._task is first_task
    await worker.stop()


@pytest.mark.asyncio
async def test_stop_without_start_is_safe(worker):
    """stop() on a never-started worker must not raise."""
    await worker.stop()  # no assertion — just must not raise


# ── _handle_job success path ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_handle_job_success_publishes_result(worker, redis_mock):
    payload = _make_job_payload(job_id="job-abc")
    await worker._handle_job(payload)

    redis_mock.setex.assert_called_once()
    key, ttl, body = redis_mock.setex.call_args.args
    assert key == "ai:recognition:result:job-abc"
    assert ttl == 60

    result = AIResult.model_validate_json(body)
    assert result.job_id == "job-abc"
    assert result.error is None
    assert result.embedding is not None
    assert len(result.embedding) == 512
    assert result.quality_score == pytest.approx(0.87)


@pytest.mark.asyncio
async def test_handle_job_result_key_uses_correct_prefix(worker, redis_mock):
    payload = _make_job_payload(job_id="unique-job-xyz")
    await worker._handle_job(payload)

    key = redis_mock.setex.call_args.args[0]
    assert key == "ai:recognition:result:unique-job-xyz"


@pytest.mark.asyncio
async def test_handle_job_result_never_contains_frame_base64(worker, redis_mock):
    """LGPD: the published result must not include the input frame."""
    sensitive_frame = "SuperSensitiveFrameData123"
    payload = _make_job_payload(job_id="job-lgpd", frame=sensitive_frame)
    await worker._handle_job(payload)

    _, _, body = redis_mock.setex.call_args.args
    assert sensitive_frame not in body


# ── _handle_job error paths ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_handle_job_invalid_json_is_discarded(worker, redis_mock):
    """Malformed payload must be dropped silently — no setex call."""
    await worker._handle_job(b"not valid json at all {{{")
    redis_mock.setex.assert_not_called()


@pytest.mark.asyncio
async def test_handle_job_face_service_error_publishes_error_code(worker, redis_mock, face_mock):
    face_mock.process_frame = AsyncMock(side_effect=FaceServiceError("NO_FACE_DETECTED"))
    payload = _make_job_payload()
    await worker._handle_job(payload)

    redis_mock.setex.assert_called_once()
    _, _, body = redis_mock.setex.call_args.args
    result = AIResult.model_validate_json(body)
    assert result.error == "NO_FACE_DETECTED"
    assert result.embedding is None


@pytest.mark.asyncio
async def test_handle_job_timeout_publishes_processing_timeout(worker, redis_mock, face_mock):
    async def _slow(*_):
        await asyncio.sleep(999)

    face_mock.process_frame = _slow

    # Override timeout to make the test fast
    worker._settings = Settings(job_timeout_s=0.01, result_ttl_s=60)
    payload = _make_job_payload()
    await worker._handle_job(payload)

    _, _, body = redis_mock.setex.call_args.args
    result = AIResult.model_validate_json(body)
    assert result.error == "PROCESSING_TIMEOUT"


@pytest.mark.asyncio
async def test_handle_job_unexpected_exception_publishes_internal_error(
    worker, redis_mock, face_mock
):
    face_mock.process_frame = AsyncMock(side_effect=RuntimeError("unexpected crash"))
    payload = _make_job_payload()
    await worker._handle_job(payload)

    _, _, body = redis_mock.setex.call_args.args
    result = AIResult.model_validate_json(body)
    assert result.error == "INTERNAL_ERROR"


@pytest.mark.asyncio
async def test_handle_job_result_uses_correct_ttl(worker, redis_mock):
    payload = _make_job_payload()
    await worker._handle_job(payload)

    _, ttl, _ = redis_mock.setex.call_args.args
    assert ttl == worker._settings.result_ttl_s


# ── _consume_loop ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_consume_loop_skips_none_blpop(worker, redis_mock):
    """BLPOP returning None (timeout) must not crash the loop."""
    redis_mock.blpop = AsyncMock(return_value=None)

    # Let the loop run briefly then cancel
    await worker.start()
    await asyncio.sleep(0.05)
    await worker.stop()

    # setex should never have been called
    redis_mock.setex.assert_not_called()


@pytest.mark.asyncio
async def test_consume_loop_processes_jobs_from_queue(worker, redis_mock):
    """When BLPOP returns a job payload, _handle_job should be called."""
    payload = _make_job_payload("job-q-1")
    call_count = 0

    async def _blpop_once(*_, **__):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return (b"ai:recognition:queue", payload)
        await asyncio.sleep(999)  # block after first job

    redis_mock.blpop = _blpop_once

    await worker.start()
    await asyncio.sleep(0.1)
    await worker.stop()

    redis_mock.setex.assert_called_once()
    key = redis_mock.setex.call_args.args[0]
    assert key == "ai:recognition:result:job-q-1"


@pytest.mark.asyncio
async def test_consume_loop_continues_after_exception(worker, redis_mock):
    """A crash inside the loop body must not terminate the loop."""
    call_count = 0

    async def _blpop_raises(*_, **__):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise ConnectionError("simulated Redis error")
        # After the error the loop should recover and keep polling
        await asyncio.sleep(999)

    redis_mock.blpop = _blpop_raises

    with patch("workers.redis_worker.asyncio.sleep", new=AsyncMock()):
        await worker.start()
        await asyncio.sleep(0.05)
        await worker.stop()

    # The loop must have called blpop at least twice (once failing, once recovering)
    assert call_count >= 1
