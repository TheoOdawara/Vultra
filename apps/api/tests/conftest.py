from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from fastapi_users.db import BaseUserDatabase
from fastapi_users.password import PasswordHelper
from limits.aio.storage import MemoryStorage
from sqlalchemy.exc import IntegrityError

from app.application import create_app
from app.core.settings import Settings
from app.features.access.authentication import (
    access_token_database,
    user_database,
    user_institution_session,
)
from app.features.access.models import AccessToken, User, UserRole
from app.features.registry.models import Person

MANAGER_EMAIL = "gestor@example.com"
TEACHER_EMAIL = "professor@example.com"
PASSWORD = "fictitious-password"
PERSON = {"external_id": "2026001234", "name": "Pessoa de Exemplo"}


@pytest.fixture(autouse=True)
def working_directory_without_env_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(tmp_path)


class InMemoryUserDatabase(BaseUserDatabase[User, UUID]):
    def __init__(self) -> None:
        self.users: dict[UUID, User] = {}

    async def get(self, id: UUID) -> User | None:
        return self.users.get(id)

    async def get_by_email(self, email: str) -> User | None:
        return next((user for user in self.users.values() if user.email.lower() == email.lower()), None)

    async def create(self, create_dict: dict[str, Any]) -> User:
        user = User(**{"id": uuid4(), "is_active": True, **create_dict})
        self.users[user.id] = user
        return user


class InMemoryAccessTokenDatabase:
    def __init__(self) -> None:
        self.tokens: dict[str, AccessToken] = {}

    async def get_by_token(self, token: str, max_age: datetime | None = None) -> AccessToken | None:
        access_token = self.tokens.get(token)
        if access_token is None:
            return None
        if max_age is not None and access_token.created_at < max_age:
            return None
        return access_token

    async def create(self, create_dict: dict[str, Any]) -> AccessToken:
        access_token = AccessToken(**{"created_at": datetime.now(UTC), **create_dict})
        self.tokens[access_token.token] = access_token
        return access_token

    async def update(self, access_token: AccessToken, update_dict: dict[str, Any]) -> AccessToken:
        for field, value in update_dict.items():
            setattr(access_token, field, value)
        return access_token

    async def delete(self, access_token: AccessToken) -> None:
        del self.tokens[access_token.token]


class InMemoryPersonSession:
    def __init__(self) -> None:
        self.people: list[Person] = []
        self.pending: list[Person] = []

    def add(self, person: Person) -> None:
        self.pending.append(person)

    async def flush(self) -> None:
        pending, self.pending = self.pending, []
        for person in pending:
            if any(
                (saved.institution_id, saved.external_id) == (person.institution_id, person.external_id)
                for saved in self.people
            ):
                raise IntegrityError(
                    "INSERT INTO person", None, Exception("uq_person_institution_id_external_id")
                )
            person.id = uuid4()
            person.created_at = datetime.now(UTC)
            self.people.append(person)


class Service:
    def __init__(self, redis_url: str | None) -> None:
        self.users = InMemoryUserDatabase()
        self.tokens = InMemoryAccessTokenDatabase()
        self.people = InMemoryPersonSession()
        settings = Settings.model_validate(
            {
                "database_url": "postgresql+psycopg://service:fictitious-password@database.test:5432/vultra",
                "redis_url": redis_url or "redis://cache.test:6379/0",
                "api_docs_enabled": False,
            }
        )
        self.app = create_app(settings)
        self.app.dependency_overrides[user_database] = lambda: self.users
        self.app.dependency_overrides[access_token_database] = lambda: self.tokens
        self.app.dependency_overrides[user_institution_session] = lambda: self.people
        if redis_url is None:
            self.app.state.rate_limit_storage = MemoryStorage()
        self.client = TestClient(self.app)

    def add_user(self, email: str, role: UserRole) -> User:
        user = User(
            id=uuid4(),
            email=email,
            hashed_password=PasswordHelper().hash(PASSWORD),
            is_active=True,
            institution_id=uuid4(),
            role=role,
        )
        self.users.users[user.id] = user
        return user

    def add_token(self, user: User, age: timedelta) -> dict[str, str]:
        token = f"token-{uuid4()}"
        self.tokens.tokens[token] = AccessToken(
            token=token, user_id=user.id, created_at=datetime.now(UTC) - age
        )
        return {"Authorization": f"Bearer {token}"}

    def login(self, email: str, password: str) -> Any:
        return self.client.post("/v1/auth/login", data={"username": email, "password": password})


@pytest.fixture
def service() -> Iterator[Service]:
    service = Service(redis_url=None)
    with service.client:
        yield service
