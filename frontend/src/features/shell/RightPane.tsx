import { Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { useRun } from "@/store/run";
import { useStudioStream } from "@/features/run/StreamProvider";
import { ThreadLog } from "@/features/thread/ThreadLog";
import { DetailSlider } from "@/features/thread/DetailSlider";
import { RightHeader } from "./Header";

/** Right pane: header, detail-level slider and the thread log. */
export function RightPane() {
  const { threadId, history } = useStudioStream();
  const scroller = useRef<HTMLDivElement>(null);
  // The reference opens the thread at the last step, not the first
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const t = window.setTimeout(() => el.scrollTo({ top: el.scrollHeight }), 60);
    return () => window.clearTimeout(t);
  }, [threadId, history.length]);

  return (
    <div className="relative flex h-full min-w-0 flex-col overflow-hidden border-l border-border-secondary bg-bg-primary">
      <RightHeader />
      <div
        ref={scroller}
        data-testid="thread-log"
        className="scroll-thin flex flex-1 flex-col overflow-y-auto border-t border-border-secondary bg-bg-primary"
      >
        <Interact />
      </div>
      <DetailSlider />
    </div>
  );
}

function Interact() {
  const live = useRun((s) => s.entries.length > 0);
  const hasHistory = useStudioStream().history.length > 0;
  return live || hasHistory ? <ThreadLog /> : <EmptyThread />;
}

function EmptyThread() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <div className="flex size-14 items-center justify-center rounded-xl border border-border-secondary bg-bg-elevated">
        <Sparkles size={16} strokeWidth={1.6} className="text-text-secondary" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="text-xl font-semibold tracking-[-0.8px] text-text-primary">New Thread</div>
        <div className="text-base text-text-tertiary">Fill in the input and press Submit to start a run</div>
      </div>
    </div>
  );
}
