#!/usr/bin/env node
// langgraph-studio-oss --target http://127.0.0.1:2024 --port 8100 → http://127.0.0.1:8100/studio
import { parseArgs } from "node:util";
import { DEFAULT_PATH, DEFAULT_TARGET, createServer, readSavedTarget, statePath, writeSavedTarget } from "../lib/server.mjs";

const { values } = parseArgs({
  options: {
    target: { type: "string" },
    host: { type: "string", default: "127.0.0.1" },
    port: { type: "string", default: "8100" },
    path: { type: "string", default: DEFAULT_PATH },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (values.help) {
  console.log(`Usage: langgraph-studio-oss [--target URL] [--host HOST] [--port PORT] [--path PATH]

  --target  Agent Server base URL (default: the one chosen last time in the UI, else ${DEFAULT_TARGET})
  --host    interface to listen on (default: 127.0.0.1)
  --port    port for the UI (default: 8100)
  --path    path the UI is served at (default: ${DEFAULT_PATH})`);
  process.exit(0);
}

// An explicit --target wins over the saved one and becomes the saved one itself
const stateFile = statePath();
const target = values.target || readSavedTarget(stateFile) || DEFAULT_TARGET;
if (values.target) writeSavedTarget(target, stateFile);

const server = createServer({ target, mountPath: values.path, stateFile });
server.listen(Number(values.port), values.host, () => {
  const mount = "/" + values.path.replace(/^\/+|\/+$/g, "");
  console.log(`Studio: http://${values.host}:${values.port}${mount}/\nAgent Server: ${target}`);
});
