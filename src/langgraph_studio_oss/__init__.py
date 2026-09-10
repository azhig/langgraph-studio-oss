"""Открытая альтернатива LangSmith Studio.

Интерфейс монтируется в ваш Agent Server и доступен на том же порту:

    // langgraph.json
    {"http": {"app": "langgraph_studio_oss:app"}}

    $ langgraph dev
    → http://127.0.0.1:2024/studio
"""

from langgraph_studio_oss.app import DEFAULT_PATH, app, mount_studio, studio_routes

__all__ = ["app", "mount_studio", "studio_routes", "DEFAULT_PATH"]
__version__ = "0.1.0"
