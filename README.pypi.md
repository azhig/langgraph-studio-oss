# LangGraph Studio (Unofficial)

[![PyPI](https://img.shields.io/pypi/v/langgraph-studio-oss)](https://pypi.org/project/langgraph-studio-oss/)
[![Python 3.9+](https://img.shields.io/pypi/pyversions/langgraph-studio-oss)](https://pypi.org/project/langgraph-studio-oss/)
[![CI](https://img.shields.io/github/actions/workflow/status/azhig/langgraph-studio-oss/ci.yml?branch=main&label=CI)](https://github.com/azhig/langgraph-studio-oss/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/azhig/langgraph-studio-oss/blob/main/LICENSE)

A self-hosted Studio for [LangGraph](https://github.com/langchain-ai/langgraph) Agent
Servers: the graph view, thread log, time travel, interrupts, assistants, memory and chat
mode of the hosted Studio, served by your own server on the same port. No cloud account,
no `?baseUrl=`, no cross-origin requests.

![Submitting input, watching a tool-calling run stream its reply, then the same thread in Chat mode](https://raw.githubusercontent.com/azhig/langgraph-studio-oss/main/docs/demo.gif)

> **Unofficial.** This project is not affiliated with, endorsed by, or sponsored by
> LangChain, Inc. LangGraph, LangChain and LangSmith are trademarks of LangChain, Inc.,
> used here only to describe compatibility. The UI is written from scratch and contains
> no code from the original Studio.

## Install

```bash
pip install langgraph-studio-oss
```

Python 3.9+ and a LangGraph Agent Server: `langgraph dev` from `langgraph-cli[inmem]`, or
any server exposing the Agent Server API 0.4 or newer.

## Mode 1: mounted into `langgraph dev` (recommended)

The UI is served by the Agent Server itself, on the same port. Add one line to your
project's `langgraph.json`:

```json
{
  "dependencies": ["."],
  "graphs": { "agent": "./agent.py:graph" },
  "http": { "app": "langgraph_studio_oss:app" }
}
```

Run `langgraph dev` and open <http://127.0.0.1:2024/studio>. The API stays where it was
(`/assistants`, `/threads`, ...); the UI calls it with relative paths.

If you already have a custom `http.app`, mount the routes into it instead:

```python
from langgraph_studio_oss import mount_studio
from my_project.webapp import app

mount_studio(app)                      # adds /studio to an existing Starlette or FastAPI app
mount_studio(app, path="/lg-studio")   # or at another path
```

`mount_studio` raises `ValueError` if the path is already taken by another route.

## Mode 2: standalone proxy

When `langgraph.json` cannot be changed, run the UI as its own process. It serves the
page and forwards every other request to the Agent Server, so the browser still sees a
single origin.

```bash
langgraph-studio-oss --target http://127.0.0.1:2024 --port 8100
# → http://127.0.0.1:8100/studio
```

| Flag | Default | Meaning |
|---|---|---|
| `--target` | last saved target, else `http://127.0.0.1:2024` | Agent Server base URL |
| `--host` | `127.0.0.1` | Interface to listen on |
| `--port` | `8100` | Port for the UI |
| `--path` | `/studio` | Path the UI is served at |

The proxy streams Server-Sent Events without buffering, forwards pagination headers,
cancels the upstream request when the browser disconnects, and has no timeout on
streaming endpoints.

## What you get

- **Graph**: the same auto-layout as the original, conditional edges, subgraphs (nested
  ones too) that expand and collapse, drag, zoom, minimap, hover cards with sources,
  targets and interrupt toggles; the running node lights up, and a run inside a subgraph
  opens it for as long as it is there.
- **Runs**: input form generated from `input_schema` (YAML/JSON editors, a message
  builder for `messages`), replies typed out live as the model streams them, `Cancel`,
  input history, a stream-mode toggle.
- **Thread log**: a detail slider from a turn summary down to every value, checkpoint
  rows with `View state` (values, JSON, full editor), subgraph steps inside their record,
  tool calls as tables and tool results as trees, log following during a run.
- **Time travel**: `Re-run from here`, `Fork` (edit a node's state and continue), branch
  switching, error blocks with `Continue`.
- **Interrupts**: static `Before` / `After` on any node, `Interrupt on all`, replying to
  dynamic `interrupt()` calls, writing values `As Node`.
- **Assistants**: `Manage Assistants` with versions, `config_schema` fields, per-node
  configuration, graph switching; a graph without a `config_schema` gets a raw
  `config.configurable` editor.
- **Chat mode** for graphs with typed `messages`: streaming replies, a threads panel,
  tool calls behind a `Show tool calls` switch, edit and regenerate.
- **Memory**: browse, create, edit and delete Store items by namespace.
- Light and dark themes. Every size, color and delay was measured on the original Studio.

Not included, by design: `Trace`, `Run experiment` and `Deploy` — they need LangSmith or
the cloud platform, which this project does not use.

## Connection settings

Click **Connected** in the header to open *Configure Studio connection*:

- **Base URL** — editable in proxy mode: `Connect` switches the proxy to the new server
  and remembers it in `~/.config/langgraph-studio-oss/connection.json` (respects
  `XDG_CONFIG_HOME`). An explicit `--target` on the command line overrides and replaces
  the saved value. In mounted mode the address is fixed, because the page is served by
  the server itself.
- **Custom headers** — name/value pairs sent with every request, for servers behind
  authentication. Stored in the browser only.

The current mode is exposed at `GET <path>/api/connection`; the proxy also accepts
`PUT <path>/api/connection` with `{"target": "http://host:port"}`.

## What is persisted where

| Setting | Where |
|---|---|
| Theme, split position, log detail level, `View Raw` | browser `localStorage` |
| Interrupts (`before` / `after`) and manual node positions | `localStorage`, per assistant, same keys as the original Studio |
| Custom headers | `localStorage` (`studio.headers`) |
| Proxy target | `~/.config/langgraph-studio-oss/connection.json` |
| Assistant, mode and thread | URL query (`assistantId`, `mode`, `threadId`), so links can be shared |

## Also available as

- a **Node proxy** with no Python at all — [`langgraph-studio-oss` on npm](https://www.npmjs.com/package/langgraph-studio-oss);
- a **VS Code extension** — *LangGraph Studio (Unofficial)* on the Visual Studio Marketplace.

Source, issues and the measured design notes: <https://github.com/azhig/langgraph-studio-oss>.

## License

MIT.
