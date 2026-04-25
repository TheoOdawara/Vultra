from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """VULTRA AI Service — configuration loaded from environment."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    redis_url: str = Field(default="redis://localhost:6379", description="Redis connection URL")
    ai_queue_name: str = Field(default="ai:recognition:queue", description="BLPOP queue name")
    ai_result_prefix: str = Field(
        default="ai:recognition:result:",
        description="SETEX key prefix for results",
    )
    model_name: str = Field(default="buffalo_l", description="InsightFace model pack name")
    max_payload_bytes: int = Field(default=1_048_576, description="Max frame size in bytes (1 MB)")
    job_timeout_s: float = Field(default=3.0, description="Max seconds to process a job")
    result_ttl_s: int = Field(default=60, description="Redis SETEX TTL for results")
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8000)
    debug: bool = Field(default=False)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
