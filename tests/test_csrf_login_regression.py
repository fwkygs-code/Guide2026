import inspect
from typing import Any, Dict

import pytest
from fastapi import APIRouter
from fastapi.testclient import TestClient

import server as server_module


def _ensure_test_route_registered() -> None:
    path = "/api/csrf-regression-check"
    if any(getattr(route, "path", None) == path for route in server_module.app.router.routes):
        return

    test_router = APIRouter()

    @test_router.post(path)
    async def csrf_regression_check(payload: Dict[str, Any]):
        return {"received": payload}

    server_module.app.include_router(test_router)


_ensure_test_route_registered()


@pytest.fixture
def client():
    with TestClient(server_module.app) as test_client:
        yield test_client


def test_login_without_csrf_returns_401(monkeypatch, client):
    class FakeUsersCollection:
        async def find_one(self, *args, **kwargs):
            return None

    monkeypatch.setattr(server_module.db, "users", FakeUsersCollection())

    response = client.post(
        "/api/auth/login",
        json={"email": "nope@example.com", "password": "bad-pass"}
    )

    assert response.status_code == 401
    assert response.status_code != 500
    assert "detail" in response.json()


def test_protected_post_without_csrf_returns_403(client):
    token, _csrf_token = server_module.create_token("user-123")
    client.cookies.set("ig_access_token", token, domain="testserver", path="/")

    response = client.post("/api/csrf-regression-check", json={"foo": "bar"})

    assert response.status_code == 403
    assert response.status_code != 500
    assert response.json()["detail"] == "Missing CSRF token"
