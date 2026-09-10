import type { ToHost, ToWebview } from "./protocol";

/** Channel to the host: sending messages and subscribing to incoming ones. In a webview this is `postMessage`. */
export interface Channel {
  post: (message: ToHost) => void;
  subscribe: (listener: (message: ToWebview) => void) => () => void;
}

const decodeBase64 = (data: string): Uint8Array => Uint8Array.from(atob(data), (c) => c.charCodeAt(0));

/**
 * Bridge to the extension host: `fetch` over messages and connection settings requests.
 * Responses are matched by `id`; the response body is assembled into a `ReadableStream` so
 * the SDK reads SSE exactly as it would from the network.
 */
export class HostBridge {
  private seq = 0;
  private readonly handlers = new Map<number, (message: ToWebview) => void>();

  constructor(private readonly channel: Channel) {
    channel.subscribe((message) => {
      if ("id" in message) this.handlers.get(message.id)?.(message);
    });
  }

  private nextId(): number {
    return ++this.seq;
  }

  /** SDK-compatible `fetch`: path and query are taken from the URL, origin is dropped. */
  fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const id = this.nextId();
    // A string body (what the SDK sends) goes out immediately; anything else is read asynchronously
    const body =
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : typeof init?.body === "string"
          ? init.body
          : await request.text();
    const signal = init?.signal ?? request.signal;

    return new Promise<Response>((resolve, reject) => {
      let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
      const finish = () => {
        this.handlers.delete(id);
        signal?.removeEventListener("abort", onAbort);
      };
      const onAbort = () => {
        this.channel.post({ type: "abort", id });
        controller?.error(new DOMException("The operation was aborted.", "AbortError"));
        finish();
        reject(new DOMException("The operation was aborted.", "AbortError"));
      };
      signal?.addEventListener("abort", onAbort, { once: true });

      this.handlers.set(id, (message) => {
        switch (message.type) {
          case "response": {
            const stream = new ReadableStream<Uint8Array>({
              start: (c) => {
                controller = c;
              },
              cancel: () => this.channel.post({ type: "abort", id }),
            });
            resolve(
              new Response(stream, {
                status: message.status,
                statusText: message.statusText,
                headers: message.headers,
              }),
            );
            break;
          }
          case "chunk":
            controller?.enqueue(decodeBase64(message.data));
            break;
          case "end":
            controller?.close();
            finish();
            break;
          case "error":
            if (controller) controller.error(new Error(message.message));
            else reject(new TypeError(message.message));
            finish();
            break;
          default:
            break;
        }
      });

      this.channel.post({
        type: "fetch",
        id,
        method: request.method,
        path: url.pathname + url.search,
        headers: [...request.headers.entries()],
        body,
      });
    });
  };

  /** Extension connection settings: server address and custom headers. */
  connection(set?: {
    target: string;
    headers: [string, string][];
  }): Promise<{ target: string; headers: [string, string][] }> {
    const id = this.nextId();
    return new Promise((resolve, reject) => {
      this.handlers.set(id, (message) => {
        this.handlers.delete(id);
        if (message.type === "connection") resolve({ target: message.target, headers: message.headers });
        else if (message.type === "error") reject(new Error(message.message));
      });
      this.channel.post(set ? { type: "connection:set", id, ...set } : { type: "connection:get", id });
    });
  }

  openExternal(url: string): void {
    this.channel.post({ type: "open", url });
  }
}
