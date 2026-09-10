"""Проверки маршрутов интерфейса: страница, статика и редиректы."""

from __future__ import annotations

from starlette.applications import Starlette
from starlette.responses import PlainTextResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from langgraph_studio_oss import app, mount_studio
from langgraph_studio_oss.app import studio_routes


def test_index_served_at_studio_root() -> None:
    client = TestClient(app)
    response = client.get("/studio/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    # Свежая сборка после hot reload не должна кэшироваться
    assert response.headers["cache-control"] == "no-store"


def test_studio_without_slash_redirects_and_keeps_query() -> None:
    client = TestClient(app)
    response = client.get("/studio?assistantId=abc&mode=graph", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "/studio/?assistantId=abc&mode=graph"


def test_nested_path_returns_to_root() -> None:
    client = TestClient(app)
    response = client.get("/studio/threads/42", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "/studio/"


def test_mount_studio_keeps_existing_routes() -> None:
    host = Starlette(routes=[Route("/health", lambda request: PlainTextResponse("ok"))])
    mount_studio(host)
    client = TestClient(host)
    assert client.get("/health").text == "ok"
    assert client.get("/studio/").status_code == 200


def test_mount_studio_refuses_busy_path() -> None:
    host = Starlette(routes=[Route("/studio", lambda request: PlainTextResponse("own"))])
    try:
        mount_studio(host)
    except ValueError as error:
        assert "/studio" in str(error)
    else:  # pragma: no cover - ошибка обязана возникнуть
        raise AssertionError("занятый путь должен приводить к ValueError")


def test_custom_path() -> None:
    host = Starlette(routes=studio_routes("/lg-studio"))
    client = TestClient(host)
    assert client.get("/lg-studio/").status_code == 200
    assert client.get("/lg-studio", follow_redirects=False).headers["location"] == "/lg-studio/"
