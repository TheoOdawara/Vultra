from typing import Optional

from pydantic import BaseModel, Field


class ProcessImageRequest(BaseModel):
    frame_base64: str = Field(..., description="JPEG frame encoded as base64 string")
    organization_id: Optional[str] = Field(
        None, description="Tenant identifier (required for Redis worker path)"
    )


class ProcessImageResponse(BaseModel):
    embedding: list[float] = Field(
        ..., description="512-dimensional ArcFace embedding vector"
    )
    quality_score: float = Field(
        ..., ge=0.0, le=1.0, description="Face quality score [0.0, 1.0]"
    )
    processing_ms: int = Field(
        ..., ge=0, description="Total processing time in milliseconds"
    )


class HealthResponse(BaseModel):
    status: str = Field(..., description="'ok' or 'degraded'")
    model: str = Field(..., description="Loaded InsightFace model name")
    uptime_s: int = Field(..., ge=0, description="Service uptime in seconds")
