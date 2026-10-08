from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi_users.authentication.strategy.db import DatabaseStrategy
from fastapi_users.authentication.transport.bearer import BearerResponse

from app.features.access.authentication import (
    UserManager,
    active_user_and_token,
    authentication_backend,
    require_roles,
    session_strategy,
    user_manager,
)
from app.features.access.login_quota import enforce_login_quota
from app.features.access.models import AccessToken, User, UserRole

router = APIRouter(prefix="/v1/auth", tags=["auth"])

SessionStrategy = Annotated[DatabaseStrategy[User, UUID, AccessToken], Depends(session_strategy)]


@router.post("/login", response_model=BearerResponse, dependencies=[Depends(enforce_login_quota)])
async def login(
    credentials: Annotated[OAuth2PasswordRequestForm, Depends()],
    users: Annotated[UserManager, Depends(user_manager)],
    strategy: SessionStrategy,
) -> Response:
    user = await users.authenticate(credentials)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "LOGIN_BAD_CREDENTIALS")
    return await authentication_backend.login(strategy, user)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(UserRole.MANAGER))],
)
async def logout(
    user_and_token: Annotated[tuple[User, str], Depends(active_user_and_token)],
    strategy: SessionStrategy,
) -> Response:
    user, token = user_and_token
    return await authentication_backend.logout(strategy, user, token)
