# LangGraph Studio (Unofficial)

[![CI](https://img.shields.io/github/actions/workflow/status/azhig/langgraph-studio-oss/ci.yml?branch=main&label=CI)](https://github.com/azhig/langgraph-studio-oss/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/azhig/langgraph-studio-oss?include_prereleases)](https://github.com/azhig/langgraph-studio-oss/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Python 3.9+](https://img.shields.io/badge/python-3.9%2B-blue)
![Node 18+](https://img.shields.io/badge/node-18%2B-339933)
![VS Code 1.95+](https://img.shields.io/badge/VS%20Code-1.95%2B-007ACC)

An open-source, self-hosted Studio for [LangGraph](https://github.com/langchain-ai/langgraph)
Agent Servers. It gives you the graph view, thread log, time travel, interrupts,
assistants, memory and chat mode of the hosted Studio, but runs entirely against your own
server: no cloud, no account, no `?baseUrl=` and no cross-origin requests.

![Submitting input, watching a tool-calling run stream its reply, then the same thread in Chat mode](https://raw.githubusercontent.com/azhig/langgraph-studio-oss/main/docs/demo.gif)

> **Unofficial.** This project is not affiliated with, endorsed by, or sponsored by
> LangChain, Inc. LangGraph, LangChain and LangSmith are trademarks of LangChain, Inc.,
> used here only to describe compatibility. The UI is written from scratch and contains
> no code from the original Studio.

## Pick a flavour

One UI, three ways to run it. Each has its own README written for its home:

| Flavour | Install | Details |
|---|---|---|
| **Python package** — mounted into `langgraph dev` on the same port, or a standalone proxy | `pip install langgraph-studio-oss` | [README.pypi.md](README.pypi.md) |
| **Node proxy** — the same proxy without Python | `npm install -g langgraph-studio-oss` | [node/README.md](node/README.md) |
| **VS Code extension** — the Studio as an editor panel | *LangGraph Studio (Unofficial)* on the Marketplace | [vscode/README.md](vscode/README.md) |

Every build is also attached to the [latest GitHub release](https://github.com/azhig/langgraph-studio-oss/releases/latest):
the wheel and sdist, the npm tarball and the `.vsix`.

## Why

The hosted Studio at `smith.langchain.com` talks to your local server from the outside.
That means CORS errors against `http://127.0.0.1`, a mandatory LangSmith account, and a
tunnel allowlist to fight when you work around it. Serving the UI from the same origin as
the API removes all of that.

## Quick start

```bash
pip install langgraph-studio-oss
```

Add one line to your project's `langgraph.json` and run `langgraph dev`:

```json
{
  "dependencies": ["."],
  "graphs": { "agent": "./agent.py:graph" },
  "http": { "app": "langgraph_studio_oss:app" }
}
```

The Studio is at <http://127.0.0.1:2024/studio>; the API stays where it was. When
`langgraph.json` cannot be changed, run the proxy instead — `langgraph-studio-oss
--target http://127.0.0.1:2024 --port 8100` (Python or Node) — and open
<http://127.0.0.1:8100/studio>.

## Features

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
- **Connection dialog**: switch the proxy target, add custom headers for servers behind
  authentication.
- Light and dark themes. Every size, color and delay was measured on the original Studio;
  the numbers are in [docs/DESIGN-TOKENS.md](docs/DESIGN-TOKENS.md).

Not included, by design: `Trace`, `Run experiment` and `Deploy`. They require LangSmith or
the cloud platform, which this project does not use.

## Requirements

- A LangGraph Agent Server: `langgraph dev` from `langgraph-cli[inmem]`, or any server
  exposing the Agent Server API 0.4+.
- Python 3.9+ for the Python package, Node 18+ for the Node proxy, VS Code 1.95+ for the
  extension. The extension and the Node proxy need no Python on their own machine, only
  network access to the server.

## Development

A `Makefile` wraps the common commands: `make setup`, `make build`, `make check`,
`make proxy TARGET=http://host:2024`, `make package`; run `make help` for the full list.
The underlying commands:

```bash
uv venv && uv pip install -e ".[dev]"
pytest                      # server side
ruff check src tests

cd frontend && pnpm install
pnpm check                  # typecheck + eslint + prettier + vitest
pnpm build                  # writes src/langgraph_studio_oss/static, vscode/media and node/media

cd ../vscode && pnpm check  # extension: typecheck + vitest
pnpm package                # → langgraph-studio-unofficial-<version>.vsix
cd ../node && pnpm check    # Node proxy: syntax check + vitest
```

How the code is organised is described in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md);
the measured sizes, colors and timings live in [docs/DESIGN-TOKENS.md](docs/DESIGN-TOKENS.md).
Releases are cut by pushing a `v*` tag: CI checks that the tag matches the version in
`pyproject`, `vscode/package.json` and `node/package.json`, then attaches the artifacts.

## License

MIT, see [LICENSE](LICENSE).
