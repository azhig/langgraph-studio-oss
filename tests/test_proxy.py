"""Проверки обратного прокси: заголовки, тело запроса и потоковая передача."""

from __future__ import annotations

import asyncio

import httpx
from starlette.applications import Starlette
from starlette.responses import JSONResponse, StreamingResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from langgraph_studio_oss.proxy import create_app


def upstream_app() -> Starlette:
    """Мини-сервер вместо Agent Server: отдаёт JSON, SSE и эхо запроса."""

    async def assistants(request):
        return JSONResponse(
            [{"assistant_id": "a1"}],
            headers={"x-pagination-total": "1", "x-pagination-next": "2"},
        )

    async def stream(request):
        async def events():
            for i in range(3):
                yield f"event: values\ndata: {i}\n\n".encode()
                await asyncio.sleep(0)

        return StreamingResponse(events(), media_type="text/event-stream")

    async def echo(request):
        body = await request.body()
        return JSONResponse({"method": request.method, "body": body.decode(), "query": request.url.query})

    return Starlette(
        routes=[
            Route("/assistants/search", assistants, methods=["POST"]),
            Route("/threads/1/runs/stream", stream, methods=["POST"]),
            Route("/echo", echo, methods=["GET", "POST"]),
        ]
    )


def test_studio_page_served_by_proxy() -> None:
    with TestClient(create_app("http://127.0.0.1:2024")) as client:
        assert client.get("/studio/").status_code == 200


def test_pagination_headers_pass_through() -> None:
    proxy = create_app("http://upstream")
    _use_asgi_upstream(proxy)
    with TestClient(proxy) as client:
        response = client.post("/assistants/search", json={"limit": 1})
        assert response.status_code == 200
        assert response.json() == [{"assistant_id": "a1"}]
        assert response.headers["x-pagination-total"] == "1"
        assert response.headers["x-pagination-next"] == "2"


def test_sse_is_not_buffered() -> None:
    proxy = create_app("http://upstream")
    _use_asgi_upstream(proxy)
    with TestClient(proxy) as client:
        with client.stream("POST", "/threads/1/runs/stream", json={}) as response:
            assert response.status_code == 200
            assert response.headers["content-type"].startswith("text/event-stream")
            # Длину потока заранее знать нельзя — заголовка быть не должно
            assert "content-length" not in response.headers
            chunks = [chunk for chunk in response.iter_raw() if chunk]
    assert b"event: values" in b"".join(chunks)


def test_method_body_and_query_forwarded() -> None:
    proxy = create_app("http://upstream")
    _use_asgi_upstream(proxy)
    with TestClient(proxy) as client:
        response = client.post("/echo?limit=5", content=b"hello")
        assert response.json() == {"method": "POST", "body": "hello", "query": "limit=5"}


def _use_asgi_upstream(proxy: Starlette) -> None:
    """Заменяет транспорт httpx-клиента прокси на ASGI-приложение теста."""
    for route in proxy.routes:
        handler = getattr(route, "endpoint", None)
        closure = getattr(handler, "__closure__", None) or ()
        for cell in closure:
            if isinstance(cell.cell_contents, httpx.AsyncClient):
                cell.cell_contents._transport = httpx.ASGITransport(app=upstream_app())
                return
    raise AssertionError("не найден httpx-клиент прокси")
