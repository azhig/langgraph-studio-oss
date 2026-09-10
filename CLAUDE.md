# Working rules for langgraph-studio-oss

An open replacement for LangGraph Studio: the UI is served by your Agent Server at `/studio`
on the same port. Code layout is described in `docs/ARCHITECTURE.md`.

## What matters

- **Look and behavior are measured from the reference**, not copied from its CSS.
  The reference: `https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024`.
  Every number in the code must have a source in `docs/DESIGN-TOKENS.md`.
- **Single origin**: no `?baseUrl=`, no cross-origin requests, no absolute API addresses
  (`api/client.ts` derives the root from the page URL).
- **Everything in the repository is in English**: code comments, docs, commit messages.
- We write the code ourselves: no third-party UI components (only React Flow,
  CodeMirror, dagre, SDK).

## Before finishing a task

```bash
cd frontend && pnpm check && pnpm build     # typecheck, lint, prettier, vitest, build into static/
pytest && ruff check src tests               # server side
```

The build goes to `src/langgraph_studio_oss/static` (served by `langgraph dev`) and to
`vscode/media` (the extension). One frontend, two hosts; differences live only in `frontend/src/platform/`.
Extension: `cd vscode && pnpm check && pnpm build`.

## Structure (brief)

- `frontend/src/lib` — pure utilities; `hooks` — shared hooks; `store` — zustand
  (`studio.ts`, `run/` in three slices); `components` — shared elements;
  `features/<area>` — screens.
- Run data flows through `useStream` from the SDK (`features/run/StreamProvider.tsx`);
  only what gets rendered lands in the store.
- `localStorage` keys go through `lib/storage.ts` (`storageKeys`), URL params through
  `lib/url.ts`.
