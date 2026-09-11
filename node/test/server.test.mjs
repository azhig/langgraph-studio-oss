import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer, readSavedTarget } from "../lib/server.mjs";

/** Stand-in for the Agent Server: echo, SSE and an endless stream. */
let upstream;
let upstreamUrl = "";
let streamClosed = false;
let studio;
let base = "";
let media;
let stateFile;

beforeAll(async () => {
  upstream = http.createServer((req, res) => {
    if (req.url.startsWith("/echo")) {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        res.setHeader("content-type", "application/json");
        res.setHeader("x-pagination-total", "1");
        res.end(JSON.stringify({ method: req.method, body, query: req.url.split("?")[1] ?? "", auth: req.headers.authorization ?? null }));
      });
      return;
    }
    if (req.url === "/stream") {
      res.setHeader("content-type", "text/event-stream");
      res.write("event: a\ndata: 1\n\n");
      setTimeout(() => res.end("event: b\ndata: 2\n\n"), 30);
      return;
    }
    if (req.url === "/forever") {
      res.setHeader("content-type", "text/event-stream");
      res.write("event: start\n\n");
      req.on("close", () => (streamClosed = true));
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  await new Promise((r) => upstream.listen(0, "127.0.0.1", r));
  upstreamUrl = `http://127.0.0.1:${upstream.address().port}`;

  media = mkdtempSync(path.join(tmpdir(), "studio-media-"));
  mkdirSync(path.join(media, "assets"));
  writeFileSync(path.join(media, "index.html"), "<!doctype html><title>Studio</title>");
  writeFileSync(path.join(media, "assets", "app.js"), "console.log(1)");
  stateFile = path.join(mkdtempSync(path.join(tmpdir(), "studio-state-")), "connection.json");

  studio = createServer({ target: upstreamUrl, media, stateFile });
  await new Promise((r) => studio.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${studio.address().port}`;
});

afterAll(() => {
  studio.close();
  upstream.close();
});

describe("UI routes", () => {
  it("serves the page with no-store and redirects to the root keeping the query", async () => {
    const page = await fetch(`${base}/studio/`);
    expect(page.status).toBe(200);
    expect(page.headers.get("cache-control")).toBe("no-store");
    expect(await page.text()).toContain("<title>Studio</title>");
    const r = await fetch(`${base}/studio?assistantId=abc&mode=graph`, { redirect: "manual" });
    expect(r.status).toBe(307);
    expect(r.headers.get("location")).toBe("/studio/?assistantId=abc&mode=graph");
    const nested = await fetch(`${base}/studio/threads/42`, { redirect: "manual" });
    expect(nested.headers.get("location")).toBe("/studio/");
  });

  it("serves assets and refuses paths outside the assets dir", async () => {
    expect((await fetch(`${base}/studio/assets/app.js`)).status).toBe(200);
    // fetch() normalizes `..` before sending, so the raw request goes through http.request
    const status = await new Promise((resolve) =>
      http.get(`${base}/studio/assets/../index.html`, { path: "/studio/assets/../index.html" }, (r) => {
        r.resume();
        resolve(r.statusCode);
      }),
    );
    expect(status).toBe(404);
  });
});

describe("proxy", () => {
  it("forwards method, body, query and headers; returns upstream headers", async () => {
    const r = await fetch(`${base}/echo?limit=5`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer t" },
      body: '{"limit":5}',
    });
    expect(r.headers.get("x-pagination-total")).toBe("1");
    expect(await r.json()).toEqual({ method: "POST", body: '{"limit":5}', query: "limit=5", auth: "Bearer t" });
  });

  it("streams SSE without buffering", async () => {
    const r = await fetch(`${base}/stream`, { method: "POST", body: "{}" });
    expect(r.headers.get("content-type")).toBe("text/event-stream");
    expect(r.headers.has("content-length")).toBe(false);
    const reader = r.body.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    expect(first).toBe("event: a\ndata: 1\n\n");
    let rest = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      rest += new TextDecoder().decode(value);
    }
    expect(rest).toBe("event: b\ndata: 2\n\n");
  });

  it("closes the upstream request when the client disconnects", async () => {
    const ac = new AbortController();
    const r = await fetch(`${base}/forever`, { signal: ac.signal });
    await r.body.getReader().read();
    ac.abort();
    await new Promise((res) => setTimeout(res, 100));
    expect(streamClosed).toBe(true);
  });

  it("answers 502 when the Agent Server is down", async () => {
    await fetch(`${base}/studio/api/connection`, { method: "PUT", body: JSON.stringify({ target: "http://127.0.0.1:1" }) });
    const r = await fetch(`${base}/info`);
    expect(r.status).toBe(502);
    await fetch(`${base}/studio/api/connection`, { method: "PUT", body: JSON.stringify({ target: upstreamUrl }) });
  });
});

describe("connection endpoint", () => {
  it("reports proxy mode, validates and persists the target", async () => {
    expect(await (await fetch(`${base}/studio/api/connection`)).json()).toEqual({ mode: "proxy", target: upstreamUrl });
    const bad = await fetch(`${base}/studio/api/connection`, { method: "PUT", body: JSON.stringify({ target: "nope" }) });
    expect(bad.status).toBe(400);
    const ok = await fetch(`${base}/studio/api/connection`, {
      method: "PUT",
      body: JSON.stringify({ target: "http://other:2024/" }),
    });
    expect(await ok.json()).toEqual({ mode: "proxy", target: "http://other:2024" });
    expect(readSavedTarget(stateFile)).toBe("http://other:2024");
    await fetch(`${base}/studio/api/connection`, { method: "PUT", body: JSON.stringify({ target: upstreamUrl }) });
  });
});
