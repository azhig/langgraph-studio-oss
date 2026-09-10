import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import { Relay } from "./relay";
import type { ToWebview } from "./protocol";

/** Mini server standing in for the Agent Server: JSON echoing headers, SSE and an endless stream. */
let server: http.Server;
let target = "";
let streamClosed = false;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === "/echo") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        res.setHeader("content-type", "application/json");
        res.setHeader("x-pagination-total", "1");
        res.end(JSON.stringify({ method: req.method, body, auth: req.headers.authorization ?? null }));
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
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address() as { port: number };
  target = `http://127.0.0.1:${addr.port}`;
});

afterAll(() => server.close());

function collect() {
  const out: ToWebview[] = [];
  const done = new Promise<ToWebview[]>((resolve) => {
    collectResolve = () => resolve(out);
  });
  return { out, done, send: (m: ToWebview) => (out.push(m), (m.type === "end" || m.type === "error") && collectResolve()) };
}
let collectResolve = () => {};
const text = (out: ToWebview[]) =>
  out
    .filter((m): m is Extract<ToWebview, { type: "chunk" }> => m.type === "chunk")
    .map((m) => Buffer.from(m.data, "base64").toString())
    .join("");

describe("Relay", () => {
  it("forwards method, body, request and settings headers, and returns response headers", async () => {
    const { out, done, send } = collect();
    const relay = new Relay({ target: () => target, headers: () => ({ authorization: "Bearer t" }), send });
    relay.handle({ type: "fetch", id: 1, method: "POST", path: "/echo", headers: [["content-type", "application/json"]], body: "{}" });
    const messages = await done;
    expect(messages[0]).toMatchObject({ type: "response", id: 1, status: 200 });
    const headers = Object.fromEntries((messages[0] as Extract<ToWebview, { type: "response" }>).headers);
    expect(headers["x-pagination-total"]).toBe("1");
    expect(JSON.parse(text(messages))).toEqual({ method: "POST", body: "{}", auth: "Bearer t" });
  });

  it("streams SSE in chunks without waiting for the end of the response", async () => {
    const { out, done, send } = collect();
    const relay = new Relay({ target: () => target, headers: () => ({}), send });
    relay.handle({ type: "fetch", id: 2, method: "POST", path: "/stream", headers: [], body: "{}" });
    await new Promise((r) => setTimeout(r, 10));
    // The first event is already delivered while the server still holds the connection
    expect(text(out)).toBe("event: a\ndata: 1\n\n");
    const messages = await done;
    expect(text(messages)).toBe("event: a\ndata: 1\n\nevent: b\ndata: 2\n\n");
    expect(messages.at(-1)?.type).toBe("end");
  });

  it("abort closes the connection to the server", async () => {
    const out: ToWebview[] = [];
    const relay = new Relay({ target: () => target, headers: () => ({}), send: (m) => out.push(m) });
    relay.handle({ type: "fetch", id: 3, method: "GET", path: "/forever", headers: [] });
    await new Promise((r) => setTimeout(r, 30));
    relay.handle({ type: "abort", id: 3 });
    await new Promise((r) => setTimeout(r, 50));
    expect(streamClosed).toBe(true);
    expect(out.some((m) => m.type === "error")).toBe(false);
  });

  it("an unreachable server yields `error`", async () => {
    const { done, send } = collect();
    const relay = new Relay({ target: () => "http://127.0.0.1:1", headers: () => ({}), send });
    relay.handle({ type: "fetch", id: 4, method: "GET", path: "/info", headers: [] });
    const messages = await done;
    expect(messages[0].type).toBe("error");
  });
});
