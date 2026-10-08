import asyncio
from datetime import timedelta
from uuid import uuid4

import pytest
from conftest import MANAGER_EMAIL, PASSWORD, PERSON, TEACHER_EMAIL, InMemoryUserDatabase, Service
from fastapi_users.exceptions import InvalidPasswordException

from app.features.access.authentication import UserManager
from app.features.access.create_manager import UserCreate
from app.features.access.models import UserRole

UNREACHABLE_REDIS_URL = "redis://127.0.0.1:1/0"


def test_manager_logs_in_reaches_a_manager_route_and_logs_out(service: Service) -> None:
    service.add_user(MANAGER_EMAIL, UserRole.MANAGER)

    login = service.login(MANAGER_EMAIL, PASSWORD)
    assert login.status_code == 200
    assert login.json()["token_type"] == "bearer"
    session = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert service.client.post("/v1/people", headers=session, json=PERSON).status_code == 201

    assert service.client.post("/v1/auth/logout", headers=session).status_code == 204

    ended = service.client.post("/v1/people", headers=session, json=PERSON)
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

    assert protected_operations == [("post", "/v1/auth/logout"), ("post", "/v1/people")]
    for method, path in protected_operations:
        response = service.client.request(method, path, json=PERSON)
        assert response.status_code == 401
        assert response.json() == {"detail": "Unauthorized"}
    assert service.people.people == []


def test_role_outside_the_route_declaration_is_forbidden(service: Service) -> None:
    teacher = service.add_user(TEACHER_EMAIL, UserRole.TEACHER)
    session = service.add_token(teacher, age=timedelta(0))

    for path in ("/v1/people", "/v1/auth/logout"):
        response = service.client.post(path, headers=session, json=PERSON)
        assert response.status_code == 403
        assert response.json() == {"detail": "Forbidden"}
    assert service.people.people == []


def test_token_older_than_eight_hours_is_refused(service: Service) -> None:
    manager = service.add_user(MANAGER_EMAIL, UserRole.MANAGER)
    recent = service.add_token(manager, age=timedelta(hours=7, minutes=59))
    expired = service.add_token(manager, age=timedelta(hours=8, seconds=1))

    assert service.client.post("/v1/people", headers=recent, json=PERSON).status_code == 201
    assert service.client.post("/v1/people", headers=expired, json=PERSON).status_code == 401


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
