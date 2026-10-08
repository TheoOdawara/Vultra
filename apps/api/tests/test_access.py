import asyncio
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from fastapi_users.db import BaseUserDatabase
from fastapi_users.exceptions import InvalidPasswordException
from fastapi_users.password import PasswordHelper
from limits.aio.storage import MemoryStorage

from app.application import create_app
from app.core.settings import Settings
from app.features.access.authentication import (
    UserManager,
    access_token_database,
    require_roles,
    user_database,
)
from app.features.access.create_manager import UserCreate
from app.features.access.models import AccessToken, User, UserRole

MANAGER_EMAIL = "gestor@example.com"
TEACHER_EMAIL = "professor@example.com"
PASSWORD = "fictitious-password"
UNREACHABLE_REDIS_URL = "redis://127.0.0.1:1/0"


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


class Service:
    def __init__(self, redis_url: str | None) -> None:
        self.users = InMemoryUserDatabase()
        self.tokens = InMemoryAccessTokenDatabase()
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
        if redis_url is None:
            self.app.state.rate_limit_storage = MemoryStorage()

        @self.app.post("/manager-only", dependencies=[Depends(require_roles(UserRole.MANAGER))])
        def manager_only() -> dict[str, str]:
            return {"reached": "yes"}

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


def test_manager_logs_in_reaches_a_manager_route_and_logs_out(service: Service) -> None:
    service.add_user(MANAGER_EMAIL, UserRole.MANAGER)

    login = service.login(MANAGER_EMAIL, PASSWORD)
    assert login.status_code == 200
    assert login.json()["token_type"] == "bearer"
    session = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert service.client.post("/manager-only", headers=session).status_code == 200

    assert service.client.post("/v1/auth/logout", headers=session).status_code == 204

    ended = service.client.post("/manager-only", headers=session)
    assert ended.status_code == 401
    assert ended.json() == {"detail": "Unauthorized"}


def test_wrong_password_and_unknown_email_get_the_same_answer(service: Service) -> None:
    service.add_user(MANAGER_EMAIL, UserRole.MANAGER)

    wrong_password = service.login(MANAGER_EMAIL, "another-password")
    unknown_email = service.login("ninguem@example.com", PASSWORD)

    for response in (wrong_password, unknown_email):
        assert response.status_code == 400
        assert response.json() == {"detail": "LOGIN_BAD_CREDENTIALS"}


def test_only_health_and_login_answer_without_authentication(service: Service) -> None:
    public_paths = {"/health", "/v1/auth/login"}
    protected_operations = [
        (method, path)
        for path, operations in service.app.openapi()["paths"].items()
        if path not in public_paths
        for method in operations
    ]

    assert protected_operations == [("post", "/v1/auth/logout"), ("post", "/manager-only")]
    for method, path in protected_operations:
        response = service.client.request(method, path)
        assert response.status_code == 401
        assert response.json() == {"detail": "Unauthorized"}


def test_role_outside_the_route_declaration_is_forbidden(service: Service) -> None:
    teacher = service.add_user(TEACHER_EMAIL, UserRole.TEACHER)
    session = service.add_token(teacher, age=timedelta(0))

    for path in ("/manager-only", "/v1/auth/logout"):
        response = service.client.post(path, headers=session)
        assert response.status_code == 403
        assert response.json() == {"detail": "Forbidden"}


def test_token_older_than_eight_hours_is_refused(service: Service) -> None:
    manager = service.add_user(MANAGER_EMAIL, UserRole.MANAGER)
    recent = service.add_token(manager, age=timedelta(hours=7, minutes=59))
    expired = service.add_token(manager, age=timedelta(hours=8, seconds=1))

    assert service.client.post("/manager-only", headers=recent).status_code == 200
    assert service.client.post("/manager-only", headers=expired).status_code == 401


def test_sixth_login_for_the_same_email_is_rate_limited_before_the_credential(service: Service) -> None:
    service.add_user(MANAGER_EMAIL, UserRole.MANAGER)
    for _ in range(5):
        assert service.login(MANAGER_EMAIL, "another-password").status_code == 400

    sixth = service.login(MANAGER_EMAIL.upper(), PASSWORD)

    assert sixth.status_code == 429
    assert sixth.json() == {"detail": "LOGIN_RATE_LIMITED"}
    assert 1 <= int(sixth.headers["Retry-After"]) <= 15 * 60
    assert service.tokens.tokens == {}


def test_login_refuses_an_email_outside_ascii(service: Service) -> None:
    email_with_dotted_capital_i = "gestİr@example.com"
    service.add_user(email_with_dotted_capital_i, UserRole.MANAGER)

    response = service.login(email_with_dotted_capital_i, PASSWORD)

    assert response.status_code == 400
    assert response.json() == {"detail": "LOGIN_BAD_CREDENTIALS"}
    assert service.tokens.tokens == {}


def test_login_is_denied_when_redis_is_unavailable() -> None:
    service = Service(redis_url=UNREACHABLE_REDIS_URL)
    service.add_user(MANAGER_EMAIL, UserRole.MANAGER)

    with service.client:
        response = service.login(MANAGER_EMAIL, PASSWORD)

    assert response.status_code == 503
    assert response.json() == {"detail": "RATE_LIMIT_UNAVAILABLE"}
    assert service.tokens.tokens == {}


def manager_to_create(email: str, password: str) -> UserCreate:
    return UserCreate(email=email, password=password, institution_id=uuid4(), role=UserRole.MANAGER)


def test_manager_password_must_have_between_12_and_128_characters() -> None:
    users = InMemoryUserDatabase()
    user_manager = UserManager(users)

    for password in ("a" * 11, "a" * 129):
        with pytest.raises(InvalidPasswordException) as refusal:
            asyncio.run(user_manager.create(manager_to_create(MANAGER_EMAIL, password)))
        assert refusal.value.reason == "password must have between 12 and 128 characters"
    assert users.users == {}

    asyncio.run(user_manager.create(manager_to_create(MANAGER_EMAIL, "a" * 12)))
    assert len(users.users) == 1
