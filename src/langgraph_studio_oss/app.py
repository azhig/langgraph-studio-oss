"""Starlette application serving the Studio UI at /studio.

Mounted into the Agent Server via `http.app` in langgraph.json, so the UI lives
on the same origin as the API: the browser reaches /assistants and /threads
with relative paths, without CORS and without a baseUrl parameter.
"""

from __future__ import annotations

import pathlib

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse, Response
from starlette.routing import BaseRoute, Mount, Route
from starlette.staticfiles import StaticFiles

STATIC_DIR = pathlib.Path(__file__).parent / "static"

#: Path at which the UI is served. Changed via mount_studio(path=...).
DEFAULT_PATH = "/studio"

_MISSING_BUILD = (
    "<h1>Frontend build is missing</h1>"
    "<p>Run <code>pnpm build</code> in the <code>frontend</code> directory.</p>"
)


def _normalize(path: str) -> str:
    return "/" + path.strip("/")


async def index(request: Request) -> Response:
    """The UI page; without a build, a clear error instead of a 404."""
    index_file = STATIC_DIR / "index.html"
    if not index_file.is_file():
        return HTMLResponse(_MISSING_BUILD, status_code=501)
    # no-store: after a server hot reload the user must get the fresh build
    return FileResponse(index_file, headers={"Cache-Control": "no-store"})


async def connection_info(request: Request) -> Response:
    """How the UI is connected to the Agent Server.

    In mounted mode the server is the same process, there is no address to change; in
    proxy mode (`proxy.py`) this route is overridden and accepts a new target.
    """
    return JSONResponse({"mode": "mounted", "target": None})


def _redirect_to_root(path: str):
    """`/studio` and any nested paths → `/studio/?…`, preserving the query.

    The page is built with relative asset links, so it must be opened strictly
    at the address with a trailing slash; UI state lives in query parameters,
    not in nested paths.
    """

    async def handler(request: Request) -> Response:
        url = f"{path}/"
        if request.url.query:
            url += f"?{request.url.query}"
        return RedirectResponse(url, status_code=307)

    return handler


def studio_routes(path: str = DEFAULT_PATH) -> list[BaseRoute]:
    """UI routes: the page, static assets and redirects to the root."""
    path = _normalize(path)
    routes: list[BaseRoute] = [
        Route(path, _redirect_to_root(path), methods=["GET"], name="studio"),
        Route(f"{path}/", index, methods=["GET"]),
        Route(f"{path}/api/connection", connection_info, methods=["GET"]),
    ]
    if STATIC_DIR.is_dir():
        routes.append(Mount(f"{path}/assets", StaticFiles(directory=STATIC_DIR / "assets", check_dir=False)))
    routes.append(Route(f"{path}/{{rest:path}}", _redirect_to_root(path), methods=["GET"]))
    return routes


def mount_studio(app: Starlette, path: str = DEFAULT_PATH) -> Starlette:
    """Adds the Studio routes to an existing Starlette/FastAPI application.

    Needed when langgraph.json already specifies its own http.app:

        from langgraph_studio_oss import mount_studio
        from my_project.webapp import app
        mount_studio(app)
    """
    normalized = _normalize(path)
    existing = {getattr(r, "path", None) for r in app.router.routes}
    if normalized in existing:
        raise ValueError(
            f"Path {normalized} is already taken by another route. "
            f"Pass a different one: mount_studio(app, path='/lg-studio')"
        )
    app.router.routes.extend(studio_routes(normalized))
    return app


#: Ready-made application for langgraph.json: {"http": {"app": "langgraph_studio_oss:app"}}
app = Starlette(routes=studio_routes())
