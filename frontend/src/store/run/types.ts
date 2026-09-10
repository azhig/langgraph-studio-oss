/**
 * Thread log records and stream events.
 *
 * The log alternates checkpoints (a row with time and actions) and node
 * records (what the node wrote to the state). They are built from thread history in
 * `features/thread/history.ts`, and during a run — from `useStream` events.
 */

export interface CheckpointEntry {
  kind: "checkpoint";
  key: string;
  ts: number;
  checkpointId?: string;
  values?: unknown;
  /** First checkpoint of a run: a new turn (`TURN N`) starts from it. */
  turnStart?: boolean;
  /** The very first checkpoint of the thread: cannot re-run from it. */
  root?: boolean;
  /** Nodes that will execute from this checkpoint, its tasks and metadata — for the JSON tab. */
  next?: string[];
  tasks?: unknown[];
  metadata?: Record<string, unknown>;
}

export interface Interrupt {
  id?: string;
  value: unknown;
}

export interface NodeEntry {
  kind: "node";
  key: string;
  node: string;
  taskId?: string;
  /** Checkpoint the node was launched from: needed for state editing. */
  checkpointId?: string;
  ts: number;
  /** What the node wrote to the state. */
  updates?: Record<string, unknown>;
  error?: string;
  /** Dynamic `interrupt()` calls the node stopped at. */
  interrupts?: Interrupt[];
  /**
   * Subgraph namespace (`<node>:<task id>`) if the node is backed by a subgraph.
   * Used to request the subgraph history — the nested log inside the record.
   */
  subgraphNs?: string;
  done: boolean;
}

export type LogEntry = CheckpointEntry | NodeEntry;

/** Stream `tasks` event: when a task is scheduled it has `input`, on completion — `result` or `error`. */
export interface TaskEventData {
  id: string;
  name: string;
  input?: unknown;
  result?: Record<string, unknown> | Array<[string, unknown]>;
  /** In thread history the error arrives as a string, in a stream event — as a type/message pair. */
  error?: string | { error?: string; message?: string } | null;
  interrupts?: unknown[];
}

/**
 * Log detail slider: 0 — turn summary, 1 — node records, 2 — their contents,
 * 3 — values fully expanded (only for graphs with subgraphs).
 */
export type Detail = 0 | 1 | 2 | 3;

/** Converts an error to a string: an object cannot be shown in the log, nor is there a reason to. */
export function errorText(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const { error, message } = value as { error?: string; message?: string };
    if (error && message) return `${error}: ${message}`;
    if (message) return message;
    if (error) return error;
  }
  return String(value);
}

/** A task result arrives as an object of channels, sometimes as [channel, value] pairs. */
export function asUpdates(result: unknown): Record<string, unknown> | undefined {
  if (!result) return undefined;
  if (Array.isArray(result)) return Object.fromEntries(result as Array<[string, unknown]>);
  return result as Record<string, unknown>;
}
