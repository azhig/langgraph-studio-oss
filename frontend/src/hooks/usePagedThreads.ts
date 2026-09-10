import { useCallback, useMemo, useState } from "react";
import type { Thread } from "@langchain/langgraph-sdk";
import { getClient } from "@/api/client";

export interface PagedThreads {
  threads: Thread[];
  loading: boolean;
  /** The last page was incomplete — nothing more to load. */
  done: boolean;
  /** Reload from the beginning. */
  reload: () => Promise<void>;
  /** Load the next page. */
  loadMore: () => Promise<void>;
}

/**
 * Paged thread list — this is how both the thread picker in the header and the
 * thread panel in Chat mode work. `metadata` narrows the search (e.g. by `graph_id`);
 * no requests are sent until the filter is set where it is required.
 */
export function usePagedThreads(
  pageSize: number,
  options: { metadata?: Record<string, unknown>; enabled?: boolean } = {},
): PagedThreads {
  const { enabled = true } = options;
  // The filter is compared by content so a new object on every render does not recreate the loader
  const metadataKey = JSON.stringify(options.metadata ?? null);
  const metadata = useMemo(
    () => (metadataKey === "null" ? undefined : (JSON.parse(metadataKey) as Record<string, unknown>)),
    [metadataKey],
  );
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const load = useCallback(
    async (offset: number) => {
      if (!enabled) return;
      setLoading(true);
      try {
        const page = await getClient().threads.search({ limit: pageSize, offset, metadata });
        setThreads((prev) => (offset ? [...prev, ...page] : page));
        setDone(page.length < pageSize);
      } finally {
        setLoading(false);
      }
    },
    [enabled, pageSize, metadata],
  );

  return {
    threads,
    loading,
    done,
    reload: useCallback(() => load(0), [load]),
    loadMore: useCallback(() => load(threads.length), [load, threads.length]),
  };
}
