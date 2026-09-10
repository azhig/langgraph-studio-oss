import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { clampToViewport, useAnchoredPosition, type Placer } from "@/hooks/useAnchoredPosition";

/** Appearance delay measured on the reference (≈330 ms). */
const OPEN_DELAY = 330;
/** The card must not disappear while the cursor travels from the target to it. */
const CLOSE_DELAY = 160;
const GAP = 8;

/** To the right of the target, vertically centered; on the left if there is no room on the right (matches the reference). */
const placeBeside: Placer = (a, p) => {
  const right = a.right + GAP;
  const left = right + p.width < window.innerWidth - GAP ? right : a.left - GAP - p.width;
  return {
    top: clampToViewport(a.top + a.height / 2 - p.height / 2, p.height, window.innerHeight, GAP),
    left: Math.max(GAP, left),
  };
};

/**
 * Panel shown on hover. Like `Popover`, it is rendered via a portal into `body`:
 * the graph canvas clips its content with `overflow`.
 */
export function HoverCard({
  children,
  card,
  className,
}: {
  children: ReactNode;
  card: ReactNode;
  /** Wrapper classes: it must mirror the target's geometry, otherwise hover is not caught. */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<number>(0);
  const pos = useAnchoredPosition(open, anchor, panel, placeBeside);

  const schedule = useCallback((next: boolean) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(next), next ? OPEN_DELAY : CLOSE_DELAY);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <div ref={anchor} className={className} onMouseEnter={() => schedule(true)} onMouseLeave={() => schedule(false)}>
      {children}
      {open &&
        createPortal(
          <div
            ref={panel}
            className="fixed z-[1300]"
            style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? undefined : "hidden" }}
            onMouseEnter={() => window.clearTimeout(timer.current)}
            onMouseLeave={() => schedule(false)}
          >
            {card}
          </div>,
          document.body,
        )}
    </div>
  );
}
