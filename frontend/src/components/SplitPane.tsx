import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  left: ReactNode;
  right: ReactNode;
  /** Default share of the left pane (exactly half in Studio). */
  defaultRatio?: number;
  minRatio?: number;
  maxRatio?: number;
  storageKey?: string;
}

/** Two panes with a draggable divider, as in Studio. The divider is invisible and highlighted while dragged. */
export function SplitPane({ left, right, defaultRatio = 0.5, minRatio = 0.25, maxRatio = 0.75, storageKey }: Props) {
  const [ratio, setRatio] = useState(() => {
    if (!storageKey) return defaultRatio;
    try {
      const v = Number(localStorage.getItem(storageKey));
      return v >= minRatio && v <= maxRatio ? v : defaultRatio;
    } catch {
      return defaultRatio;
    }
  });
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const next = Math.min(maxRatio, Math.max(minRatio, (e.clientX - r.left) / r.width));
      setRatio(next);
    };
    const up = () => {
      setDragging(false);
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, String(ratio));
        } catch {
          /* no persistence */
        }
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging, minRatio, maxRatio, ratio, storageKey]);

  return (
    <div ref={ref} className="flex h-full w-full" style={{ cursor: dragging ? "col-resize" : undefined }}>
      <div className="h-full min-w-0" style={{ width: `${ratio * 100}%` }}>
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        onPointerDown={onPointerDown}
        className={`relative z-20 w-0 shrink-0 cursor-col-resize ${dragging ? "text-bg-brand" : "text-transparent"}`}
      >
        <div className="absolute inset-y-0 -left-1 w-2" />
        <div className="absolute inset-y-0 left-0 w-px bg-current" />
      </div>
      <div className="h-full min-w-0 flex-1">{right}</div>
    </div>
  );
}
