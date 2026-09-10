import { Client } from "@langchain/langgraph-sdk";
import { readJson, storageKeys, writeJson } from "@/lib/storage";
import { VSCODE_API_ROOT, currentHost, hostBridge } from "@/platform";

/**
 * Agent Server API root. The page is always opened at `<mount>/`
 * (the server adds the trailing slash), the API lives one level up — on the same origin.
 * No baseUrl in the query: this is a fundamental difference from the cloud Studio.
 * In the VS Code webview the root is virtual: requests go to the host anyway.
 */
export function apiRoot(): string {
  if (currentHost() === "vscode") return VSCODE_API_ROOT;
  const u = new URL(window.location.href);
  if (import.meta.env.DEV) return u.origin;
  const dir = u.pathname.endsWith("/") ? u.pathname : u.pathname.replace(/[^/]*$/, "");
  const parent = dir.replace(/[^/]+\/$/, "");
  return u.origin + parent.replace(/\/$/, "");
}

/** Header pair from the connection settings dialog; an empty name is not sent. */
export interface CustomHeader {
  name: string;
  value: string;
}

export const readCustomHeaders = (): CustomHeader[] => readJson<CustomHeader[]>(storageKeys.customHeaders, []);

/** Headers go with every request: a server behind authentication would not respond otherwise. */
export function saveCustomHeaders(headers: CustomHeader[]): void {
  writeJson(
    storageKeys.customHeaders,
    headers.filter((h) => h.name.trim()),
  );
  client = null;
}

const headersRecord = (): Record<string, string> =>
  Object.fromEntries(readCustomHeaders().map((h) => [h.name.trim(), h.value]));

let client: Client | null = null;

export function getClient(): Client {
  if (!client) client = new Client({ apiUrl: apiRoot(), defaultHeaders: headersRecord() });
  return client;
}

/** `fetch` of the current host: the regular one in a browser, a tunnel to the extension in a webview. */
const platformFetch = (input: string, init?: RequestInit) =>
  currentHost() === "vscode" ? hostBridge().fetch(input, init) : fetch(input, init);

/** Direct API request — for endpoints missing from the SDK (e.g. /info). */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await platformFetch(`${apiRoot()}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...headersRecord(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status}`);
  return (await res.json()) as T;
}

/**
 * How the UI is connected to the server. In mounted mode the address is fixed —
 * the page is served by the Agent Server itself. In proxy mode (`langgraph-studio-oss --target …`)
 * the target is changed on the server: the browser still only talks to its own origin.
 */
export interface Connection {
  /** `proxy` and `vscode` allow changing the address: the host switches it, not the browser. */
  mode: "mounted" | "proxy" | "vscode";
  target: string | null;
}

/** The UI's service route lives next to the page, not in the server API. */
const studioUrl = (rel: string) => new URL(rel, window.location.href).toString();

export const fetchConnection = async (): Promise<Connection> => {
  if (currentHost() === "vscode") {
    const c = await hostBridge().connection();
    return { mode: "vscode", target: c.target };
  }
  const res = await fetch(studioUrl("api/connection"));
  if (!res.ok) throw new Error(`GET api/connection → ${res.status}`);
  return (await res.json()) as Connection;
};

export async function updateConnectionTarget(target: string): Promise<Connection> {
  if (currentHost() === "vscode") {
    const c = await hostBridge().connection({
      target,
      headers: readCustomHeaders().map((h) => [h.name, h.value]),
    });
    return { mode: "vscode", target: c.target };
  }
  const res = await fetch(studioUrl("api/connection"), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ target }),
  });
  const body = (await res.json()) as Connection & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `PUT api/connection → ${res.status}`);
  return body;
}

export interface ServerInfo {
  version?: string;
  langgraph_py_version?: string;
  flags?: Record<string, boolean>;
  host?: { kind?: string };
}

export const fetchInfo = () => apiFetch<ServerInfo>("/info");
