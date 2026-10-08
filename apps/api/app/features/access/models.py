import enum
from datetime import datetime
from uuid import UUID, uuid4

from fastapi_users_db_sqlalchemy import SQLAlchemyBaseUserTableUUID
from fastapi_users_db_sqlalchemy.access_token import SQLAlchemyBaseAccessTokenTableUUID
from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class UserRole(enum.StrEnum):
    MANAGER = "manager"
    TEACHER = "teacher"


class Institution(Base):
    __tablename__ = "institution"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class User(SQLAlchemyBaseUserTableUUID, Base):
    institution_id: Mapped[UUID] = mapped_column(ForeignKey("institution.id"))
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", values_callable=lambda roles: [role.value for role in roles])
    )


class AccessToken(SQLAlchemyBaseAccessTokenTableUUID, Base):
    pass
