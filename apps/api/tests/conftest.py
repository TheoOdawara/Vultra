from collections.abc import AsyncIterator, Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from testcontainers.community.postgres import PostgresContainer

API_ROOT = Path(__file__).parents[1]
SERVICE_ROLE_CREDENTIAL = "fictitious-service-password"


@pytest.fixture(autouse=True)
def working_directory_without_env_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(tmp_path)


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture(scope="session")
def migrated_database() -> Iterator[PostgresContainer]:
    container = (
        PostgresContainer("pgvector/pgvector:0.8.6-pg16-bookworm", driver="psycopg")
        .with_env("SERVICE_DATABASE_PASSWORD", SERVICE_ROLE_CREDENTIAL)
        .with_volume_mapping(
            API_ROOT.parents[1] / "infra/postgres/create-service-role.sh",
            "/docker-entrypoint-initdb.d/create-service-role.sh",
        )
    )
    with container, pytest.MonkeyPatch.context() as environment:
        environment.setenv("MIGRATION_DATABASE_URL", container.get_connection_url())
        command.upgrade(Config(API_ROOT / "alembic.ini"), "head")
        yield container


@pytest.fixture
async def service_engine(migrated_database: PostgresContainer) -> AsyncIterator[AsyncEngine]:
    host = migrated_database.get_container_host_ip()
    port = migrated_database.get_exposed_port(migrated_database.port)
    engine = create_async_engine(
        f"postgresql+psycopg://vultra_service:{SERVICE_ROLE_CREDENTIAL}@{host}:{port}/{migrated_database.dbname}"
    )
    yield engine
    await engine.dispose()
