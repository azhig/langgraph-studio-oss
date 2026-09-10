import type { ToHost, ToWebview } from "./protocol";

/**
 * Relays requests from the webview to the Agent Server — the same as `proxy.py`, but in
 * the extension host: the webview has no network access, while the Node side can reach
 * anything. The response body is passed on chunk by chunk as it arrives, so run SSE is
 * not buffered.
 */
export interface RelayOptions {
  /** Agent Server address without a trailing slash. */
  target: () => string;
  /** Custom headers from settings; request headers take precedence. */
  headers: () => Record<string, string>;
  send: (message: ToWebview) => void;
  fetchImpl?: typeof fetch;
}

/** Headers that describe the webview connection rather than the request to the server. */
const DROP = new Set(["host", "origin", "referer", "connection", "content-length", "accept-encoding"]);

export class Relay {
  private readonly aborts = new Map<number, AbortController>();

  constructor(private readonly options: RelayOptions) {}

  /** Abort everything — runs must not hang after the panel is closed. */
  dispose(): void {
    for (const ac of this.aborts.values()) ac.abort();
    this.aborts.clear();
  }

  handle(message: ToHost): void {
    if (message.type === "fetch") void this.forward(message);
    else if (message.type === "abort") this.aborts.get(message.id)?.abort();
  }

  private async forward(message: Extract<ToHost, { type: "fetch" }>): Promise<void> {
    const { id } = message;
    const ac = new AbortController();
    this.aborts.set(id, ac);
    const doFetch = this.options.fetchImpl ?? fetch;
    try {
      const headers = new Headers(this.options.headers());
      for (const [k, v] of message.headers) if (!DROP.has(k.toLowerCase())) headers.set(k, v);
      const response = await doFetch(this.options.target() + message.path, {
        method: message.method,
        headers,
        body: message.body,
        signal: ac.signal,
        redirect: "manual",
      });
      this.options.send({
        type: "response",
        id,
        status: response.status,
        statusText: response.statusText,
        headers: [...response.headers.entries()].filter(([k]) => k !== "content-encoding"),
      });
      if (response.body) {
        for await (const chunk of response.body) {
          this.options.send({ type: "chunk", id, data: Buffer.from(chunk).toString("base64") });
        }
      }
      this.options.send({ type: "end", id });
    } catch (e) {
      if (!ac.signal.aborted) this.options.send({ type: "error", id, message: e instanceof Error ? e.message : String(e) });
    } finally {
      this.aborts.delete(id);
    }
  }
}
