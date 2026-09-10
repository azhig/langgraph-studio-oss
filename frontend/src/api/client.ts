import { Client } from "@langchain/langgraph-sdk";

/**
 * Корень API Agent Server. Страница всегда открыта по адресу `<mount>/`
 * (сервер добавляет завершающий слэш), API живёт уровнем выше — на том же origin.
 * Никаких baseUrl в query: это принципиальное отличие от облачного Studio.
 */
export function apiRoot(): string {
  const u = new URL(window.location.href);
  if (import.meta.env.DEV) return u.origin;
  const dir = u.pathname.endsWith("/") ? u.pathname : u.pathname.replace(/[^/]*$/, "");
  const parent = dir.replace(/[^/]+\/$/, "");
  return u.origin + parent.replace(/\/$/, "");
}

let client: Client | null = null;

export function getClient(): Client {
  if (!client) client = new Client({ apiUrl: apiRoot() });
  return client;
}

/** Прямой запрос к API — для эндпоинтов, которых нет в SDK (например /info). */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiRoot()}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status}`);
  return (await res.json()) as T;
}

export interface ServerInfo {
  version?: string;
  langgraph_py_version?: string;
  flags?: Record<string, boolean>;
  host?: { kind?: string };
}

export const fetchInfo = () => apiFetch<ServerInfo>("/info");
