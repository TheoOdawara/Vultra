import structlog
from fastapi import FastAPI

from app.core.settings import Settings


def create_app(settings: Settings) -> FastAPI:
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.processors.JSONRenderer(),
        ]
    )
    docs_url, openapi_url = ("/docs", "/openapi.json") if settings.api_docs_enabled else (None, None)
    app = FastAPI(title="Vultra API", docs_url=docs_url, redoc_url=None, openapi_url=openapi_url)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app
