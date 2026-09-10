import { relativeTime } from "@/lib/time";
import { useNow } from "@/hooks/useNow";

/** The time is recomputed every five seconds so "now" does not freeze. */
export function RelativeTime({ ts }: { ts: number }) {
  useNow(5000);
  return <>{relativeTime(ts)}</>;
}
