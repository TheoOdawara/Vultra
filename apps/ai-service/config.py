<<<<<<< HEAD
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Redis — credentials MUST come from env, never hardcoded
    redis_url: str = "redis://localhost:6379"

    """
    VULTRA AI Service — Configuration
    Carrega variáveis de ambiente via pydantic-settings (v2).
    """
    from __future__ import annotations

    from functools import lru_cache
    from pydantic_settings import BaseSettings, SettingsConfigDict

    class Settings(BaseSettings):
        model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

        # Redis — credenciais SEMPRE via env
        redis_url: str = "redis://localhost:6379"

        # Fila e prefixos
        ai_queue_name: str = "ai:recognition:queue"
        ai_result_prefix: str = "ai:recognition:result:"

        # Modelo InsightFace
        model_name: str = "buffalo_l"

        # Limites
        max_payload_bytes: int = 1_048_576  # 1 MB

        # Timeouts e TTLs
        job_timeout_s: float = 3.0
        result_ttl_s: int = 60

        # Servidor
        debug: bool = False
        host: str = "0.0.0.0"
        port: int = 8000

    @lru_cache

        return Settings()
    # Redis
    redis_url: str = Field(default="redis://localhost:6379", description="Redis connection URL")
    ai_queue_name: str = Field(default="ai:recognition:queue", description="BLPOP queue name")
    ai_result_prefix: str = Field(
        default="ai:recognition:result:", description="SETEX key prefix for results"
    )

    # InsightFace
    model_name: str = Field(default="buffalo_l", description="InsightFace model pack name")

    # Processing limits
    max_payload_bytes: int = Field(default=1_048_576, description="Max frame size in bytes (1 MB)")
    job_timeout_s: float = Field(default=3.0, description="Max seconds to process a job")
    result_ttl_s: int = Field(default=60, description="Redis SETEX TTL for results")

    # Server
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8000)
    debug: bool = Field(default=False)


@lru_cache(maxsize=1)
>>>>>>> 3e716ea (fix: ensure all dependencies and imports are correct for both api-core and ai-service (pyproject, package.json, venv, type imports, and all code))
def get_settings() -> Settings:
    return Settings()
