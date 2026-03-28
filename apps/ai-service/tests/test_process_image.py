"""
Smoke tests — POST /process-image endpoint.

Key assertions:
  - Success path returns embedding[512], quality_score, processing_ms
  - frame_base64 NEVER appears in any response (LGPD)
  - Structured error codes for each failure case
  - Payload-too-large returns 413 before processing
  - Timeout returns 503
  - Model-not-ready returns 503
"""
import asyncio
import json
from unittest.mock import AsyncMock

import pytest

from tests.conftest import TEST_EMBEDDING, TEST_FRAME_B64


# ── Success path ─────────────────────────────────────────────────────────────


def test_process_image_success(client):
    response = client.post(
        "/process-image",
        json={"frame_base64": TEST_FRAME_B64},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["embedding"]) == 512
    assert 0.0 <= data["quality_score"] <= 1.0
    assert isinstance(data["processing_ms"], int)
    assert data["processing_ms"] >= 0


def test_process_image_embedding_has_correct_length(client):
    response = client.post("/process-image", json={"frame_base64": TEST_FRAME_B64})
    assert response.status_code == 200
    assert len(response.json()["embedding"]) == 512


# ── LGPD: no image data in response ─────────────────────────────────────────


def test_process_image_response_never_contains_frame_base64(client):
    """
    LGPD compliance: the raw frame must never appear in the HTTP response.
    """
    response = client.post("/process-image", json={"frame_base64": TEST_FRAME_B64})
    assert response.status_code == 200
    # Response body must not contain the input frame
    assert TEST_FRAME_B64 not in response.text
    # Also check as parsed JSON
    data = response.json()
    assert "frame_base64" not in data


def test_error_response_never_contains_frame_base64(client, face_service_mock):
    """Error responses must also never echo back the frame."""
    from services.face_service import FaceServiceError

    face_service_mock.process_frame = AsyncMock(
        side_effect=FaceServiceError("NO_FACE_DETECTED")
    )
    try:
        response = client.post("/process-image", json={"frame_base64": TEST_FRAME_B64})
        assert TEST_FRAME_B64 not in response.text
    finally:
        # Restore default mock
        face_service_mock.process_frame = AsyncMock(
            return_value={
                "embedding": TEST_EMBEDDING,
                "quality_score": 0.85,
                "processing_ms": 42,
            }
        )


# ── Error codes ──────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "error_code",
    ["NO_FACE_DETECTED", "MULTIPLE_FACES", "LOW_QUALITY", "FRAME_TOO_LARGE"],
)
def test_process_image_face_service_error_returns_422(client, face_service_mock, error_code):
    from services.face_service import FaceServiceError

    face_service_mock.process_frame = AsyncMock(
        side_effect=FaceServiceError(error_code)
    )
    try:
        response = client.post("/process-image", json={"frame_base64": TEST_FRAME_B64})
        assert response.status_code == 422
        assert response.json()["detail"]["error"] == error_code
    finally:
        face_service_mock.process_frame = AsyncMock(
            return_value={
                "embedding": TEST_EMBEDDING,
                "quality_score": 0.85,
                "processing_ms": 42,
            }
        )


def test_process_image_timeout_returns_503(client, face_service_mock):
    async def _slow(*_):
        await asyncio.sleep(10)

    face_service_mock.process_frame = _slow
    try:
        response = client.post("/process-image", json={"frame_base64": TEST_FRAME_B64})
        assert response.status_code == 503
        assert response.json()["detail"]["error"] == "PROCESSING_TIMEOUT"
    finally:
        face_service_mock.process_frame = AsyncMock(
            return_value={
                "embedding": TEST_EMBEDDING,
                "quality_score": 0.85,
                "processing_ms": 42,
            }
        )


def test_process_image_model_not_ready_returns_503(client, face_service_mock):
    face_service_mock.is_ready.return_value = False
    try:
        response = client.post("/process-image", json={"frame_base64": TEST_FRAME_B64})
        assert response.status_code == 503
        assert response.json()["detail"]["error"] == "MODEL_NOT_READY"
    finally:
        face_service_mock.is_ready.return_value = True


# ── Payload size guard ───────────────────────────────────────────────────────


def test_process_image_payload_too_large_returns_413(client):
    """Content-Length > max_payload_bytes must be rejected before processing."""
    oversized_body = json.dumps({"frame_base64": "A" * 1_100_000})
    response = client.post(
        "/process-image",
        content=oversized_body,
        headers={"content-type": "application/json"},
    )
    assert response.status_code == 413
    data = response.json()
    assert data["error"] == "PAYLOAD_TOO_LARGE"
    assert "max_bytes" in data


# ── Input validation ─────────────────────────────────────────────────────────


def test_process_image_missing_frame_base64_returns_422(client):
    response = client.post("/process-image", json={})
    assert response.status_code == 422


def test_process_image_invalid_json_body_returns_422(client):
    response = client.post(
        "/process-image",
        content="not-json",
        headers={"content-type": "application/json"},
    )
    assert response.status_code == 422
