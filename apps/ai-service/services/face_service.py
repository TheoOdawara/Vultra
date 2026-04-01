"""
FaceService — RAM-only face processing with InsightFace.

Pipeline (order is inviolable per LGPD / ADR-005):
  1. base64 decode → numpy BGR array (no disk I/O)
  2. RetinaFace detection (via InsightFace FaceAnalysis)
"""
FaceService — processamento facial RAM-only com InsightFace.

Pipeline (ordem inviolável por LGPD / ADR-005):
    1. base64 decode → numpy BGR array (sem I/O em disco)
    2. RetinaFace detection (InsightFace FaceAnalysis)
    3. Validar: exatamente 1 face, tamanho ≥ 50px, blur > 80, brilho adequado
    4. ArcFace: gerar embedding 512d
    5. Descartar imagem da RAM
    6. Retornar embedding + quality_score + processing_ms

Nada dos passos 1–4 é persistido; apenas o vetor numérico sai do serviço.
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
        """Erro de pipeline: não foi possível gerar embedding válido."""
        def __init__(self, error_code: str, detail: str = "") -> None:
                self.error_code = error_code
                super().__init__(detail or error_code)

class FaceService:
        def __init__(self, settings: Settings) -> None:

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
<<<<<<< HEAD
        Import is deferred here so tests can mock it without InsightFace installed.
        """
        from insightface.app import FaceAnalysis  # deferred import for testability
=======
        Deferred import so tests can mock without InsightFace installed.
        """
        from insightface.app import FaceAnalysis  # deferred for testability
>>>>>>> 3e716ea (fix: ensure all dependencies and imports are correct for both api-core and ai-service (pyproject, package.json, venv, type imports, and all code))

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
<<<<<<< HEAD
        Synchronous processing — runs in a thread pool to avoid blocking asyncio.
=======
        Synchronous processing — runs in thread pool to avoid blocking asyncio.
>>>>>>> 3e716ea (fix: ensure all dependencies and imports are correct for both api-core and ai-service (pyproject, package.json, venv, type imports, and all code))
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
<<<<<<< HEAD
        assert img is not None  # satisfy type checker
=======
        assert img is not None
>>>>>>> 3e716ea (fix: ensure all dependencies and imports are correct for both api-core and ai-service (pyproject, package.json, venv, type imports, and all code))

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
<<<<<<< HEAD
        Async entry point: delegates synchronous InsightFace work to a thread pool
=======
        Async entry point: delegates synchronous InsightFace work to thread pool
>>>>>>> 3e716ea (fix: ensure all dependencies and imports are correct for both api-core and ai-service (pyproject, package.json, venv, type imports, and all code))
        so it does not block the asyncio event loop.
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self._executor, self._process_sync, frame_base64)
