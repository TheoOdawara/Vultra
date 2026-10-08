from datetime import datetime, timedelta

from conftest import MANAGER_EMAIL, PERSON, Service

from app.features.access.models import UserRole

OTHER_MANAGER_EMAIL = "outra-gestora@example.com"


def test_manager_creates_a_person_in_their_own_institution(service: Service) -> None:
    manager = service.add_user(MANAGER_EMAIL, UserRole.MANAGER)
    session = service.add_token(manager, age=timedelta(0))

    response = service.client.post(
        "/v1/people", headers=session, json={"external_id": " 2026001234 ", "name": " Pessoa de Exemplo "}
    )

    assert response.status_code == 201
    [person] = service.people.people
    created = response.json()
    assert created.keys() == {"id", "external_id", "name", "created_at"}
    assert created["id"] == str(person.id)
    assert (created["external_id"], created["name"]) == ("2026001234", "Pessoa de Exemplo")
    assert datetime.fromisoformat(created["created_at"]) == person.created_at
    assert person.institution_id == manager.institution_id


def test_external_id_is_unique_inside_an_institution_and_free_in_another(service: Service) -> None:
    manager = service.add_user(MANAGER_EMAIL, UserRole.MANAGER)
    other_manager = service.add_user(OTHER_MANAGER_EMAIL, UserRole.MANAGER)
    session = service.add_token(manager, age=timedelta(0))
    other_session = service.add_token(other_manager, age=timedelta(0))
    assert service.client.post("/v1/people", headers=session, json=PERSON).status_code == 201

    repeated = service.client.post("/v1/people", headers=session, json=PERSON)
    in_another_institution = service.client.post("/v1/people", headers=other_session, json=PERSON)

    assert repeated.status_code == 409
    assert repeated.json() == {"detail": "PERSON_EXTERNAL_ID_ALREADY_EXISTS"}
    assert in_another_institution.status_code == 201
    assert [person.institution_id for person in service.people.people] == [
        manager.institution_id,
        other_manager.institution_id,
    ]


def test_person_outside_the_validation_is_refused(service: Service) -> None:
    manager = service.add_user(MANAGER_EMAIL, UserRole.MANAGER)
    session = service.add_token(manager, age=timedelta(0))

    for body in (
        {**PERSON, "name": " "},
        {**PERSON, "name": "a" * 201},
        {**PERSON, "external_id": " "},
        {**PERSON, "external_id": "a" * 65},
    ):
        assert service.client.post("/v1/people", headers=session, json=body).status_code == 422
    assert service.people.people == []
