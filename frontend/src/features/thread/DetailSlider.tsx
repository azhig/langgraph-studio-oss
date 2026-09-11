import { useCallback, useRef } from "react";
import { useStudio } from "@/store/studio";
import { useRun, type Detail } from "@/store/run";
import { Tooltip } from "@/components/Tooltip";

/**
 * Log detail slider: 0 — turn summary, 1 — node records, 2 — their contents,
 * 3 — values fully expanded. Position and sizes follow the reference: top right,
 * 120 px, 6 px track, 16 px thumb; supports track clicks, dragging,
 * arrow keys and Home/End.
 */
export function DetailSlider() {
  const value = useRun((s) => s.detail);
  const setDetail = useRun((s) => s.setDetail);
  // The fourth level exists only where the log can contain subgraph steps
  const max = useStudio((s) => (s.subgraphs.length ? 3 : 2));
  const track = useRef<HTMLSpanElement>(null);
  const pct = (Math.min(value, max) / max) * 100;

  const set = useCallback((next: number) => setDetail(Math.min(max, Math.max(0, next)) as Detail), [setDetail, max]);

  /** Cursor position → nearest level: this is how the reference slider behaves. */
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
    <div className="absolute top-[75px] right-0 z-[6] ml-auto flex w-[120px] items-center gap-2 px-4">
      <Tooltip label="Set the level of detail for the thread log." className="flex w-full">
        <span
          ref={track}
          // The row is as tall as the thumb: the reference hangs the tooltip off the thumb,
          // so the gap below it must be measured from there, not from the 6 px track
          className="relative flex h-4 w-full cursor-pointer touch-none items-center select-none"
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
            className="absolute block size-4 cursor-pointer rounded-full border-2 border-border-slider-thumb bg-white shadow focus-visible:ring-2 focus-visible:ring-bg-control-active focus-visible:ring-offset-1 focus-visible:outline-none"
            // The reference keeps the thumb inside the track: it travels `track - 16 px`,
            // so at the ends its edge lines up with the track's, instead of hanging over it
            style={{ left: `calc(${pct}% - ${(pct / 100) * 16}px)` }}
          />
        </span>
      </Tooltip>
    </div>
  );
}
