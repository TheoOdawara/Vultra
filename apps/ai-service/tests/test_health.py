"""
Smoke tests — GET /health endpoint.
"""


def test_health_returns_200(client):
    response = client.get("/health")
    assert response.status_code == 200


def test_health_schema(client):
    data = response = client.get("/health")
    data = response.json()

    assert data["status"] in {"ok", "degraded"}
    assert isinstance(data["model"], str)
    assert isinstance(data["uptime_s"], int)
    assert data["uptime_s"] >= 0


def test_health_status_ok_when_model_ready(client, face_service_mock):
    face_service_mock.is_ready.return_value = True
    response = client.get("/health")
    assert response.json()["status"] == "ok"


def test_health_status_degraded_when_model_not_ready(client, face_service_mock):
    face_service_mock.is_ready.return_value = False
    try:
        response = client.get("/health")
        assert response.json()["status"] == "degraded"
    finally:
        face_service_mock.is_ready.return_value = True  # restore


def test_health_does_not_expose_infrastructure_details(client):
    """Health endpoint must not leak Redis URL, passwords, or internal config."""
    response = client.get("/health")
    body = response.text.lower()
    for sensitive in ("redis", "password", "secret", "localhost", "127.0.0.1"):
        assert sensitive not in body, f"Sensitive detail '{sensitive}' leaked in health response"
