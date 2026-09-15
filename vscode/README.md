# LangGraph Studio (Unofficial)

[![CI](https://img.shields.io/github/actions/workflow/status/azhig/langgraph-studio-oss/ci.yml?branch=main&label=CI)](https://github.com/azhig/langgraph-studio-oss/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/azhig/langgraph-studio-oss?include_prereleases)](https://github.com/azhig/langgraph-studio-oss/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/azhig/langgraph-studio-oss/blob/main/LICENSE)

The Studio for your local [LangGraph](https://github.com/langchain-ai/langgraph) Agent
Server, as a panel inside VS Code: graph view, thread log, time travel, interrupts,
assistants, memory and chat mode. It talks to the server you point it at and to nothing
else — no cloud account, no browser tab, no tunnel.

![Submitting input, watching a tool-calling run stream its reply, then the same thread in Chat mode](https://raw.githubusercontent.com/azhig/langgraph-studio-oss/main/docs/demo.gif)

> **Unofficial.** This extension is not affiliated with, endorsed by, or sponsored by
> LangChain, Inc. LangGraph, LangChain and LangSmith are trademarks of LangChain, Inc.,
> used here only to describe compatibility. The UI is written from scratch and contains
> no code from the original Studio.

## Getting started

The extension does not start a server: it connects to a LangGraph Agent Server that you
run yourself, usually `langgraph dev` from your project.

1. Start the server (Python 3.9+):

   ```bash
   pip install "langgraph-cli[inmem]"
   cd my-project                 # the directory with langgraph.json
   langgraph dev --no-browser    # listens on http://127.0.0.1:2024
   ```

2. In VS Code run **LangGraph Studio (Unofficial): Open** from the Command Palette.

3. The panel connects to `http://127.0.0.1:2024` by default. For another address or
   port, set `langgraphStudio.target` or click **Connected** in the panel header and
   enter the URL there. If the server is not reachable, the panel shows these steps.

Nothing has to be installed in Python for the extension itself: the extension host makes
the HTTP requests, the webview needs no network access.

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `langgraphStudio.target` | `http://127.0.0.1:2024` | Agent Server base URL |
| `langgraphStudio.customHeaders` | `{}` | Headers added to every request, for servers behind authentication |

Both can also be changed from the **Connected** dialog inside the panel; `Connect` writes
them back to the user settings.

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
- Light and dark themes following the editor theme. Every size, color and delay was
  measured on the original Studio.

Not included, by design: `Trace`, `Run experiment` and `Deploy` — they need LangSmith or
the cloud platform, which this extension does not use.

## Good to know

- The panel keeps its theme, detail level and interrupts in the webview state; the active
  assistant and thread are not restored when the panel is reopened.
- Node positions you drag and the interrupt toggles are stored per assistant, under the
  same keys the original Studio uses.
- The same UI is available outside VS Code: as a Python package mounted into
  `langgraph dev` ([`langgraph-studio-oss` on PyPI](https://pypi.org/project/langgraph-studio-oss/))
  and as a Node proxy ([`langgraph-studio-oss` on npm](https://www.npmjs.com/package/langgraph-studio-oss)).

## Troubleshooting

- **"Cannot reach the Agent Server"** — check that `langgraph dev` is running and that
  `langgraphStudio.target` matches its address; a server started with `--port` other than
  2024 needs the setting changed.
- **Authentication errors** — add the required headers to `langgraphStudio.customHeaders`
  or in the **Connected** dialog; they are sent with every request.
- Questions and bug reports: <https://github.com/azhig/langgraph-studio-oss/issues>.

## License

MIT.
