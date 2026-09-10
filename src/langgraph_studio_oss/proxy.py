"""Reverse proxy to the Agent Server for the fallback launch mode.

Needed when `langgraph.json` cannot be edited: a separate process serves the UI at
`/studio` and forwards all other requests to the given server. The browser still
talks to a single origin, so neither cross-origin requests nor `?baseUrl=` arise.

Requirements for the middle layer:
* SSE passes through without buffering and without `Content-Length`;
* pagination headers reach the frontend;
* a client disconnect cancels the upstream request — otherwise `cancel` does not work;
* no timeout on streaming endpoints.
"""

from __future__ import annotations

import contextlib
import json
import os
from collections.abc import AsyncIterator, Iterable
from pathlib import Path
from typing import Any

import httpx
from starlette.applications import Starlette
from starlette.background import BackgroundTask
from starlette.requests import Request
from starlette.responses import JSONResponse, Response, StreamingResponse
from starlette.routing import Route

from langgraph_studio_oss.app import DEFAULT_PATH, studio_routes

#: Headers that must not be forwarded verbatim: they describe the very
#: connection they arrived on and break streaming.
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

PROXIED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]

DEFAULT_TARGET = "http://127.0.0.1:2024"


def state_path() -> Path:
    """File holding the selected proxy target: `$XDG_CONFIG_HOME/langgraph-studio-oss/connection.json`."""
    base = os.environ.get("XDG_CONFIG_HOME") or str(Path.home() / ".config")
    return Path(base) / "langgraph-studio-oss" / "connection.json"


def read_saved_target(path: Path | None = None) -> str | None:
    """Target last selected in the `Connected` dialog; `None` if absent or the file is corrupt."""
    try:
        data = json.loads((path or state_path()).read_text("utf-8"))
        target = data.get("target")
        return str(target).rstrip("/") if target else None
    except (OSError, ValueError, AttributeError):
        return None


def write_saved_target(target: str, path: Path | None = None) -> None:
    """Persists the target across restarts; write errors must not break switching."""
    file = path or state_path()
    with contextlib.suppress(OSError):
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(json.dumps({"target": target}), "utf-8")


def _forward_headers(items: Iterable[tuple[str, str]]) -> list[tuple[str, str]]:
    return [(k, v) for k, v in items if k.lower() not in HOP_BY_HOP]


def create_client(target: str) -> httpx.AsyncClient:
    """Client for the Agent Server. `timeout=None`: streams live as long as the run does."""
    return httpx.AsyncClient(base_url=target.rstrip("/"), timeout=None, follow_redirects=False)


def create_app(
    target: str,
    path: str = DEFAULT_PATH,
    *,
    client: httpx.AsyncClient | None = None,
    state_file: Path | None = None,
) -> Starlette:
    """Application: the UI at `path`, everything else proxied to `target`.

    `client` allows swapping the transport (in tests, an ASGI app instead of the network);
    it is closed together with the application either way. `state_file` is where the
    target selected in the UI is written (`None` — do not persist).
    """
    state = {"target": target.rstrip("/"), "client": client or create_client(target)}

    async def proxy(request: Request) -> StreamingResponse:
        upstream_client: httpx.AsyncClient = state["client"]
        url = httpx.URL(path=request.url.path, query=request.url.query.encode("utf-8"))
        upstream = upstream_client.build_request(
            request.method,
            url,
            headers=_forward_headers(request.headers.items()),
            content=request.stream(),
        )
        response = await upstream_client.send(upstream, stream=True)

        async def body() -> Any:
            try:
                # Chunks are passed through as they arrive: for SSE this is what "no buffering" means
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

    async def connection(request: Request) -> Response:
        """`GET` — current target; `PUT {"target": …}` — switch the proxy to another server.

        The address changes here, on the server: the browser still talks only to its own
        origin, so no cross-origin request arises — that is the point of the proxy.
        """
        if request.method == "GET":
            return JSONResponse({"mode": "proxy", "target": state["target"]})
        body = await request.json()
        new_target = str(body.get("target", "")).strip().rstrip("/")
        parsed = httpx.URL(new_target) if new_target else None
        if parsed is None or parsed.scheme not in ("http", "https") or not parsed.host:
            return JSONResponse({"error": "target must be an http(s) URL"}, status_code=400)
        old: httpx.AsyncClient = state["client"]
        state["client"] = create_client(new_target)
        state["target"] = new_target
        if state_file is not None:
            write_saved_target(new_target, state_file)
        with contextlib.suppress(Exception):
            await old.aclose()
        return JSONResponse({"mode": "proxy", "target": new_target})

    @contextlib.asynccontextmanager
    async def lifespan(_: Starlette) -> AsyncIterator[None]:
        try:
            yield
        finally:
            with contextlib.suppress(Exception):
                await state["client"].aclose()

    mount = "/" + path.strip("/")
    routes = [
        # Before the UI routes: they have their own `GET` for this path in mounted mode
        Route(f"{mount}/api/connection", connection, methods=["GET", "PUT"]),
        *studio_routes(path),
        Route("/{rest:path}", proxy, methods=PROXIED_METHODS),
    ]
    return Starlette(routes=routes, lifespan=lifespan)
