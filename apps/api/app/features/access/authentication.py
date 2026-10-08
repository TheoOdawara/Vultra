from collections.abc import Callable
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi_users import BaseUserManager, UUIDIDMixin
from fastapi_users.authentication import AuthenticationBackend, Authenticator, BearerTransport
from fastapi_users.authentication.strategy.db import AccessTokenDatabase, DatabaseStrategy
from fastapi_users.db import BaseUserDatabase
from fastapi_users.exceptions import InvalidPasswordException
from fastapi_users.schemas import UC
from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase
from fastapi_users_db_sqlalchemy.access_token import SQLAlchemyAccessTokenDatabase
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import database_session
from app.features.access.models import AccessToken, User, UserRole


def user_database(
    session: Annotated[AsyncSession, Depends(database_session)],
) -> SQLAlchemyUserDatabase[User, UUID]:
    return SQLAlchemyUserDatabase(session, User)


def access_token_database(
    session: Annotated[AsyncSession, Depends(database_session)],
) -> SQLAlchemyAccessTokenDatabase[AccessToken]:
    return SQLAlchemyAccessTokenDatabase(session, AccessToken)


class UserManager(UUIDIDMixin, BaseUserManager[User, UUID]):
    async def validate_password(self, password: str, user: UC | User) -> None:
        if not 12 <= len(password) <= 128:
            raise InvalidPasswordException("password must have between 12 and 128 characters")


def user_manager(
    users: Annotated[BaseUserDatabase[User, UUID], Depends(user_database)],
) -> UserManager:
    return UserManager(users)


def session_strategy(
    access_tokens: Annotated[AccessTokenDatabase[AccessToken], Depends(access_token_database)],
) -> DatabaseStrategy[User, UUID, AccessToken]:
    return DatabaseStrategy(access_tokens, lifetime_seconds=8 * 60 * 60)


authentication_backend = AuthenticationBackend(
    name="database", transport=BearerTransport(tokenUrl="/v1/auth/login"), get_strategy=session_strategy
)
active_user_and_token = Authenticator([authentication_backend], user_manager).current_user_token(active=True)


def require_roles(*roles: UserRole) -> Callable[[tuple[User, str]], User]:
    def user_with_declared_role(
        user_and_token: Annotated[tuple[User, str], Depends(active_user_and_token)],
    ) -> User:
        user, _ = user_and_token
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN)
        return user

    return user_with_declared_role
