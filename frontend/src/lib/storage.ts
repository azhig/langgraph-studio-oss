/**
 * Settings storage. In the browser this is `localStorage`, guarded against private mode
 * and corrupt values: any error means "no persistence", not a broken UI.
 * In the VS Code webview the panel state is substituted instead (see `platform/`).
 */

export interface StorageBackend {
  get: (key: string) => string | null;
  set: (key: string, value: string) => void;
}

const browserStorage: StorageBackend = {
  get: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* private mode — the setting will not survive a reload */
    }
  },
};

let backend: StorageBackend = browserStorage;

/** Replaces the storage; must happen before the first read (stores read it at import time). */
export const setStorageBackend = (next: StorageBackend): void => {
  backend = next;
};

export const readString = (key: string): string | null => backend.get(key);

export const writeString = (key: string, value: string): void => backend.set(key, value);

export function readJson<T>(key: string, fallback: T): T {
  const raw = readString(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  writeString(key, JSON.stringify(value));
}

/**
 * Storage keys. The `ls:studio:*` names match the reference: settings
 * made in the original Studio on the same origin are picked up as is.
 */
export const storageKeys = {
  theme: "studio.theme",
  /** Custom headers for Agent Server requests (the `Configure Studio connection` dialog). */
  customHeaders: "studio.headers",
  splitRatio: "studio.split",
  detailLevel: "ls:studio:traceLogInfoLevel",
  interrupts: (assistantId?: string) => `ls:studio:${assistantId ?? "unknown"}:interrupts`,
  nodePositions: (assistantId?: string) => `ls:studio:${assistantId ?? "unknown"}:nodePosition`,
} as const;
