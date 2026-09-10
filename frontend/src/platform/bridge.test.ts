import { describe, expect, it } from "vitest";
import { HostBridge, type Channel } from "./bridge";
import type { ToHost, ToWebview } from "./protocol";

/** Fake host: collects outgoing messages and can reply to the webview. */
function fakeChannel() {
  const sent: ToHost[] = [];
  let listener: ((m: ToWebview) => void) | null = null;
  const channel: Channel = {
    post: (m) => sent.push(m),
    subscribe: (l) => {
      listener = l;
      return () => {
        listener = null;
      };
    },
  };
  const reply = (m: ToWebview) => listener?.(m);
  return { channel, sent, reply };
}

const b64 = (s: string) => btoa(s);

describe("HostBridge.fetch", () => {
  it("sends method, path with query, headers and body to the host, dropping the origin", async () => {
    const { channel, sent, reply } = fakeChannel();
    const bridge = new HostBridge(channel);
    const pending = bridge.fetch("http://agent-server.invalid/threads/search?limit=1", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "k" },
      body: '{"limit":1}',
    });
    const req = sent[0];
    expect(req.type).toBe("fetch");
    if (req.type !== "fetch") return;
    expect(req).toMatchObject({ method: "POST", path: "/threads/search?limit=1", body: '{"limit":1}' });
    expect(Object.fromEntries(req.headers)).toMatchObject({ "content-type": "application/json", "x-api-key": "k" });

    reply({
      type: "response",
      id: req.id,
      status: 200,
      statusText: "OK",
      headers: [["content-type", "application/json"]],
    });
    reply({ type: "chunk", id: req.id, data: b64('[{"thread_id"') });
    reply({ type: "chunk", id: req.id, data: b64(':"t1"}]') });
    reply({ type: "end", id: req.id });
    const res = await pending;
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(await res.json()).toEqual([{ thread_id: "t1" }]);
  });

  it("response body is read as a stream as chunks arrive", async () => {
    const { channel, sent, reply } = fakeChannel();
    const bridge = new HostBridge(channel);
    const pending = bridge.fetch("http://agent-server.invalid/runs/stream", { method: "POST", body: "{}" });
    const id = (sent[0] as { id: number }).id;
    reply({ type: "response", id, status: 200, statusText: "OK", headers: [["content-type", "text/event-stream"]] });
    const res = await pending;
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    reply({ type: "chunk", id, data: b64("event: values\ndata: 1\n\n") });
    expect(decoder.decode((await reader.read()).value)).toBe("event: values\ndata: 1\n\n");
    reply({ type: "end", id });
    expect((await reader.read()).done).toBe(true);
  });

  it("cancelling a request sends `abort` to the host", async () => {
    const { channel, sent } = fakeChannel();
    const bridge = new HostBridge(channel);
    const ac = new AbortController();
    const pending = bridge.fetch("http://agent-server.invalid/info", { signal: ac.signal });
    ac.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(sent.at(-1)).toEqual({ type: "abort", id: (sent[0] as { id: number }).id });
  });

  it("network error before headers rejects the promise", async () => {
    const { channel, sent, reply } = fakeChannel();
    const bridge = new HostBridge(channel);
    const pending = bridge.fetch("http://agent-server.invalid/info");
    reply({ type: "error", id: (sent[0] as { id: number }).id, message: "ECONNREFUSED" });
    await expect(pending).rejects.toThrow("ECONNREFUSED");
  });
});

describe("HostBridge.connection", () => {
  it("reads and updates connection settings", async () => {
    const { channel, sent, reply } = fakeChannel();
    const bridge = new HostBridge(channel);
    const get = bridge.connection();
    reply({ type: "connection", id: (sent[0] as { id: number }).id, target: "http://127.0.0.1:2024", headers: [] });
    expect(await get).toEqual({ target: "http://127.0.0.1:2024", headers: [] });

    const set = bridge.connection({ target: "http://h:1", headers: [["a", "b"]] });
    expect(sent[1]).toMatchObject({ type: "connection:set", target: "http://h:1", headers: [["a", "b"]] });
    reply({ type: "connection", id: (sent[1] as { id: number }).id, target: "http://h:1", headers: [["a", "b"]] });
    expect((await set).target).toBe("http://h:1");
  });
});
