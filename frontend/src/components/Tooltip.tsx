import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { clampToViewport, useAnchoredPosition, type Placer } from "@/hooks/useAnchoredPosition";

/** Delay before showing, measured on the reference (≈700 ms). */
const DELAY = 700;
/** Gap to the tooltip border: the reference uses 8 px on the sides, 6 px above and below. */
const GAP = { side: 8, stack: 6 };
const EDGE = 4;

type Side = "bottom" | "top" | "left" | "right";

/** On the side the panel is vertically centered on the target (the checkpoint id tooltip); above and below it is horizontally centered. */
function placer(side: Side): Placer {
  return (a, p) => {
    if (side === "left" || side === "right") {
      const left = side === "left" ? a.left - GAP.side - p.width : a.right + GAP.side;
      return {
        top: clampToViewport(a.top + a.height / 2 - p.height / 2, p.height, window.innerHeight, EDGE),
        left: clampToViewport(left, p.width, window.innerWidth, EDGE),
      };
    }
    const top = side === "top" ? a.top - p.height - GAP.stack : a.bottom + GAP.stack;
    return {
      top: Math.max(EDGE, top),
      left: clampToViewport(a.left + a.width / 2 - p.width / 2, p.width, window.innerWidth, EDGE),
    };
  };
}

/**
 * Hover tooltip. The reference renders it via a portal: a 14 px card with 8 px padding
 * and radius 6. The native `title` will not do — it looks different and has a different delay.
 */
export function Tooltip({
  label,
  children,
  className,
  side = "bottom",
}: {
  label: ReactNode;
  children: ReactNode;
  /** Wrapper classes: it must mirror the element's geometry. */
  className?: string;
  side?: Side;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<number>(0);
  const place = useMemo(() => placer(side), [side]);
  const pos = useAnchoredPosition(open, anchor, panel, place);

  const schedule = useCallback((next: boolean) => {
    window.clearTimeout(timer.current);
    if (!next) {
      setOpen(false);
      return;
    }
    timer.current = window.setTimeout(() => setOpen(true), DELAY);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <span
      ref={anchor}
      className={className ?? "contents"}
      onMouseEnter={() => schedule(true)}
      onMouseLeave={() => schedule(false)}
      onFocusCapture={() => schedule(true)}
      onBlurCapture={() => schedule(false)}
    >
      {children}
      {open &&
        createPortal(
          <div
            ref={panel}
            role="tooltip"
            className="pointer-events-none fixed z-[1400] max-w-[360px] overflow-hidden rounded-md border border-border-secondary bg-bg-elevated p-2 text-sm text-text-primary"
            style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? undefined : "hidden" }}
          >
            {label}
          </div>,
          document.body,
        )}
    </span>
  );
}
