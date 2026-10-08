from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.access.authentication import active_user_and_token, require_roles, user_institution_session
from app.features.access.models import User, UserRole
from app.features.registry.models import Person
from app.features.registry.schemas import PersonCreate, PersonRead

router = APIRouter(
    prefix="/v1/people", tags=["people"], dependencies=[Depends(require_roles(UserRole.MANAGER))]
)


@router.post("", response_model=PersonRead, status_code=status.HTTP_201_CREATED)
async def create_person(
    person_to_create: PersonCreate,
    user_and_token: Annotated[tuple[User, str], Depends(active_user_and_token)],
    session: Annotated[AsyncSession, Depends(user_institution_session, scope="function")],
) -> Person:
    manager, _ = user_and_token
    person = Person(
        institution_id=manager.institution_id,
        external_id=person_to_create.external_id,
        name=person_to_create.name,
    )
    session.add(person)
    try:
        await session.flush()
    except IntegrityError as refusal:
        raise HTTPException(status.HTTP_409_CONFLICT, "PERSON_EXTERNAL_ID_ALREADY_EXISTS") from refusal
    return person
