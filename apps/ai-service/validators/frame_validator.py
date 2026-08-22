"""
Frame quality validation — all operations in RAM, no disk I/O.

Validation rules:
  - Face bounding box width & height ≥ 50 px
  - Laplacian variance (blur score) > 100
  - Face center x and y in range [0.3, 0.7]
  - Mean brightness in range [40, 220]
"""
from __future__ import annotations

import base64
from dataclasses import dataclass, field

import cv2
import numpy as np


@dataclass
class DecodeResult:
    valid: bool
    image: np.ndarray | None = field(default=None, repr=False)
    error: str | None = None


@dataclass
class QualityResult:
    valid: bool
    quality_score: float = 0.0
    error: str | None = None
    blur: float | None = None
    brightness: float | None = None
    centering_x: float | None = None
    centering_y: float | None = None


MIN_FACE_PX = 50
MIN_BLUR_LAPLACIAN = 100.0
MIN_BRIGHTNESS = 40.0
MAX_BRIGHTNESS = 220.0
MIN_QUALITY_SCORE = 0.4


def decode_frame(frame_base64: str, max_bytes: int) -> DecodeResult:
    """Decode a base64-encoded JPEG frame into a numpy BGR array."""
    try:
        img_bytes = base64.b64decode(frame_base64, validate=True)
    except Exception:
        return DecodeResult(valid=False, error="INVALID_BASE64")

    if len(img_bytes) > max_bytes:
        return DecodeResult(valid=False, error="FRAME_TOO_LARGE")

    try:
        img_array: np.ndarray = np.frombuffer(img_bytes, dtype=np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    except Exception:
        return DecodeResult(valid=False, error="INVALID_IMAGE")

    if img is None:
        return DecodeResult(valid=False, error="INVALID_IMAGE")

    return DecodeResult(valid=True, image=img)


def validate_quality(img: np.ndarray, bbox: list[float]) -> QualityResult:
    """Validate face quality from the detected bounding box."""
    ih, iw = img.shape[:2]
    x1, y1, x2, y2 = (
        max(0, int(bbox[0])),
        max(0, int(bbox[1])),
        min(iw, int(bbox[2])),
        min(ih, int(bbox[3])),
    )

    w, h = x2 - x1, y2 - y1
    if w <= 0 or h <= 0 or min(w, h) < MIN_FACE_PX:
        return QualityResult(valid=False, quality_score=0.0, error="LOW_QUALITY")

    face_region = img[y1:y2, x1:x2]
    if face_region.size == 0:
        return QualityResult(valid=False, quality_score=0.0, error="LOW_QUALITY")

    gray_face = cv2.cvtColor(face_region, cv2.COLOR_BGR2GRAY)
    laplacian_var = float(cv2.Laplacian(gray_face, cv2.CV_64F).var())
    mean_brightness = float(gray_face.mean())
    cx = (x1 + x2) / 2.0 / iw
    cy = (y1 + y2) / 2.0 / ih

    if laplacian_var < MIN_BLUR_LAPLACIAN:
        return QualityResult(
            valid=False,
            quality_score=round(min(laplacian_var / MIN_BLUR_LAPLACIAN * 0.4, 0.39), 4),
            error="LOW_QUALITY",
            blur=laplacian_var,
        )

    if not (MIN_BRIGHTNESS <= mean_brightness <= MAX_BRIGHTNESS):
        return QualityResult(
            valid=False,
            quality_score=0.0,
            error="LOW_QUALITY",
            brightness=mean_brightness,
        )

    if not (0.3 <= cx <= 0.7 and 0.3 <= cy <= 0.7):
        return QualityResult(
            valid=False,
            quality_score=0.0,
            error="LOW_QUALITY",
            centering_x=round(cx, 3),
            centering_y=round(cy, 3),
        )

    size_score = min(max((min(w, h) - MIN_FACE_PX) / 150.0, 0.0), 1.0)
    blur_score = min(max((laplacian_var - MIN_BLUR_LAPLACIAN) / 400.0, 0.0), 1.0)
    center_score = max(0.0, 1.0 - 2.0 * max(abs(cx - 0.5), abs(cy - 0.5)))
    bright_score = max(0.0, 1.0 - abs(mean_brightness - 130.0) / 90.0)

    quality_score = round(
        min(
            max(
                0.30 * size_score
                + 0.30 * blur_score
                + 0.25 * center_score
                + 0.15 * bright_score,
                0.0,
            ),
            1.0,
        ),
        4,
    )

    if quality_score < MIN_QUALITY_SCORE:
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
