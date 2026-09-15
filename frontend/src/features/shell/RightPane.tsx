import { Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { useRun } from "@/store/run";
import { useStudioStream } from "@/features/run/StreamProvider";
import { ThreadLog } from "@/features/thread/ThreadLog";
import { DetailSlider } from "@/features/thread/DetailSlider";
import { RightHeader } from "./Header";

/** How close to the end still counts as "the user is watching the last step". */
const STICK_EDGE = 32;

/** Right pane: header, detail-level slider and the thread log. */
export function RightPane() {
  const { threadId } = useStudioStream();
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  // While the log is scrolled to the end it follows the run, as in the reference;
  // scrolling up stops that until the user comes back down
  const stick = useRef(true);
  const lastTop = useRef(0);

  // The reference opens the thread at the last step, not the first
  useEffect(() => {
    stick.current = true;
    const el = scroller.current;
    if (!el) return;
    const t = window.setTimeout(() => el.scrollTo({ top: el.scrollHeight }), 60);
    return () => window.clearTimeout(t);
  }, [threadId]);

  // New steps and streamed text make the log taller: keep the end in view
  useEffect(() => {
    const el = scroller.current;
    const inner = content.current;
    if (!el || !inner) return;
    const observer = new ResizeObserver(() => {
      if (stick.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative flex h-full min-w-0 flex-col overflow-hidden border-l border-border-secondary bg-bg-primary">
      <RightHeader />
      <div
        ref={scroller}
        data-testid="thread-log"
        className="scroll-thin flex flex-1 flex-col overflow-y-auto border-t border-border-secondary bg-bg-primary"
        onScroll={(e) => {
          // Only a scroll upwards is the user's own: growing content scrolls downwards,
          // and taking that for a user action would break the following straight away
          const el = e.currentTarget;
          const up = el.scrollTop < lastTop.current - 1;
          lastTop.current = el.scrollTop;
          if (up) stick.current = false;
          else if (el.scrollHeight - el.clientHeight - el.scrollTop < STICK_EDGE) stick.current = true;
        }}
      >
        <div ref={content} className="flex flex-1 flex-col">
          <Interact />
        </div>
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
