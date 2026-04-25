"""
FaceService — RAM-only face processing with InsightFace.

Pipeline (order is inviolable per LGPD / ADR-005):
  1. base64 decode → numpy BGR array (no disk I/O)
  2. RetinaFace detection (via InsightFace FaceAnalysis)
  3. Quality validation
  4. ArcFace embedding generation
"""
from __future__ import annotations

import asyncio
import logging
import time
from concurrent.futures import ThreadPoolExecutor

from config import Settings
from validators.frame_validator import decode_frame, validate_quality

logger = logging.getLogger(__name__)


class FaceServiceError(Exception):
    """Pipeline error: failed to generate a valid embedding."""

    def __init__(self, error_code: str, detail: str = "") -> None:
        self.error_code = error_code
        super().__init__(detail or error_code)


class FaceService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._app = None
        self._executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="face")

    def load_models(self) -> None:
        """Warm-up: load InsightFace model pack into RAM."""
        from insightface.app import FaceAnalysis

        logger.info("Loading InsightFace model '%s'...", self._settings.model_name)
        self._app = FaceAnalysis(
            name=self._settings.model_name,
            providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
        )
        self._app.prepare(ctx_id=0, det_size=(640, 640))
        logger.info("InsightFace ready.")

    def is_ready(self) -> bool:
        return self._app is not None

    @property
    def model_name(self) -> str:
        return self._settings.model_name

    def _process_sync(self, frame_base64: str) -> dict:
        """Synchronous processing executed in a thread pool."""
        if self._app is None:
            raise FaceServiceError("MODEL_NOT_READY")

        start_ms = time.monotonic() * 1000.0

        decode_result = decode_frame(frame_base64, self._settings.max_payload_bytes)
        if not decode_result.valid:
            raise FaceServiceError(decode_result.error or "INVALID_IMAGE", "Frame decode failed")

        img = decode_result.image
        assert img is not None

        try:
            faces = self._app.get(img)

            if len(faces) == 0:
                raise FaceServiceError("NO_FACE_DETECTED", "No face detected in frame")
            if len(faces) > 1:
                raise FaceServiceError(
                    "MULTIPLE_FACES",
                    f"{len(faces)} faces detected; exactly 1 required",
                )

            face = faces[0]
            quality = validate_quality(img, face.bbox.tolist())
            if not quality.valid:
                raise FaceServiceError(
                    quality.error or "LOW_QUALITY",
                    f"Quality score {quality.quality_score:.2f} below threshold",
                )

            embedding: list[float] = face.embedding.tolist()
        finally:
            del img

        processing_ms = int(time.monotonic() * 1000.0 - start_ms)
        return {
            "embedding": embedding,
            "quality_score": quality.quality_score,
            "processing_ms": processing_ms,
        }

    async def process_frame(self, frame_base64: str) -> dict:
        """Async entry point delegating synchronous InsightFace work to a thread pool."""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(self._executor, self._process_sync, frame_base64)
