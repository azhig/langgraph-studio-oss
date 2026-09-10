import type { ThreadState } from "@langchain/langgraph-sdk";
import { errorText, type LogEntry } from "@/store/run";

/**
 * Записи лога из истории треда.
 *
 * `useStream` отдаёт контрольные точки от старых к новым; каждая несёт время, значения
 * состояния и задачи, которые из неё выполнялись (`tasks[].result` — то, что узел
 * записал). Первая точка хода помечена `metadata.source === "input"`, и её задача —
 * служебный `__start__` с отправленным вводом. Этого достаточно, чтобы восстановить
 * лог целиком: строка времени, затем запись узла — как в эталоне.
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
      // С самой первой точки треда перезапускать нечего — эталон там кнопку не рисует
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
        interrupts: (task.interrupts ?? []) as Array<{ id?: string; value: unknown }>,
        done: true,
      });
    }
  }
  return out;
}

/** Результат задачи приходит объектом каналов, иногда — парами [канал, значение]. */
function asUpdates(result: unknown): Record<string, unknown> | undefined {
  if (!result) return undefined;
  if (Array.isArray(result)) return Object.fromEntries(result as Array<[string, unknown]>);
  return result as Record<string, unknown>;
}
