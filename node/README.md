# LangGraph Studio (Unofficial), Node edition

Serves the Studio UI and proxies the API of a local LangGraph Agent Server from one
origin, so the browser never makes cross-origin requests.

```bash
npx langgraph-studio-oss --target http://127.0.0.1:2024 --port 8100
# → http://127.0.0.1:8100/studio
```

Requires a running Agent Server (`pip install "langgraph-cli[inmem]"`, then
`langgraph dev` in a project with `langgraph.json`). The target chosen in the
**Connected** dialog is remembered in `~/.config/langgraph-studio-oss/connection.json`.

Not affiliated with, endorsed by, or supported by LangChain, Inc. See the
[project README](https://github.com/azhig/Langgraph-studio-oss) for the Python package
and the VS Code extension. MIT.
