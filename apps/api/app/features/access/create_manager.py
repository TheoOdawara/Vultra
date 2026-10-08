import argparse
import asyncio
import getpass
from uuid import UUID, uuid4

from fastapi_users.exceptions import InvalidPasswordException, UserAlreadyExists
from fastapi_users.schemas import BaseUserCreate
from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import create_engine
from app.core.settings import Settings
from app.features.access.authentication import UserManager
from app.features.access.models import Institution, User, UserRole


class UserCreate(BaseUserCreate):
    institution_id: UUID
    role: UserRole


async def create_manager(settings: Settings, institution_name: str, email: str, password: str) -> str:
    engine = create_engine(settings)
    try:
        async with AsyncSession(engine, expire_on_commit=False) as session:
            institution = Institution(id=uuid4(), name=institution_name)
            session.add(institution)
            await session.flush()
            manager = await UserManager(SQLAlchemyUserDatabase(session, User)).create(
                UserCreate(
                    email=email, password=password, institution_id=institution.id, role=UserRole.MANAGER
                )
            )
    finally:
        await engine.dispose()
    return f"manager created: {manager.email} (institution {institution.id})"


def main() -> None:
    parser = argparse.ArgumentParser(prog="create-manager")
    parser.add_argument("--institution-name", required=True)
    parser.add_argument("--email", required=True)
    arguments = parser.parse_args()
    if not 1 <= len(arguments.institution_name) <= 200:
        parser.error("institution name must have between 1 and 200 characters")
    if not arguments.email.isascii():
        parser.error("email must have only ASCII characters")
    settings = Settings()
    password = getpass.getpass("password: ")
    try:
        created = asyncio.run(
            create_manager(settings, arguments.institution_name, arguments.email, password),
            loop_factory=asyncio.SelectorEventLoop,
        )
    except InvalidPasswordException as refusal:
        raise SystemExit(refusal.reason) from refusal
    except UserAlreadyExists as refusal:
        raise SystemExit("email already registered") from refusal
    except ValidationError as refusal:
        raise SystemExit("invalid email") from refusal
    print(created)
