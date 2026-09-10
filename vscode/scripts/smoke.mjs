// End-to-end check without VS Code: the extension page in Chrome (CDP :9222) with a stubbed
// `acquireVsCodeApi`; the host is the real Relay against a live Agent Server.
//   node scripts/smoke.mjs [target]
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { Relay } from "../out/relay.js";

const media = fileURLToPath(new URL("../media", import.meta.url));
const target = (process.argv[2] ?? "http://127.0.0.1:2024").replace(/\/+$/, "");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2" };

const server = http.createServer((req, res) => {
  const file = path.join(media, req.url === "/" ? "index.html" : req.url.split("?")[0]);
  if (!existsSync(file)) return void (res.statusCode = 404, res.end());
  res.setHeader("content-type", types[path.extname(file)] ?? "application/octet-stream");
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
const page = await browser.contexts()[0].newPage();
const relay = new Relay({
  target: () => target,
  headers: () => ({}),
  send: (m) => page.evaluate((msg) => window.postMessage(msg, "*"), m).catch(() => {}),
});
await page.exposeFunction("__toHost", (m) => {
  if (m.type === "connection:get") return void page.evaluate((msg) => window.postMessage(msg, "*"), { type: "connection", id: m.id, target, headers: [] });
  relay.handle(m);
});
await page.addInitScript(() => {
  const state = {};
  window.acquireVsCodeApi = () => ({ postMessage: (m) => window.__toHost(m), getState: () => state, setState: () => {} });
  document.body?.classList.add("vscode-dark");
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
await page.goto(`${origin}/`);
await page.waitForSelector(".react-flow__node", { timeout: 15000 });
const nodes = await page.locator(".react-flow__node").count();
const connected = await page.locator("button", { hasText: "Connected" }).count();

// Run: type into the editor and Submit, wait for the log entry via the SSE tunnel
await page.locator(".cm-content").first().click();
await page.keyboard.press("Meta+a");
await page.keyboard.type('[{role: human, content: "vscode smoke"}]');
await page.locator("button", { hasText: "Submit" }).first().click();
await page.waitForSelector("[data-testid=checkpoint-entry]", { timeout: 30000 });
await page.waitForFunction(() => document.querySelector('[data-testid="thread-log"]')?.innerText.includes("vscode smoke"), null, { timeout: 30000 });
const log = await page.locator("[data-testid=thread-log]").innerText();

console.log(JSON.stringify({ nodes, connected, logHasInput: log.includes("vscode smoke"), logLines: log.split("\n").length, errors }, null, 1));
await page.close();
await browser.close();
server.close();
