from fastapi.testclient import TestClient

from app.application import create_app
from app.core.settings import Settings


def client_with_docs(api_docs_enabled: bool) -> TestClient:
    settings = Settings.model_validate(
        {
            "database_url": "postgresql+psycopg://service:fictitious-password@database.test:5432/vultra",
            "redis_url": "redis://cache.test:6379/0",
            "api_docs_enabled": api_docs_enabled,
        }
    )
    return TestClient(create_app(settings))


def test_health_responds_ok_without_authentication() -> None:
    response = client_with_docs(False).get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_openapi_is_not_served_when_docs_are_disabled() -> None:
    client = client_with_docs(False)

    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404
