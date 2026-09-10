import { overrideFetchImplementation } from "@langchain/langgraph-sdk";
import { setStorageBackend, type StorageBackend } from "@/lib/storage";
import { HostBridge, type Channel } from "./bridge";
import type { ToWebview } from "./protocol";

/** Webview API that VS Code injects into the page. */
interface VsCodeApi {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
  }
}

/**
 * Host the UI is opened in.
 *
 * `browser` — the page is served by the Agent Server or the `langgraph-studio-oss` proxy,
 * requests use regular `fetch` to its own origin. `vscode` — the page lives in the extension's
 * webview: it has no network, requests and settings go to the host via `postMessage`.
 */
export type Host = "browser" | "vscode";

let host: Host = "browser";
let bridge: HostBridge | null = null;

export const currentHost = (): Host => host;

/** Bridge to the extension; only present in a webview. */
export const hostBridge = (): HostBridge => {
  if (!bridge) throw new Error("Host bridge is available only inside VS Code");
  return bridge;
};

/** Virtual API address in the webview: path and query go to the host, the origin is irrelevant. */
export const VSCODE_API_ROOT = "http://agent-server.invalid";

/**
 * Platform setup. Called before the app loads: stores read storage
 * on import, and the SDK takes `fetch` from the singleton.
 */
export function installPlatform(): Host {
  const acquire = window.acquireVsCodeApi;
  if (!acquire) return host;
  const api = acquire();
  host = "vscode";

  const channel: Channel = {
    post: (message) => api.postMessage(message),
    subscribe: (listener) => {
      const onMessage = (e: MessageEvent<ToWebview>) => listener(e.data);
      window.addEventListener("message", onMessage);
      return () => window.removeEventListener("message", onMessage);
    },
  };
  bridge = new HostBridge(channel);
  overrideFetchImplementation(bridge.fetch);
  setStorageBackend(vscodeStorage(api));
  return host;
}

/** Settings live in the webview state: `localStorage` there does not survive a restart. */
function vscodeStorage(api: VsCodeApi): StorageBackend {
  const state = new Map<string, string>(Object.entries((api.getState() as Record<string, string> | null) ?? {}));
  const flush = () => api.setState(Object.fromEntries(state));
  return {
    get: (key) => state.get(key) ?? null,
    set: (key, value) => {
      state.set(key, value);
      flush();
    },
  };
}
