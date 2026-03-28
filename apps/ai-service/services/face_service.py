"""
FaceService — RAM-only face processing with InsightFace.

Pipeline (order is inviolable per LGPD / ADR-005):
  1. base64 decode → numpy BGR array (no disk I/O)
  2. RetinaFace detection (via InsightFace FaceAnalysis)
  3. Validate: exactly 1 face, size ≥ 50px, blur > 100, centering, brightness
  4. ArcFace: generate 512-dimensional embedding
  5. Discard image reference — GC reclaims memory
  6. Return embedding + quality_score + processing_ms

Nothing from steps 1–4 is persisted; only the numeric vector leaves this service.
"""
from __future__ import annotations

import asyncio
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from typing import TYPE_CHECKING

from config import Settings
from validators.frame_validator import decode_frame, validate_quality

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class FaceServiceError(Exception):
    """Raised when the pipeline cannot produce a valid embedding."""

    def __init__(self, error_code: str, detail: str = "") -> None:
        self.error_code = error_code
        super().__init__(detail or error_code)


class FaceService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._app = None  # InsightFace FaceAnalysis — loaded on startup
        self._executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="face")

    # ── Lifecycle ────────────────────────────────────────────────────────────

    def load_models(self) -> None:
        """
        Warm-up: load InsightFace model pack into RAM.
        Called once at FastAPI startup (lifespan).
        Import is deferred here so tests can mock it without InsightFace installed.
        """
        from insightface.app import FaceAnalysis  # deferred import for testability

        logger.info("Loading InsightFace model '%s'…", self._settings.model_name)
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

    # ── Core processing ──────────────────────────────────────────────────────

    def _process_sync(self, frame_base64: str) -> dict:
        """
        Synchronous processing — runs in a thread pool to avoid blocking asyncio.
        All operations are in RAM. No disk I/O at any step.
        """
        start_ms = time.monotonic() * 1000.0

        # Step 1: decode base64 → numpy array (RAM only)
        decode_result = decode_frame(frame_base64, self._settings.max_payload_bytes)
        if not decode_result.valid:
            raise FaceServiceError(
                decode_result.error or "INVALID_IMAGE",
                "Frame decode failed",
            )

        img = decode_result.image
        assert img is not None  # satisfy type checker

        try:
            # Step 2: RetinaFace — detect faces (part of FaceAnalysis)
            faces = self._app.get(img)  # type: ignore[union-attr]

            # Step 3: validate face count
            if len(faces) == 0:
                raise FaceServiceError("NO_FACE_DETECTED", "No face detected in frame")
            if len(faces) > 1:
                raise FaceServiceError(
                    "MULTIPLE_FACES",
                    f"{len(faces)} faces detected; exactly 1 required",
                )

            face = faces[0]

            # Step 3b: quality validation
            quality = validate_quality(img, face.bbox.tolist())
            if not quality.valid:
                raise FaceServiceError(
                    quality.error or "LOW_QUALITY",
                    f"Quality score {quality.quality_score:.2f} below threshold",
                )

            # Step 4: ArcFace — generate 512-dimensional embedding
            embedding: list[float] = face.embedding.tolist()

        finally:
            # Step 5: discard image reference (GC reclaims memory — LGPD)
            del img

        processing_ms = int(time.monotonic() * 1000.0 - start_ms)

        return {
            "embedding": embedding,
            "quality_score": quality.quality_score,
            "processing_ms": processing_ms,
        }

    async def process_frame(self, frame_base64: str) -> dict:
        """
        Async entry point: delegates synchronous InsightFace work to a thread pool
        so it does not block the asyncio event loop.
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self._executor, self._process_sync, frame_base64)
