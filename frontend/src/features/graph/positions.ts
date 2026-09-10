import { readJson, storageKeys, writeJson } from "@/lib/storage";

export interface Point {
  x: number;
  y: number;
}

/**
 * Manual node positions persist across sessions: the reference stores them in localStorage
 * under the assistant key and marks them as pinned (`isFixed`).
 */
type SavedPosition = Point & { isFixed: boolean };

export const positionsKey = (assistantId?: string) => storageKeys.nodePositions(assistantId);

export function readSavedPositions(key: string): Map<string, Point> {
  const raw = readJson<Record<string, SavedPosition>>(key, {});
  return new Map(Object.entries(raw).map(([id, p]) => [id, { x: p.x, y: p.y }]));
}

export function writeSavedPosition(key: string, id: string, position: Point): void {
  const raw = readJson<Record<string, SavedPosition>>(key, {});
  raw[id] = { ...position, isFixed: true };
  writeJson(key, raw);
}

export function clearSavedPositions(key: string): void {
  writeJson(key, {});
}
