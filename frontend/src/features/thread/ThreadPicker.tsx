import { useState } from "react";
import type { Thread } from "@langchain/langgraph-sdk";
import { ChevronDown, Copy, CircleAlert, LoaderCircle, MessageSquare, Pause } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import { relativeTime } from "@/lib/time";
import { getClient } from "@/api/client";
import { useCurrentAssistant } from "@/store/studio";
import { useStudioStream } from "@/features/run/StreamProvider";
import { usePagedThreads } from "@/hooks/usePagedThreads";
import { Popover } from "@/components/Popover";
import { Tooltip } from "@/components/Tooltip";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const PAGE = 20;

/**
 * Thread picker: a `Thread <id> ▾` button and the list of recent threads for the current graph.
 * Panel width, the status-avatar row, id copying and
 * `Load more` match the reference.
 */
export function ThreadPicker() {
  const { threadId, openThread } = useStudioStream();
  const graphId = useCurrentAssistant()?.graph_id;
  const { threads, loading, done, reload, loadMore } = usePagedThreads(PAGE, {
    metadata: graphId ? { graph_id: graphId } : undefined,
    enabled: Boolean(graphId),
  });

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
              void reload();
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
              onOpen={() => {
                openThread(t.thread_id);
                close();
              }}
            />
          ))}
          {!threads.length && !loading && <div className="py-2 text-sm text-text-tertiary">No threads yet</div>}
          {loading && (
            <div className="flex items-center gap-2 py-2 text-sm text-text-tertiary">
              <LoaderCircle size={16} className="animate-spin" />
              Loading…
            </div>
          )}
          {!done && !loading && threads.length > 0 && (
            <button type="button" className="btn btn-ghost mt-2 self-start !px-2" onClick={() => void loadMore()}>
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
 * `Cancel all pending runs`: cancels unfinished runs across all threads of the graph.
 * The server cannot cancel them in one request, so we walk the busy threads
 * and cancel their runs one by one — same outcome as the reference.
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

function ThreadRow({ thread, onOpen }: { thread: Thread; onOpen: () => void }) {
  return (
    <div className="group grid grid-cols-[1fr_auto] py-0">
      <button
        type="button"
        className="grid grid-cols-[auto_1fr] items-center gap-3 pt-2 pb-3 text-left"
        onClick={onOpen}
      >
        <StatusAvatar status={thread.status ?? "idle"} />
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
                copyText(thread.thread_id);
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

const STATUS_LOOK: Record<string, { cls: string; icon: typeof MessageSquare }> = {
  idle: { cls: "bg-bg-tertiary text-text-secondary", icon: MessageSquare },
  busy: { cls: "bg-bg-brand-tertiary text-text-brand-secondary", icon: LoaderCircle },
  interrupted: { cls: "bg-bg-tertiary text-text-tertiary", icon: Pause },
  error: { cls: "bg-bg-error-secondary text-text-error-secondary", icon: CircleAlert },
};

/** 32 px circle left of the id: color and icon reflect the thread status. */
function StatusAvatar({ status }: { status: string }) {
  const { cls, icon: Icon } = STATUS_LOOK[status] ?? STATUS_LOOK.idle;
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
