"""
<<<<<<< HEAD
Frame quality validation — all operations in RAM, no disk I/O.

Validation rules (per todo sprint plan):
  - Face bounding box width & height ≥ 50 px
  - Laplacian variance (blur score) > 100
  - Face center x and y in range [0.3, 0.7] relative to image dimensions
  - Mean brightness of face region in range [40, 220]

Quality score formula (weighted, range 0.0–1.0):
  0.30 × size_score  (face size, normalised 50–200 px)
  0.30 × blur_score  (Laplacian variance, normalised 100–500)
  0.25 × center_score (1 at image center, 0 at edges)
  0.15 × bright_score (ideal brightness ≈ 130)

Thresholds:
  < 0.40 → reject (LOW_QUALITY)
  0.40–0.59 → warn (still processed)
"""
VULTRA AI Service — Frame Validator
RAM-only decode e validação de qualidade. Nunca há I/O em disco (LGPD).
"""
from __future__ import annotations

import base64
import io
import logging
from dataclasses import dataclass, field
from typing import Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)

@dataclass
class DecodeResult:
    valid: bool
    image: Optional[np.ndarray] = field(default=None, repr=False)
    error: Optional[str] = None

@dataclass
class QualityResult:
    valid: bool
    quality_score: float = 0.0
    error: Optional[str] = None

# — Thresholds —
MIN_FACE_PX = 50          # Minimum face bounding box side length
MIN_BLUR_LAPLACIAN = 80.0 # Laplacian variance below this = too blurry
MIN_BRIGHTNESS = 40       # Mean pixel value (0-255)
MAX_BRIGHTNESS = 230
MIN_QUALITY_SCORE = 0.5   # Combined score gate

def decode_frame(frame_base64: str, max_bytes: int) -> DecodeResult:
    """
    Decodifica um frame JPEG base64 para numpy BGR array (RAM only).
    Nunca há I/O em disco.
    """
    try:
        img_bytes = base64.b64decode(frame_base64, validate=True)
    except Exception:
        return DecodeResult(valid=False, error="INVALID_BASE64")

    if len(img_bytes) > max_bytes:
        return DecodeResult(valid=False, error="FRAME_TOO_LARGE")

    img_array = np.frombuffer(img_bytes, dtype=np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    if img is None:
        return DecodeResult(valid=False, error="DECODE_ERROR")
    return DecodeResult(valid=True, image=img)
MIN_BRIGHTNESS = 40       # Mean pixel value (0-255)
MAX_BRIGHTNESS = 230
MIN_QUALITY_SCORE = 0.5   # Combined score gate
>>>>>>> 3e716ea (fix: ensure all dependencies and imports are correct for both api-core and ai-service (pyproject, package.json, venv, type imports, and all code))


def decode_frame(frame_base64: str, max_bytes: int) -> DecodeResult:
    """
<<<<<<< HEAD
    Decode a base64-encoded JPEG frame into a numpy BGR array.
    No disk I/O at any step.
    """
    try:
        img_bytes = base64.b64decode(frame_base64, validate=True)
    except Exception:
        return DecodeResult(valid=False, error="INVALID_BASE64")

    if len(img_bytes) > max_bytes:
        return DecodeResult(valid=False, error="FRAME_TOO_LARGE")

    img_array = np.frombuffer(img_bytes, dtype=np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
=======
    Decode a base64-encoded JPEG into a numpy BGR array.
    No disk I/O — uses io.BytesIO only.

    Returns DecodeResult with .image populated on success,
    .error code on failure.
    """
    try:
        raw_bytes = base64.b64decode(frame_base64, validate=True)
    except Exception:
        return DecodeResult(valid=False, error="INVALID_BASE64")

    if len(raw_bytes) > max_bytes:
        return DecodeResult(valid=False, error="FRAME_TOO_LARGE")

    try:
        buf = np.frombuffer(raw_bytes, dtype=np.uint8)
        img = cv2.imdecode(buf, cv2.IMREAD_COLOR)  # → BGR numpy array, RAM only
        del raw_bytes, buf  # LGPD: discard encoded bytes immediately
    except Exception:
        return DecodeResult(valid=False, error="INVALID_IMAGE")
>>>>>>> 3e716ea (fix: ensure all dependencies and imports are correct for both api-core and ai-service (pyproject, package.json, venv, type imports, and all code))

    if img is None:
        return DecodeResult(valid=False, error="INVALID_IMAGE")

    return DecodeResult(valid=True, image=img)


def validate_quality(img: np.ndarray, bbox: list[float]) -> QualityResult:
    """
<<<<<<< HEAD
    Calculate quality metrics for a detected face region.

    Args:
        img:  Full BGR frame as numpy array.
        bbox: [x1, y1, x2, y2] from InsightFace detection.

    Returns:
        QualityResult with valid flag, score, and per-metric values.
    """
    ih, iw = img.shape[:2]
    x1, y1, x2, y2 = (
        max(0, int(bbox[0])),
        max(0, int(bbox[1])),
        min(iw, int(bbox[2])),
        min(ih, int(bbox[3])),
    )

    w, h = x2 - x1, y2 - y1

    if w <= 0 or h <= 0:
        return QualityResult(valid=False, quality_score=0.0, error="LOW_QUALITY")

    # ── Face size ────────────────────────────────────────────────────────────
    if min(w, h) < 50:
        return QualityResult(
            valid=False,
            quality_score=0.0,
            error="LOW_QUALITY",
        )

    face_region = img[y1:y2, x1:x2]
    gray_face = cv2.cvtColor(face_region, cv2.COLOR_BGR2GRAY)

    # ── Blur (Laplacian variance) ────────────────────────────────────────────
    laplacian_var = float(cv2.Laplacian(gray_face, cv2.CV_64F).var())

    if laplacian_var < 100:
        return QualityResult(
            valid=False,
            quality_score=round(min(laplacian_var / 100.0 * 0.4, 0.39), 4),
            error="LOW_QUALITY",
            blur=laplacian_var,
        )

    # ── Brightness ──────────────────────────────────────────────────────────
    mean_brightness = float(gray_face.mean())

    if not (40.0 <= mean_brightness <= 220.0):
        return QualityResult(
            valid=False,
            quality_score=0.0,
            error="LOW_QUALITY",
            brightness=mean_brightness,
        )

    # ── Centering ───────────────────────────────────────────────────────────
    cx = (x1 + x2) / 2.0 / iw
    cy = (y1 + y2) / 2.0 / ih

    # ── Score calculation ────────────────────────────────────────────────────
    size_score = min((min(w, h) - 50.0) / 150.0, 1.0)
    blur_score = min((laplacian_var - 100.0) / 400.0, 1.0)
    center_score = max(0.0, 1.0 - 2.0 * max(abs(cx - 0.5), abs(cy - 0.5)))
    bright_score = max(0.0, 1.0 - abs(mean_brightness - 130.0) / 90.0)

    quality_score = (
        0.30 * size_score
        + 0.30 * blur_score
        + 0.25 * center_score
        + 0.15 * bright_score
    )
    quality_score = round(min(max(quality_score, 0.0), 1.0), 4)

    if quality_score < 0.40:
        return QualityResult(
            valid=False,
            quality_score=quality_score,
            error="LOW_QUALITY",
            blur=laplacian_var,
            brightness=mean_brightness,
            centering_x=round(cx, 3),
            centering_y=round(cy, 3),
        )

    return QualityResult(
        valid=True,
        quality_score=quality_score,
        blur=laplacian_var,
        brightness=mean_brightness,
        centering_x=round(cx, 3),
        centering_y=round(cy, 3),
    )
=======
    Validate face quality from the detected bounding box.
    Checks: size, blur (Laplacian variance), brightness.
    Returns a composite quality_score in [0, 1].
    """
    x1, y1, x2, y2 = int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3])

    # ── Size check ────────────────────────────────────────────────────────────
    face_w = x2 - x1
    face_h = y2 - y1
    if face_w < MIN_FACE_PX or face_h < MIN_FACE_PX:
        return QualityResult(valid=False, quality_score=0.0, error="LOW_QUALITY")

    # Crop face region (with boundary clamp)
    h_img, w_img = img.shape[:2]
    x1c = max(0, x1); y1c = max(0, y1)
    x2c = min(w_img, x2); y2c = min(h_img, y2)
    face_crop = img[y1c:y2c, x1c:x2c]

    # ── Blur check (Laplacian variance) ───────────────────────────────────────
    gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
    blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    # ── Brightness check ─────────────────────────────────────────────────────
    brightness = float(np.mean(gray))

    # ── Composite quality score ───────────────────────────────────────────────
    blur_norm = min(blur_score / 300.0, 1.0)           # 300 = excellent sharpness
    size_norm = min((face_w * face_h) / (200 * 200), 1.0)
    brightness_ok = MIN_BRIGHTNESS <= brightness <= MAX_BRIGHTNESS
    brightness_norm = 1.0 if brightness_ok else 0.3

    quality_score = round(0.5 * blur_norm + 0.3 * size_norm + 0.2 * brightness_norm, 4)

    if quality_score < MIN_QUALITY_SCORE:
        return QualityResult(valid=False, quality_score=quality_score, error="LOW_QUALITY")

    return QualityResult(valid=True, quality_score=quality_score)
>>>>>>> 3e716ea (fix: ensure all dependencies and imports are correct for both api-core and ai-service (pyproject, package.json, venv, type imports, and all code))
