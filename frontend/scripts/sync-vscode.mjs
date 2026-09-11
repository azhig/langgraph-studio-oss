// Copies the UI build into the VS Code extension: one frontend, two hosts.
import { cpSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const from = fileURLToPath(new URL("../../src/langgraph_studio_oss/static", import.meta.url));
if (!existsSync(from)) throw new Error(`build not found: ${from}`);
for (const host of ["vscode", "node"]) {
  const to = fileURLToPath(new URL(`../../${host}/media`, import.meta.url));
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
  console.log(`${host}/media ← ${from}`);
}
