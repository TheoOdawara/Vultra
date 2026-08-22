
from pydantic import BaseModel, Field


class AIJob(BaseModel):
    """Payload consumed from Redis queue ai:recognition:queue."""

    job_id: str = Field(..., description="UUID of the job")
    frame_base64: str = Field(
        ..., description="JPEG frame in base64 — NEVER log or persist"
    )
    organization_id: str = Field(..., description="Tenant UUID — mandatory for multitenancy")
    device_id: str | None = Field(None, description="ESP32 device UUID, if applicable")


class AIResult(BaseModel):
    """Payload published to Redis key ai:recognition:result:{job_id}."""

    job_id: str
    embedding: list[float] | None = Field(
        None, description="512-dimensional ArcFace vector; null on error"
    )
    quality_score: float | None = Field(None, ge=0.0, le=1.0)
    processing_ms: int | None = Field(None, ge=0)
    error: str | None = Field(
        None,
        description=(
            "Structured error code: NO_FACE_DETECTED | MULTIPLE_FACES | "
            "LOW_QUALITY | FRAME_TOO_LARGE | PROCESSING_TIMEOUT | INTERNAL_ERROR"
        ),
    )
