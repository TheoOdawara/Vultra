from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from limits.aio.storage import RedisStorage

from app.core.database import create_engine
from app.core.settings import Settings
from app.features.access.router import router as access_router
from app.features.registry.router import router as registry_router


def create_app(settings: Settings) -> FastAPI:
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.processors.JSONRenderer(),
        ]
    )
    engine = create_engine(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        yield
        await engine.dispose()

    docs_url, openapi_url = ("/docs", "/openapi.json") if settings.api_docs_enabled else (None, None)
    app = FastAPI(
        title="Vultra API", docs_url=docs_url, redoc_url=None, openapi_url=openapi_url, lifespan=lifespan
    )
    app.state.engine = engine
    app.state.rate_limit_storage = RedisStorage(
        f"async+{settings.redis_url}",
        implementation="redispy",
        wrap_exceptions=True,
        socket_connect_timeout=1.0,
        socket_timeout=1.0,
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(access_router)
    app.include_router(registry_router)
    return app
