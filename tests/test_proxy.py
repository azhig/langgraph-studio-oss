"""Tests for the reverse proxy: headers, request body and streaming."""

from __future__ import annotations

import asyncio

import httpx
import pytest
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse, Response, StreamingResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from langgraph_studio_oss.proxy import create_app


def upstream_app() -> Starlette:
    """Mini server standing in for the Agent Server: serves JSON, SSE and a request echo."""

    async def assistants(request: Request) -> Response:
        return JSONResponse(
            [{"assistant_id": "a1"}],
            headers={"x-pagination-total": "1", "x-pagination-next": "2"},
        )

    async def stream(request: Request) -> Response:
        async def events():
            for i in range(3):
                yield f"event: values\ndata: {i}\n\n".encode()
                await asyncio.sleep(0)

        return StreamingResponse(events(), media_type="text/event-stream")

    async def echo(request: Request) -> Response:
        body = await request.body()
        return JSONResponse({"method": request.method, "body": body.decode(), "query": request.url.query})

    return Starlette(
        routes=[
            Route("/assistants/search", assistants, methods=["POST"]),
            Route("/threads/1/runs/stream", stream, methods=["POST"]),
            Route("/echo", echo, methods=["GET", "POST"]),
        ]
    )


@pytest.fixture
def client() -> TestClient:
    """Proxy whose client talks to the test ASGI app instead of the network."""
    upstream = httpx.AsyncClient(
        base_url="http://upstream",
        timeout=None,
        transport=httpx.ASGITransport(app=upstream_app()),
    )
    with TestClient(create_app("http://upstream", client=upstream)) as test_client:
        yield test_client


def test_studio_page_served_by_proxy(client: TestClient) -> None:
    assert client.get("/studio/").status_code == 200


def test_pagination_headers_pass_through(client: TestClient) -> None:
    response = client.post("/assistants/search", json={"limit": 1})
    assert response.status_code == 200
    assert response.json() == [{"assistant_id": "a1"}]
    assert response.headers["x-pagination-total"] == "1"
    assert response.headers["x-pagination-next"] == "2"


def test_sse_is_not_buffered(client: TestClient) -> None:
    with client.stream("POST", "/threads/1/runs/stream", json={}) as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        # The stream length cannot be known in advance — the header must be absent
        assert "content-length" not in response.headers
        chunks = [chunk for chunk in response.iter_raw() if chunk]
    assert b"event: values" in b"".join(chunks)


def test_connection_target_can_be_switched(client: TestClient) -> None:
    assert client.get("/studio/api/connection").json() == {"mode": "proxy", "target": "http://upstream"}
    bad = client.put("/studio/api/connection", json={"target": "not a url"})
    assert bad.status_code == 400
    ok = client.put("/studio/api/connection", json={"target": "http://other:2024/"})
    assert ok.json() == {"mode": "proxy", "target": "http://other:2024"}
    assert client.get("/studio/api/connection").json()["target"] == "http://other:2024"


def test_target_is_persisted(tmp_path) -> None:
    from langgraph_studio_oss.proxy import read_saved_target

    state = tmp_path / "connection.json"
    with TestClient(create_app("http://upstream", state_file=state)) as client:
        client.put("/studio/api/connection", json={"target": "http://other:2024"})
    assert read_saved_target(state) == "http://other:2024"
    assert read_saved_target(tmp_path / "missing.json") is None


def test_method_body_and_query_forwarded(client: TestClient) -> None:
    response = client.post("/echo?limit=5", content=b"hello")
    assert response.json() == {"method": "POST", "body": "hello", "query": "limit=5"}
