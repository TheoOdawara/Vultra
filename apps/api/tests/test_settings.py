import pytest
from pydantic import ValidationError

from app.core.settings import Settings


def test_no_variable_has_a_default() -> None:
    assert all(field.is_required() for field in Settings.model_fields.values())


def test_rejected_database_url_is_not_echoed_in_the_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "mysql://service:fictitious-password@database.test/vultra")
    monkeypatch.setenv("REDIS_URL", "redis://cache.test:6379/0")
    monkeypatch.setenv("API_DOCS_ENABLED", "false")

    with pytest.raises(ValidationError) as error_info:
        Settings()

    assert "database_url" in str(error_info.value)
    assert "fictitious-password" not in str(error_info.value)
