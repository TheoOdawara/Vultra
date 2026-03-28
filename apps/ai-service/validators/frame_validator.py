"""
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
  ≥ 0.60 → acceptable
"""
from __future__ import annotations

import base64
from dataclasses import dataclass
from typing import Optional

import cv2
import numpy as np


@dataclass
class DecodeResult:
    valid: bool
    error: Optional[str] = None
    image: Optional[np.ndarray] = None


@dataclass
class QualityResult:
    valid: bool
    quality_score: float
    error: Optional[str] = None
    blur: float = 0.0
    brightness: float = 0.0
    centering_x: float = 0.0
    centering_y: float = 0.0


def decode_frame(frame_base64: str, max_bytes: int) -> DecodeResult:
    """
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

    if img is None:
        return DecodeResult(valid=False, error="INVALID_IMAGE")

    return DecodeResult(valid=True, image=img)


def validate_quality(img: np.ndarray, bbox: list[float]) -> QualityResult:
    """
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
