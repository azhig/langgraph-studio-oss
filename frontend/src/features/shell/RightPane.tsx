import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { useStudio } from "@/store/studio";
import { useRun, type Detail } from "@/store/run";
import { useStudioStream } from "@/features/run/StreamProvider";
import { ThreadLog } from "@/features/thread/ThreadLog";
import { Tooltip } from "@/components/Tooltip";
import { RightHeader } from "./Header";

/** Правая панель: шапка, слайдер детализации и содержимое вкладки Interact / Trace. */
export function RightPane() {
  const rightTab = useStudio((s) => s.rightTab);
  const { threadId, history } = useStudioStream();
  const scroller = useRef<HTMLDivElement>(null);
  // Эталон открывает тред на последнем шаге, а не на первом
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
        {rightTab === "interact" ? <Interact /> : <TracePlaceholder />}
      </div>
      <DetailSlider />
    </div>
  );
}

/**
 * Слайдер глубины лога: 0 — сводка хода, 1 — записи узлов, 2 — их содержимое,
 * 3 — значения раскрыты целиком. Позиция и размеры по эталону: правый верх,
 * 120 px, дорожка 6 px, бегунок 16 px; работают клик по дорожке, перетаскивание,
 * стрелки и Home/End.
 */
function DetailSlider() {
  const value = useRun((s) => s.detail);
  const setDetail = useRun((s) => s.setDetail);
  // Четвёртый уровень есть только там, где в логе бывают шаги подграфов
  const max = useStudio((s) => (s.subgraphs.length ? 3 : 2));
  const track = useRef<HTMLSpanElement>(null);
  const pct = (Math.min(value, max) / max) * 100;

  const set = useCallback(
    (next: number) => setDetail(Math.min(max, Math.max(0, next)) as Detail),
    [setDetail, max],
  );

  /** Позиция курсора → ближайший уровень: так ведёт себя ползунок эталона. */
  const fromPointer = useCallback(
    (clientX: number) => {
      const r = track.current?.getBoundingClientRect();
      if (!r || !r.width) return;
      set(Math.round(((clientX - r.left) / r.width) * max));
    },
    [set, max],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    fromPointer(e.clientX);
  };

  return (
    <div className="absolute right-0 top-[80px] z-[6] ml-auto flex w-[120px] items-center gap-2 px-4">
      <Tooltip label="Set the level of detail for the thread log." className="flex w-full">
      <span
        ref={track}
        className="relative flex w-full cursor-pointer touch-none select-none items-center"
        data-testid="thread-info-level-slider"
        onPointerDown={onPointerDown}
        onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && fromPointer(e.clientX)}
      >
        <span className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-bg-quaternary">
          <span className="absolute h-full bg-bg-control-active" style={{ width: `${pct}%` }} />
        </span>
        <span
          role="slider"
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-label="Set the level of detail for the thread log."
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") set(value - 1);
            if (e.key === "ArrowRight" || e.key === "ArrowUp") set(value + 1);
            if (e.key === "Home") set(0);
            if (e.key === "End") set(max);
          }}
          className="absolute block size-4 cursor-pointer rounded-full border-2 border-border-slider-thumb bg-white shadow"
          style={{ left: `calc(${pct}% - 8px)` }}
        />
      </span>
      </Tooltip>
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
        <div className="text-base text-text-tertiary">Submit your input to run the assistant</div>
      </div>
    </div>
  );
}

function TracePlaceholder() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
      <div className="text-base font-medium text-text-primary">No runs found</div>
      <div className="max-w-md text-sm text-text-tertiary">
        The Trace tab shows LangSmith runs. Tracing is a cloud feature and is not available on a local server
        without a LangSmith API key.
      </div>
    </div>
  );
}
