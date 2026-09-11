import type { StateCreator } from "zustand";
import { readString, storageKeys, writeString } from "@/lib/storage";
import { asUpdates, errorText, type Detail, type LogEntry, type TaskEventData } from "./types";

/**
 * Log of the running run and node highlighting on the canvas.
 *
 * The event stream itself is driven by `useStream` (features/run/StreamProvider.tsx); its
 * callbacks feed in what needs drawing: log records and the name of the running node.
 * When the server returns thread history, the same steps come from it — run records
 * are cleared so they are not duplicated.
 */
export interface LogSlice {
  entries: LogEntry[];
  running: boolean;
  /** Log detail level; remembered across sessions, as in the reference. */
  detail: Detail;
  /**
   * Bumped every time the level re-applies its own defaults to the records. Levels 0-2 do that
   * (a record collapsed by hand opens again), the top level only expands values, so records
   * keep whatever the user did to them — this is what the reference does.
   */
  recordsEpoch: number;
  /** Input of the current run: shown as a `__start__` record after the first checkpoint. */
  pendingStart?: Record<string, unknown>;
  /** The node executing right now: it stays bright, the rest dim. */
  activeNode?: string;
  /** The node where the run failed (`Error` badge to the right of the node). */
  errorNode?: string;
  /**
   * Node under the cursor: hovering a log record highlights it on the canvas
   * and dims the other nodes to 30 % — as the reference does.
   */
  hoverNode?: string;
  /** Run error: shown as a panel at the failed node in the log. */
  error?: string;

  addCheckpoint: (cp: { checkpointId?: string; values?: unknown; source?: string }) => void;
  setPendingStart: (input?: Record<string, unknown>) => void;
  addTask: (task: TaskEventData) => void;
  setRunning: (running: boolean) => void;
  setDetail: (detail: Detail) => void;
  setError: (message?: string) => void;
  /** The node where the thread stopped: highlighted with an `Error` badge. */
  setErrorNode: (node?: string, message?: string) => void;
  setHoverNode: (node?: string) => void;
  clearLog: () => void;
}

/**
 * Level from storage. Without a saved value the reference opens the log at node
 * records (level 1) — measured on live Studio with the key cleared.
 */
export function detailFromStorage(raw: string | null): Detail {
  if (raw === null) return 1;
  const saved = Number(raw);
  return saved === 0 || saved === 1 || saved === 2 || saved === 3 ? saved : 1;
}

const readDetail = () => detailFromStorage(readString(storageKeys.detailLevel));

let seq = 0;
const nextKey = () => `e${++seq}`;

export const createLogSlice: StateCreator<LogSlice, [], [], LogSlice> = (set) => ({
  entries: [],
  running: false,
  detail: readDetail(),
  recordsEpoch: 0,

  addCheckpoint: ({ checkpointId, values, source }) =>
    set((s) => {
      const ts = Date.now();
      const entries: LogEntry[] = [
        ...s.entries,
        { kind: "checkpoint", key: nextKey(), ts, checkpointId, values, turnStart: source === "input" },
      ];
      // The first checkpoint opens a turn: right after it the reference shows
      // a `__start__` record with what the user submitted.
      if (source === "input" && s.pendingStart) {
        entries.push({ kind: "node", key: nextKey(), node: "__start__", ts, updates: s.pendingStart, done: true });
      }
      return { entries, pendingStart: source === "input" ? undefined : s.pendingStart };
    }),

  setPendingStart: (pendingStart) => set({ pendingStart }),

  /**
   * A task event arrives twice: when scheduled (has `input`) and on completion
   * (has `result` or `error`). The first creates a log record, the second completes it.
   */
  addTask: (task) => {
    const failure = errorText(task.error);
    const finished = "result" in task || failure !== undefined;
    if (!finished) {
      set((s) => ({
        entries: [
          ...s.entries,
          { kind: "node", key: nextKey(), node: task.name, taskId: task.id, ts: Date.now(), done: false },
        ],
        activeNode: task.name,
      }));
      return;
    }
    const updates = asUpdates(task.result);
    set((s) => ({
      entries: s.entries.map((e) =>
        e.kind === "node" && e.taskId === task.id ? { ...e, updates, done: true, error: failure } : e,
      ),
      activeNode: s.activeNode === task.name ? undefined : s.activeNode,
      errorNode: failure ? task.name : s.errorNode,
      error: failure ?? s.error,
    }));
  },

  setRunning: (running) => set((s) => ({ running, activeNode: running ? s.activeNode : undefined })),

  setDetail: (detail) => {
    writeString(storageKeys.detailLevel, String(detail));
    set((state) => ({ detail, recordsEpoch: state.recordsEpoch + (detail < 3 ? 1 : 0) }));
  },

  setError: (message) => set((s) => ({ error: message, errorNode: message ? s.activeNode : undefined })),
  setErrorNode: (errorNode, error) => set({ errorNode, error }),
  setHoverNode: (hoverNode) => set({ hoverNode }),

  clearLog: () =>
    set({ entries: [], activeNode: undefined, errorNode: undefined, error: undefined, pendingStart: undefined }),
});
