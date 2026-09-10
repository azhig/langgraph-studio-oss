"""Обратный прокси к Agent Server для запасного режима запуска.

Нужен, когда `langgraph.json` править нельзя: свой процесс отдаёт интерфейс по
`/studio` и переправляет остальные запросы на указанный сервер. Браузер при этом
по-прежнему ходит на один origin, поэтому cross-origin и `?baseUrl=` не возникают.

Требования к прослойке (docs/REQUIREMENTS.md, 2.2):
* SSE идёт без буферизации и без `Content-Length`;
* заголовки пагинации доходят до фронта;
* разрыв соединения клиентом отменяет запрос к серверу — иначе не работает `cancel`;
* на потоковых эндпоинтах нет таймаута.
"""

from __future__ import annotations

import contextlib
from collections.abc import AsyncIterator, Iterable
from typing import Any

import httpx
from starlette.applications import Starlette
from starlette.background import BackgroundTask
from starlette.requests import Request
from starlette.responses import StreamingResponse
from starlette.routing import Route

from langgraph_studio_oss.app import DEFAULT_PATH, studio_routes

#: Заголовки, которые нельзя переносить дословно: они описывают именно то
#: соединение, в котором пришли, и ломают потоковую передачу.
HOP_BY_HOP = frozenset(
    {
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailer",
        "transfer-encoding",
        "upgrade",
        "content-length",
        "content-encoding",
        "host",
    }
)


def _forward_headers(items: Iterable[tuple[str, str]]) -> list[tuple[str, str]]:
    return [(k, v) for k, v in items if k.lower() not in HOP_BY_HOP]


def create_app(target: str, path: str = DEFAULT_PATH) -> Starlette:
    """Приложение: интерфейс на `path`, всё остальное — прокси на `target`."""
    base = target.rstrip("/")
    # timeout=None: стримы живут столько, сколько идёт прогон
    client = httpx.AsyncClient(base_url=base, timeout=None, follow_redirects=False)

    async def proxy(request: Request) -> StreamingResponse:
        url = httpx.URL(path=request.url.path, query=request.url.query.encode("utf-8"))
        upstream = client.build_request(
            request.method,
            url,
            headers=_forward_headers(request.headers.items()),
            content=request.stream(),
        )
        response = await client.send(upstream, stream=True)

        async def body() -> Any:
            try:
                # Куски отдаём как пришли: для SSE это и есть отсутствие буферизации
                async for chunk in response.aiter_raw():
                    yield chunk
            finally:
                await response.aclose()

        return StreamingResponse(
            body(),
            status_code=response.status_code,
            headers=dict(_forward_headers(response.headers.items())),
            background=BackgroundTask(response.aclose),
        )

    @contextlib.asynccontextmanager
    async def lifespan(_: Starlette) -> AsyncIterator[None]:
        try:
            yield
        finally:
            with contextlib.suppress(Exception):
                await client.aclose()

    routes = [
        *studio_routes(path),
        Route("/{rest:path}", proxy, methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]),
    ]
    return Starlette(routes=routes, lifespan=lifespan)
