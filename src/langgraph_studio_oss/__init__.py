"""An open alternative to LangSmith Studio.

The UI is mounted into your Agent Server and served on the same port:

    // langgraph.json
    {"http": {"app": "langgraph_studio_oss:app"}}

    $ langgraph dev
    → http://127.0.0.1:2024/studio
"""

from langgraph_studio_oss.app import DEFAULT_PATH, app, mount_studio, studio_routes

__all__ = ["DEFAULT_PATH", "app", "mount_studio", "studio_routes"]
__version__ = "0.1.2"
