import { useCallback, useEffect, useState } from "react";
import type { Thread } from "@langchain/langgraph-sdk";
import { Info, Plus, X } from "lucide-react";
import { getClient } from "@/api/client";
import { useStudioStream } from "@/features/run/StreamProvider";

const PAGE = 40;

/**
 * Панель тредов справа от чата: ширина 250 px, заголовок `Threads` с кнопкой `New`
 * и крестиком. Строка треда подписана первым сообщением человека — так эталон
 * называет разговоры.
 */
export function ChatThreads({ onClose }: { onClose: () => void }) {
  const { threadId, openThread, newThread, isLoading } = useStudioStream();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (offset: number) => {
    setLoading(true);
    try {
      const page = await getClient().threads.search({ limit: PAGE, offset });
      setThreads((prev) => (offset ? [...prev, ...page] : page));
      setDone(page.length < PAGE);
    } finally {
      setLoading(false);
    }
  }, []);

  // Перечитываем после прогона: подпись треда берётся из его значений
  useEffect(() => {
    if (!isLoading) void load(0);
  }, [load, threadId, isLoading]);

  return (
    <div className="flex h-full w-[250px] shrink-0 flex-col gap-3 bg-bg-primary p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold leading-tight tracking-snug">Threads</span>
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
            className={`flex w-full items-center justify-between gap-1 rounded-md border border-transparent px-2 py-2 text-left transition-colors hover:bg-bg-brand-secondary ${
              thread.thread_id === threadId ? "bg-bg-brand-secondary" : ""
            }`}
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
            onClick={() => void load(threads.length)}
          >
            Load more
          </button>
        )}
      </div>
    </div>
  );
}

/** Подпись треда: текст первого сообщения — эталон берёт его независимо от роли. */
function titleOf(thread: Thread): string {
  const messages = (thread.values as { messages?: Array<{ type?: string; role?: string; content?: unknown }> } | null)
    ?.messages;
  const content = messages?.[0]?.content;
  if (typeof content === "string" && content.trim()) return content;
  if (Array.isArray(content)) {
    const text = content
      .map((part) => (typeof part === "string" ? part : ((part as { text?: string })?.text ?? "")))
      .join("")
      .trim();
    if (text) return text;
  }
  // Тред без сообщений эталон подписывает так же, как кнопку создания
  return "New Thread";
}
