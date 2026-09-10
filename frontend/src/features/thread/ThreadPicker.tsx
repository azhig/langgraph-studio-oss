import { useCallback, useState } from "react";
import type { Thread } from "@langchain/langgraph-sdk";
import { ChevronDown, Copy, CircleAlert, LoaderCircle, MessageSquare, Pause } from "lucide-react";
import { getClient } from "@/api/client";
import { useStudio } from "@/store/studio";
import { useStudioStream } from "@/features/run/StreamProvider";
import { Popover } from "@/components/Popover";
import { Tooltip } from "@/components/Tooltip";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { relativeTime } from "./time";

const PAGE = 20;

/**
 * Выбор треда: кнопка `Thread <id> ▾` и список последних тредов текущего графа.
 * Ширина панели, строка с аватаром состояния, копирование идентификатора и
 * `Load more` повторяют эталон.
 */
export function ThreadPicker() {
  const { threadId, openThread } = useStudioStream();
  const assistants = useStudio((s) => s.assistants);
  const assistantId = useStudio((s) => s.assistantId);
  const graphId = assistants.find((a) => a.assistant_id === assistantId)?.graph_id;

  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const load = useCallback(
    async (offset: number) => {
      if (!graphId) return;
      setLoading(true);
      try {
        const page = await getClient().threads.search({
          limit: PAGE,
          offset,
          metadata: { graph_id: graphId },
        });
        setThreads((prev) => (offset ? [...prev, ...page] : page));
        setDone(page.length < PAGE);
      } finally {
        setLoading(false);
      }
    },
    [graphId],
  );

  return (
    <Popover
      width={288}
      trigger={({ toggle }) => (
        <Tooltip label={threadId ? `Thread: ${threadId}` : "New Thread"}>
        <button
          type="button"
          data-testid="graph-thread-select-trigger"
          className="btn btn-ghost min-w-0 !px-2 !py-1 text-text-secondary"
          onClick={() => {
            toggle();
            void load(0);
          }}
        >
          {threadId ? (
            <>
              <span className="shrink-0 font-medium">Thread</span>
              <span className="min-w-0 truncate">{threadId}</span>
            </>
          ) : (
            <span className="font-medium">New Thread</span>
          )}
          <ChevronDown size={16} strokeWidth={1.5} className="shrink-0" />
        </button>
        </Tooltip>
      )}
    >
      {({ close }) => (
        <div className="flex flex-col p-4">
          {threads.map((t) => (
            <ThreadRow
              key={t.thread_id}
              thread={t}
              active={t.thread_id === threadId}
              onOpen={() => {
                openThread(t.thread_id);
                close();
              }}
            />
          ))}
          {!threads.length && !loading && (
            <div className="py-2 text-sm text-text-tertiary">No threads yet</div>
          )}
          {loading && (
            <div className="flex items-center gap-2 py-2 text-sm text-text-tertiary">
              <LoaderCircle size={16} className="animate-spin" />
              Loading…
            </div>
          )}
          {!done && !loading && threads.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost mt-2 self-start !px-2"
              onClick={() => void load(threads.length)}
            >
              Load more
            </button>
          )}
          <OpenById
            onOpen={(id) => {
              openThread(id);
              close();
            }}
          />
          <CancelAllRuns />
        </div>
      )}
    </Popover>
  );
}

/**
 * `Cancel all pending runs`: снимает незавершённые прогоны во всех тредах графа.
 * Сервер не умеет отменять их одним запросом, поэтому обходим занятые треды
 * и отменяем их прогоны по одному — результат тот же, что у эталона.
 */
function CancelAllRuns() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  const cancelAll = async () => {
    setBusy(true);
    try {
      const client = getClient();
      const busyThreads = await client.threads.search({ status: "busy", limit: 100 });
      let cancelled = 0;
      for (const thread of busyThreads) {
        const runs = await client.runs.list(thread.thread_id, { limit: 50 });
        for (const run of runs) {
          if (run.status !== "pending" && run.status !== "running") continue;
          await client.runs.cancel(thread.thread_id, run.run_id);
          cancelled += 1;
        }
      }
      setDone(cancelled);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="btn btn-ghost mt-2 self-start !px-2" onClick={() => setOpen(true)}>
        Cancel all pending runs
      </button>
      {done !== null && (
        <span className="px-2 text-[13px] text-text-tertiary">
          {done} run{done === 1 ? "" : "s"} cancelled
        </span>
      )}
      <ConfirmDialog
        open={open}
        busy={busy}
        title="Cancel all pending runs"
        description="Are you sure you want to cancel all pending runs?"
        confirmText="Cancel all pending runs"
        onConfirm={() => void cancelAll()}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function ThreadRow({ thread, active, onOpen }: { thread: Thread; active: boolean; onOpen: () => void }) {
  const status = thread.status ?? "idle";
  return (
    <div className="group grid grid-cols-[1fr_auto] py-0">
      <button
        type="button"
        className={`grid grid-cols-[auto_1fr] items-center gap-3 pb-3 pt-2 text-left ${active ? "opacity-100" : ""}`}
        onClick={onOpen}
      >
        <StatusAvatar status={status} />
        <span className="flex min-w-0 flex-col text-left">
          <span className="grid grid-cols-[1fr_auto] items-center gap-1">
            <span className="truncate text-sm">{thread.thread_id}</span>
            <span
              role="button"
              tabIndex={0}
              title="Copy ID"
              className="btn btn-ghost btn-icon !p-1 text-text-secondary"
              onClick={(e) => {
                e.stopPropagation();
                void navigator.clipboard?.writeText(thread.thread_id);
              }}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <Copy size={16} strokeWidth={1.5} />
            </span>
          </span>
          <span className="flex items-center gap-2 text-xs text-text-tertiary">
            <span className="truncate">{(thread.metadata as { graph_id?: string } | undefined)?.graph_id}</span>
            <span>·</span>
            <span className="whitespace-nowrap">{relativeTime(Date.parse(thread.updated_at))}</span>
          </span>
        </span>
      </button>
    </div>
  );
}

/** Кружок 32 px слева от идентификатора: цвет и иконка отражают состояние треда. */
function StatusAvatar({ status }: { status: string }) {
  const look: Record<string, { cls: string; icon: typeof MessageSquare }> = {
    idle: { cls: "bg-bg-tertiary text-text-secondary", icon: MessageSquare },
    busy: { cls: "bg-bg-brand-tertiary text-text-brand-secondary", icon: LoaderCircle },
    interrupted: { cls: "bg-bg-tertiary text-text-tertiary", icon: Pause },
    error: { cls: "bg-bg-error-secondary text-text-error-secondary", icon: CircleAlert },
  };
  const { cls, icon: Icon } = look[status] ?? look.idle;
  return (
    <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${cls}`}>
      <Icon size={20} strokeWidth={1.5} className={status === "busy" ? "animate-spin" : undefined} />
    </span>
  );
}

function OpenById({ onOpen }: { onOpen: (id: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="mt-2 flex items-center gap-2 border-t border-border-secondary pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        const id = value.trim();
        if (id) onOpen(id);
      }}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Open thread via ID"
        className="min-w-0 flex-1 rounded-md border border-border-secondary bg-transparent px-2 py-1 text-sm outline-none placeholder:text-text-placeholder focus:border-border-brand"
      />
      <button type="submit" className="btn btn-outline h-[26px]" disabled={!value.trim()}>
        Open
      </button>
    </form>
  );
}
