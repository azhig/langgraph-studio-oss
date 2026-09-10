import type { ThreadState } from "@langchain/langgraph-sdk";
import { asUpdates, errorText, type Interrupt, type LogEntry } from "@/store/run/types";

/**
 * Log records from thread history.
 *
 * `useStream` returns checkpoints from oldest to newest; each carries a time, the state
 * values and the tasks executed from it (`tasks[].result` — what the node
 * wrote). The first checkpoint of a turn is marked `metadata.source === "input"`, and its task
 * is the service `__start__` with the submitted input. That is enough to rebuild
 * the whole log: a time row, then a node record — as in the reference.
 */
export function entriesFromHistory(history: ThreadState<Record<string, unknown>>[]): LogEntry[] {
  const out: LogEntry[] = [];
  let first = true;
  for (const state of history) {
    const checkpointId = state.checkpoint?.checkpoint_id ?? undefined;
    const ts = state.created_at ? Date.parse(state.created_at) : Date.now();
    const source = (state.metadata as { source?: string } | undefined)?.source;
    out.push({
      kind: "checkpoint",
      key: `cp:${checkpointId ?? out.length}`,
      ts,
      checkpointId,
      values: state.values,
      turnStart: source === "input",
      // There is nothing to re-run from the very first checkpoint — the reference draws no button there
      root: first,
      next: state.next ? [...state.next] : undefined,
      tasks: (state.tasks ?? []) as unknown[],
      metadata: (state.metadata ?? undefined) as Record<string, unknown> | undefined,
    });
    first = false;
    for (const task of state.tasks ?? []) {
      out.push({
        kind: "node",
        key: `task:${checkpointId ?? ""}:${task.id}`,
        node: task.name,
        taskId: task.id,
        checkpointId,
        ts,
        updates: asUpdates(task.result),
        error: errorText(task.error),
        subgraphNs: (task.checkpoint as { checkpoint_ns?: string } | null | undefined)?.checkpoint_ns || undefined,
        interrupts: (task.interrupts ?? []) as Interrupt[],
        done: true,
      });
    }
  }
  return out;
}

export interface TurnGroup {
  key: string;
  entries: LogEntry[];
}

/** A turn starts with the run's input checkpoint (`source: "input"`). */
export function splitTurns(entries: LogEntry[]): TurnGroup[] {
  const turns: TurnGroup[] = [];
  for (const e of entries) {
    if ((e.kind === "checkpoint" && e.turnStart) || !turns.length) turns.push({ key: e.key, entries: [] });
    turns[turns.length - 1].entries.push(e);
  }
  return turns;
}
