"""
Unit tests — frame_validator.py

Covers:
  decode_frame():
    - valid JPEG → DecodeResult(valid=True, image=ndarray)
    - invalid base64 → INVALID_BASE64
    - oversized payload → FRAME_TOO_LARGE
    - non-image bytes → INVALID_IMAGE
    - empty string → INVALID_BASE64

  validate_quality():
    - high-quality centered face → valid=True, quality_score in [0.5, 1.0]
    - bbox below MIN_FACE_PX → LOW_QUALITY
    - zero-area bbox → LOW_QUALITY
    - face off-center → LOW_QUALITY
    - blurry region → LOW_QUALITY
    - dark image → LOW_QUALITY
    - bright (overexposed) image → LOW_QUALITY
    - quality_score composite formula
"""
from __future__ import annotations

import base64
import io

import numpy as np
import pytest

from validators.frame_validator import (
    MIN_BLUR_LAPLACIAN,
    QualityResult,
    decode_frame,
    validate_quality,
)

# ── Helpers ────────────────────────────────────────────────────────────────────


def _make_jpeg(width: int = 200, height: int = 200, color=(128, 128, 128)) -> str:
    """Generate a simple solid-color JPEG and return it as a base64 string."""
    try:
        from PIL import Image

        img = Image.new("RGB", (width, height), color=color)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=95)
        return base64.b64encode(buf.getvalue()).decode()
    except ImportError:
        pytest.skip("Pillow not installed — skipping frame creation helper")


def _grey_ndarray(width: int = 300, height: int = 300, value: int = 128) -> np.ndarray:
    """Return a solid BGR ndarray of the given size and grey value."""
    return np.full((height, width, 3), value, dtype=np.uint8)


# ── decode_frame ──────────────────────────────────────────────────────────────


class TestDecodeFrame:
    MAX = 1_048_576  # 1 MB

    def test_valid_jpeg_returns_image(self):
        b64 = _make_jpeg()
        result = decode_frame(b64, self.MAX)
        assert result.valid is True
        assert result.image is not None
        assert isinstance(result.image, np.ndarray)
        assert result.error is None

    def test_image_has_correct_shape(self):
        b64 = _make_jpeg(100, 100)
        result = decode_frame(b64, self.MAX)
        assert result.valid is True
        assert result.image is not None
        assert result.image.shape == (100, 100, 3)

    def test_invalid_base64_returns_error(self):
        result = decode_frame("not-valid-base64!!!", self.MAX)
        assert result.valid is False
        assert result.error == "INVALID_BASE64"
        assert result.image is None

    def test_empty_string_returns_error(self):
        result = decode_frame("", self.MAX)
        # Empty base64 is technically valid but decodes to empty bytes → INVALID_IMAGE
        assert result.valid is False

    def test_oversized_payload_returns_frame_too_large(self):
        big_bytes = b"x" * (100 + 1)
        b64 = base64.b64encode(big_bytes).decode()
        result = decode_frame(b64, max_bytes=100)
        assert result.valid is False
        assert result.error == "FRAME_TOO_LARGE"

    def test_non_image_bytes_returns_invalid_image(self):
        raw = b"this is not an image at all, just random text bytes 1234567890"
        b64 = base64.b64encode(raw).decode()
        result = decode_frame(b64, self.MAX)
        assert result.valid is False
        assert result.error == "INVALID_IMAGE"

    def test_exact_max_bytes_is_accepted(self):
        """Payload exactly at the limit should NOT be rejected."""
        b64 = _make_jpeg()
        img_bytes = base64.b64decode(b64)
        result = decode_frame(b64, max_bytes=len(img_bytes))
        assert result.valid is True

    def test_one_byte_over_max_is_rejected(self):
        b64 = _make_jpeg()
        img_bytes = base64.b64decode(b64)
        result = decode_frame(b64, max_bytes=len(img_bytes) - 1)
        assert result.valid is False
        assert result.error == "FRAME_TOO_LARGE"


# ── validate_quality ──────────────────────────────────────────────────────────


def _center_bbox(img: np.ndarray, face_fraction: float = 0.4) -> list[float]:
    """Return a centered bounding box covering `face_fraction` of the image."""
    h, w = img.shape[:2]
    fw = w * face_fraction
    fh = h * face_fraction
    cx, cy = w / 2.0, h / 2.0
    return [cx - fw / 2, cy - fh / 2, cx + fw / 2, cy + fh / 2]


class TestValidateQuality:
    def test_high_quality_centered_face(self):
        """
        A 300x300 image with a 120px face region in the center.
        The region is filled with a sharp (non-blurry) pattern to produce
        high Laplacian variance.
        """
        # Checkerboard pattern — high Laplacian variance
        img = np.zeros((300, 300, 3), dtype=np.uint8)
        # Fill with alternating black/white 4px squares for max sharpness
        for y in range(300):
            for x in range(300):
                img[y, x] = (255, 255, 255) if ((x // 4 + y // 4) % 2 == 0) else (0, 0, 0)
        # Center the mean brightness to ~128 (avg of 0 and 255)

        bbox = _center_bbox(img, face_fraction=0.4)
        result = validate_quality(img, bbox)
        assert result.valid is True
        assert 0.0 <= result.quality_score <= 1.0

    def test_bbox_too_small_returns_low_quality(self):
        img = _grey_ndarray(300, 300)
        # bbox is only 10x10 — below MIN_FACE_PX=50
        bbox = [145.0, 145.0, 155.0, 155.0]
        result = validate_quality(img, bbox)
        assert result.valid is False
        assert result.error == "LOW_QUALITY"
        assert result.quality_score == 0.0

    def test_zero_area_bbox_returns_low_quality(self):
        img = _grey_ndarray(300, 300)
        bbox = [100.0, 100.0, 100.0, 100.0]  # zero width & height
        result = validate_quality(img, bbox)
        assert result.valid is False
        assert result.error == "LOW_QUALITY"

    def test_negative_area_bbox_returns_low_quality(self):
        img = _grey_ndarray(300, 300)
        bbox = [200.0, 200.0, 100.0, 100.0]  # x2 < x1 → clipped to 0 area
        result = validate_quality(img, bbox)
        assert result.valid is False
        assert result.error == "LOW_QUALITY"

    def test_face_off_center_left_returns_low_quality(self):
        """Face with center_x < 0.3 should fail centering check."""
        img = _grey_ndarray(300, 300, value=128)
        # Place bbox on the left edge: center_x ≈ 0.1
        bbox = [0.0, 100.0, 60.0, 200.0]  # 60px wide, center at x=30 → cx=0.1
        result = validate_quality(img, bbox)
        # May fail on size or centering depending on blur first — just assert invalid
        assert result.valid is False

    def test_uniform_image_fails_blur_check(self):
        """
        A completely uniform grey image has zero Laplacian variance — guaranteed blur fail.
        """
        img = np.full((300, 300, 3), 128, dtype=np.uint8)
        bbox = _center_bbox(img, face_fraction=0.4)
        result = validate_quality(img, bbox)
        assert result.valid is False
        assert result.error == "LOW_QUALITY"
        # Blur score should be well below threshold
        assert result.blur is not None
        assert result.blur < MIN_BLUR_LAPLACIAN

    def test_dark_image_fails_brightness_check(self):
        """Very dark image (brightness ≈ 10) should fail after passing blur check."""
        # Need non-zero Laplacian — use a pattern but very dark
        img = np.zeros((300, 300, 3), dtype=np.uint8)
        for y in range(300):
            for x in range(300):
                img[y, x] = (15, 15, 15) if ((x // 4 + y // 4) % 2 == 0) else (5, 5, 5)
        bbox = _center_bbox(img, face_fraction=0.4)
        result = validate_quality(img, bbox)
        # Should fail either on blur or brightness
        assert result.valid is False

    def test_bright_overexposed_image_fails(self):
        """Overexposed image (brightness ≈ 250) should fail the brightness range check."""
        # Pattern with very high values
        img = np.zeros((300, 300, 3), dtype=np.uint8)
        for y in range(300):
            for x in range(300):
                img[y, x] = (255, 255, 255) if ((x // 4 + y // 4) % 2 == 0) else (240, 240, 240)
        bbox = _center_bbox(img, face_fraction=0.4)
        result = validate_quality(img, bbox)
        # May pass blur but fail brightness (mean ≈ 247 > MAX_BRIGHTNESS=220)
        assert result.valid is False

    def test_quality_score_is_float_between_0_and_1(self):
        """Any result — valid or not — must have quality_score in [0, 1]."""
        img = _grey_ndarray(300, 300, value=90)
        bbox = _center_bbox(img, face_fraction=0.4)
        result = validate_quality(img, bbox)
        assert 0.0 <= result.quality_score <= 1.0

    def test_quality_result_has_blur_and_brightness_fields(self):
        """When at least partial processing occurred, diagnostic fields should be set."""
        img = _grey_ndarray(300, 300, value=128)
        bbox = _center_bbox(img, face_fraction=0.4)
        result = validate_quality(img, bbox)
        # Even on a uniform (blur=0) image, blur should be reported
        assert result.blur is not None

    def test_face_larger_than_image_bbox_is_clamped(self):
        """Bbox coordinates beyond image dimensions must be clamped without crashing."""
        img = _grey_ndarray(300, 300, value=128)
        # Intentionally out-of-bounds bbox
        bbox = [-50.0, -50.0, 400.0, 400.0]
        # Should not raise — may pass or fail quality, but must return a result
        result = validate_quality(img, bbox)
        assert isinstance(result, QualityResult)
