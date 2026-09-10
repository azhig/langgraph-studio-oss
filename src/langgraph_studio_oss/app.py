"""Starlette-приложение, отдающее интерфейс Studio по пути /studio.

Монтируется в Agent Server через `http.app` в langgraph.json, поэтому UI живёт
на том же origin, что и API: браузер обращается к /assistants и /threads
относительными путями, без CORS и без параметра baseUrl.
"""

from __future__ import annotations

import pathlib

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import FileResponse, HTMLResponse, RedirectResponse, Response
from starlette.routing import BaseRoute, Mount, Route
from starlette.staticfiles import StaticFiles

STATIC_DIR = pathlib.Path(__file__).parent / "static"

#: Путь, по которому доступен интерфейс. Меняется через mount_studio(path=...).
DEFAULT_PATH = "/studio"


def _index_response() -> Response:
    index = STATIC_DIR / "index.html"
    if not index.is_file():
        return HTMLResponse(
            "<h1>Сборка фронтенда отсутствует</h1>"
            "<p>Соберите её командой <code>npm run build</code> в каталоге frontend.</p>",
            status_code=501,
        )
    # no-store: при hot reload сервера пользователь должен получать свежую сборку
    return FileResponse(index, headers={"Cache-Control": "no-store"})


async def index(request: Request) -> Response:
    return _index_response()



def _redirect_to_root(path: str):
    """`/studio` и любые вложенные пути → `/studio/?…` с сохранением query.

    Страница собрана с относительными ссылками на ассеты, поэтому должна
    открываться строго по адресу с завершающим слэшем; состояние интерфейса
    живёт в query-параметрах, а не во вложенных путях.
    """

    async def handler(request: Request) -> Response:
        url = f"{path}/"
        if request.url.query:
            url += f"?{request.url.query}"
        return RedirectResponse(url, status_code=307)

    return handler


def studio_routes(path: str = DEFAULT_PATH) -> list[BaseRoute]:
    """Маршруты интерфейса: страница, статика и редиректы на корень."""
    path = "/" + path.strip("/")
    routes: list[BaseRoute] = [
        Route(path, _redirect_to_root(path), methods=["GET"], name="studio"),
        Route(f"{path}/", index, methods=["GET"]),
    ]
    if STATIC_DIR.is_dir():
        routes.append(
            Mount(f"{path}/assets", StaticFiles(directory=STATIC_DIR / "assets", check_dir=False))
        )
    routes.append(Route(f"{path}/{{rest:path}}", _redirect_to_root(path), methods=["GET"]))
    return routes


def mount_studio(app: Starlette, path: str = DEFAULT_PATH) -> Starlette:
    """Добавляет маршруты Studio в существующее Starlette/FastAPI-приложение.

    Нужно, когда в langgraph.json уже указан свой http.app:

        from langgraph_studio_oss import mount_studio
        from my_project.webapp import app
        mount_studio(app)
    """
    existing = {getattr(r, "path", None) for r in app.router.routes}
    normalized = "/" + path.strip("/")
    if normalized in existing:
        raise ValueError(
            f"Путь {normalized} уже занят другим маршрутом. "
            f"Передайте другой: mount_studio(app, path='/lg-studio')"
        )
    app.router.routes.extend(studio_routes(path))
    return app


#: Готовое приложение для langgraph.json: {"http": {"app": "langgraph_studio_oss:app"}}
app = Starlette(routes=studio_routes())
