import hashlib
import math
import time
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from limits import RateLimitItemPerMinute
from limits.aio.strategies import FixedWindowRateLimiter
from limits.errors import StorageError


async def enforce_login_quota(
    request: Request, credentials: Annotated[OAuth2PasswordRequestForm, Depends()]
) -> None:
    if request.client is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "RATE_LIMIT_UNAVAILABLE")
    # ponytail: ASCII-only e-mails, because PostgreSQL and Python lowercase other letters differently
    # and one account would get several quota keys; accept them when the key is lowercased by the database
    if not credentials.username.isascii():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "LOGIN_BAD_CREDENTIALS")
    email_digest = hashlib.sha256(credentials.username.lower().encode()).hexdigest()
    limiter = FixedWindowRateLimiter(request.app.state.rate_limit_storage)
    try:
        for limit, identifier in (
            (RateLimitItemPerMinute(5, 15, namespace="login-email"), email_digest),
            (RateLimitItemPerMinute(20, 15, namespace="login-ip"), request.client.host),
        ):
            if not await limiter.hit(limit, identifier):
                window = await limiter.get_window_stats(limit, identifier)
                retry_after_seconds = max(1, math.ceil(window.reset_time - time.time()))
                raise HTTPException(
                    status.HTTP_429_TOO_MANY_REQUESTS,
                    "LOGIN_RATE_LIMITED",
                    headers={"Retry-After": str(retry_after_seconds)},
                )
    except StorageError as error:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "RATE_LIMIT_UNAVAILABLE") from error
