# Architecture

The project consists of two parts: a small Python package that serves the built
UI on the same port as the Agent Server, and a React application that talks to
that server using relative paths.

```
src/langgraph_studio_oss/     Python: Starlette routes for /studio, proxy, CLI
frontend/src/                 React: the Studio UI (shared by both hosts)
vscode/                       VS Code extension: webview with the same build and a request relay
docs/                         architecture and design tokens (working materials live in docs/internal, outside git)
tests/                        pytest for the server side
```

## Server side

| Module | Purpose |
|---|---|
| `app.py` | `studio_routes(path)` — the page, static assets and redirects to the root; `mount_studio(app)` for a third-party `http.app`; a ready-made `app` for `langgraph.json` |
| `proxy.py` | `create_app(target)` — fallback mode: the UI plus a reverse proxy without SSE buffering. `GET/PUT {path}/api/connection` shows and changes the proxy target (the `Connected` dialog in the UI). The `httpx` client is swapped via the `client` parameter (this is how the tests work) |
| `cli.py` | `langgraph-studio-oss --target … --port …` on top of `proxy.py` |

The frontend build (`frontend/`) goes to `src/langgraph_studio_oss/static` and is included
in the wheel, but not in git.

## VS Code extension

`vscode/src/extension.ts` opens a webview panel with the same build (`vscode/media`,
copied during the frontend's `pnpm build`). The webview has no network access: the page detects the host via
`acquireVsCodeApi` (`frontend/src/platform/`), replaces the SDK's `fetch` with a tunnel over
`postMessage`, and `vscode/src/relay.ts` makes the requests to the Agent Server and streams the
response body in chunks (SSE is not buffered). The message protocol is `protocol.ts` in both
packages (the copies must match). Address and headers are the `langgraphStudio.*` settings;
UI storage is the webview state. End-to-end check without VS Code:
`node vscode/scripts/smoke.mjs`.

## Frontend

### Layers

```
main.tsx, App.tsx      entry point and root layout (SplitPane or Chat mode)
platform/              host: browser or VS Code webview (transport, storage)
styles/                tokens (:root / html.dark), Tailwind theme, base, components
lib/                   pure utilities without React and without the store
hooks/                 reusable hooks not tied to the domain
api/                   Agent Server client (`@langchain/langgraph-sdk`) and the API root
store/                 application state (zustand)
components/            general-purpose UI elements
features/<area>/       screens and logic by area
```

Dependencies point top-down: `features → store/components/hooks/lib`,
`components → hooks/lib`, `store → lib/api`. `lib/` and `hooks/` depend on nothing inside
the project (except `api/client` in `usePagedThreads`).

### `lib/`

| Module | What it provides |
|---|---|
| `messages.ts` | LangChain messages: `messageKind`, `roleLabel` / `roleTitle`, `messageText` / `messagePlainText`, attachments (`contentImages`, `buildContent`), `asMessages` |
| `schema.ts` | Server JSON Schema: `schemaType`, `isNumericType`, `refersToMessages` (enables Chat mode and the message builder) |
| `storage.ts` | Safe `localStorage` and the `storageKeys` registry (names match the reference) |
| `url.ts` | Address bar parameters `assistantId`, `mode`, `threadId` |
| `time.ts`, `clipboard.ts`, `cx.ts` | Relative time, copying, class name joining |

### `store/`

- `studio.ts` — connection, assistants, the selected assistant's graph (regular and `xray`),
  subgraphs, run configuration, modes. Selectors `selectCurrentAssistant` and
  `useCurrentAssistant`.
- `run/` — run screen state in three slices: `inputSlice` (form based on
  `input_schema`, input history), `logSlice` (entries of the ongoing run, node highlighting,
  level of detail), `interruptsSlice` (`before` / `after` pauses bound to the
  assistant). Log entry types are in `run/types.ts`. The assistant-change subscription
  in `run/index.ts` resets the form, the log and the pauses.

The execution stream itself is driven by `useStream` from the SDK inside `features/run/StreamProvider.tsx`:
it creates the thread, submits the run, keeps the checkpoint history and branches.
The provider subscribes to its events and puts into `useRun` what needs to be
rendered. Components read `useStudioStream()` for actions (`submit`, `resume`,
`rerunFrom`, `forkState`, `stop`) and `useRun` / `useStudio` for state.

### `features/`

| Area | Contents |
|---|---|
| `shell/` | `Header` (headers of both panes), `LeftPane`, `RightPane` |
| `graph/` | Canvas: `layout.ts` (dagre, subgraph collapsing), `colors.ts` (node hue from its name — as in the reference), `flow.ts` (React Flow model), `positions.ts` (manual positions), `GraphNode`, `GraphEdge`, `SubgraphFrame`, `NodeHoverCard`, `InterruptsMenu`, `ZoomControls`, `NodeAvatar` |
| `input/` | The `Input` card: `format.ts` (YAML/JSON, fields by schema), `CodeEditor` (CodeMirror), `CodePanel` (editor with the format bar), `EditorBar`, `ValueField`, `MessagesField` (message builder), `Highlight` (highlighting without an editor), `InputPanel` |
| `thread/` | Thread log: `history.ts` (entries from history, splitting into turns), `ThreadLog` → `Turn` → `Checkpoint` / `NodeRecord` → `Updates` → `ValueTree`; `ViewState`, `EditNodeState`, `InterruptBlock`, `ErrorBlock`, `ThreadPicker`, `DetailSlider`, `branches.ts` |
| `chat/` | Chat mode: `ChatView`, `Composer`, `MessageCard`, `ChatThreads` |
| `assistants/` | `Manage Assistants`: `model.ts` (system assistant, titles), `config.ts` (`config_schema` fields), `AssistantsModal`, `AssistantForm`, `ConfigInput`, `NodeConfigModal` |
| `memory/` | Store: `tree.ts` (namespace tree), `MemoryModal`, `NamespaceTree`, `ItemForm` |
| `run/` | `StreamProvider` — see above |

### `components/`

`Popover`, `Tooltip`, `HoverCard` — floating panels portaled into `body`; the position
is computed by the shared `useAnchoredPosition` hook, each with its own placement rule. `Modal`,
`ConfirmDialog`, `Select`, `SegmentedControl`, `Switch`, `Checkbox`, `FieldError`,
`SplitPane`, icons in `icons/`.

## Data flow during a run

1. `InputPanel` → `useStudioStream().submit()`.
2. `StreamProvider` collects the input from `useRun.buildInput()`, stores it in the history,
   sets `pendingStart` and calls `stream.submit()` with parameters from `useStudio`
   (`configurable`, `recursion_limit`, pauses).
3. `checkpoints` / `tasks` events go to `useRun.addCheckpoint` / `addTask` — the log
   is rendered as it goes, the node on the canvas is highlighted.
4. On completion `useStream` re-reads the thread history; `StreamProvider` clears
   the temporary entries, and the log is built entirely from history (`history.ts`).

## Conventions

- **Appearance is measured** from the live Studio, not copied from its CSS.
  Numbers and colors are recorded in `docs/DESIGN-TOKENS.md`; next to them in the code
  there is a short note "measured from the reference".
- **Everything in the repository is in English**: code comments, docs, commit messages.
- Components read the store through selectors (`useStudio((s) => s.theme)`), not as a whole.
- `localStorage` keys and URL parameters go only through `lib/storage` and `lib/url`.
- Pure logic (layout, colors, history parsing, branches, schemas) lives in `.ts`
  without React and is covered by `vitest`.

## Checks

```bash
cd frontend
pnpm check          # typecheck + lint + prettier --check + vitest
pnpm build          # build into src/langgraph_studio_oss/static

pytest              # server side
ruff check src tests && ruff format --check src tests

cd vscode && pnpm check   # extension: typecheck + vitest
```

Comparison against the reference (`smith.langchain.com/studio` on the same Agent Server) is done
manually via Playwright over CDP: a run in our UI, then the same `threadId`
in the original — if the data matches, any difference is a rendering difference.
