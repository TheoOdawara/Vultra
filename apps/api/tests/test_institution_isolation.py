from uuid import UUID, uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from app.core.database import institution_session
from app.features.access.models import Institution
from app.features.registry.models import Person

pytestmark = pytest.mark.anyio


async def institution_with_one_person(engine: AsyncEngine) -> UUID:
    institution_id = uuid4()
    async with AsyncSession(engine) as session, session.begin():
        session.add(Institution(id=institution_id, name="Fictitious Institution"))
    async with institution_session(engine, institution_id) as session:
        session.add(Person(institution_id=institution_id, external_id="2026001234", name="Fictitious Person"))
    return institution_id


async def test_unfiltered_query_and_write_stay_inside_the_session_institution(
    service_engine: AsyncEngine,
) -> None:
    own_institution_id = await institution_with_one_person(service_engine)
    other_institution_id = await institution_with_one_person(service_engine)

    async with institution_session(service_engine, own_institution_id) as session:
        visible_institution_ids = (await session.scalars(select(Person.institution_id))).all()

    assert visible_institution_ids == [own_institution_id]
    with pytest.raises(ProgrammingError, match="row-level security"):
        async with institution_session(service_engine, own_institution_id) as session:
            session.add(
                Person(institution_id=other_institution_id, external_id="2026005678", name="Intruder")
            )


async def test_query_without_institution_context_returns_no_rows(service_engine: AsyncEngine) -> None:
    await institution_with_one_person(service_engine)
    await institution_with_one_person(service_engine)

    async with AsyncSession(service_engine) as session:
        people = (await session.scalars(select(Person))).all()

    assert people == []
