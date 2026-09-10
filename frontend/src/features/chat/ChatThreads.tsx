import { useEffect } from "react";
import type { Thread } from "@langchain/langgraph-sdk";
import { Info, Plus, X } from "lucide-react";
import { cx } from "@/lib/cx";
import { messagePlainText, type MessageLike } from "@/lib/messages";
import { useStudioStream } from "@/features/run/StreamProvider";
import { usePagedThreads } from "@/hooks/usePagedThreads";

const PAGE = 40;

/**
 * Threads panel to the right of the chat: 250 px wide, `Threads` heading with a `New` button
 * and a close cross. A thread row is labeled with its first message — that is how the reference
 * names conversations.
 */
export function ChatThreads({ onClose }: { onClose: () => void }) {
  const { threadId, openThread, newThread, isLoading } = useStudioStream();
  const { threads, loading, done, reload, loadMore } = usePagedThreads(PAGE);

  // Re-read after a run: the thread label is taken from its values
  useEffect(() => {
    if (!isLoading) void reload();
  }, [reload, threadId, isLoading]);

  return (
    <div className="flex h-full w-[250px] shrink-0 flex-col gap-3 bg-bg-primary p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs leading-tight font-semibold tracking-snug">Threads</span>
        <span className="flex items-center gap-1">
          <button type="button" className="btn btn-outline !px-2" disabled={!threadId} onClick={newThread}>
            <Plus size={14} strokeWidth={1.8} />
            New
          </button>
          <button
            type="button"
            aria-label="Close"
            className="btn btn-ghost btn-icon !rounded-md !p-2"
            onClick={onClose}
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        </span>
      </div>
      <div className="scroll-thin flex min-h-0 flex-1 flex-col overflow-y-auto">
        {threads.map((thread) => (
          <button
            key={thread.thread_id}
            type="button"
            className={cx(
              "flex w-full items-center justify-between gap-1 rounded-md border border-transparent px-2 py-2 text-left transition-colors hover:bg-bg-brand-secondary",
              thread.thread_id === threadId && "bg-bg-brand-secondary",
            )}
            onClick={() => openThread(thread.thread_id)}
          >
            <span className="line-clamp-1 truncate text-xs font-medium tracking-tighter text-text-secondary">
              {titleOf(thread)}
            </span>
            <Info size={14} strokeWidth={1.8} className="shrink-0 text-text-quaternary" />
          </button>
        ))}
        {!done && (
          <button
            type="button"
            className="btn btn-outline mx-auto mt-1"
            disabled={loading}
            onClick={() => void loadMore()}
          >
            Load more
          </button>
        )}
      </div>
    </div>
  );
}

/** Thread label: the text of the first message — the reference takes it regardless of role. */
function titleOf(thread: Thread): string {
  const messages = (thread.values as { messages?: MessageLike[] } | null)?.messages;
  const text = messagePlainText(messages?.[0]?.content).trim();
  // The reference labels a thread without messages the same as the create button
  return text || "New Thread";
}
