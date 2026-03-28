from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Redis — credentials MUST come from env, never hardcoded
    redis_url: str = "redis://localhost:6379"

    # Queue names
    ai_queue_name: str = "ai:recognition:queue"
    ai_result_prefix: str = "ai:recognition:result:"

    # InsightFace model pack (buffalo_l = RetinaFace + ArcFace 512d)
    model_name: str = "buffalo_l"

    # Limits
    max_payload_bytes: int = 1_048_576  # 1 MB

    # Timeouts and TTLs
    job_timeout_s: float = 3.0
    result_ttl_s: int = 60

    # Server
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8000

    model_config = {"env_file": ".env", "case_sensitive": False}


@lru_cache
def get_settings() -> Settings:
    return Settings()
