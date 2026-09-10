import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx } from "@/lib/cx";
import { useAnchoredPosition, type Placer } from "@/hooks/useAnchoredPosition";
import { useEscapeKey, useOutsideClick } from "@/hooks/useDismiss";

type Align = "start" | "end" | "screen-end";

interface Props {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (props: { close: () => void }) => ReactNode;
  /** Panel width; in the reference lists and state are 288 px (`w-72`).
      Without it the panel sizes to its content (this is how the `Interrupts` menu works). */
  width?: number;
  /** Minimum panel width when `width` is not set: 160 px for the reference's menus. */
  minWidth?: number;
  /** `screen-end` pins the panel to the window's right edge — this is how `View state` opens. */
  align?: Align;
  /** Panel height limit; for `View state` the reference keeps half the screen. */
  maxHeight?: string;
  /** Open upward — for elements near the bottom edge of the window. */
  up?: boolean;
  /** The panel scrolls its own content. Disabled where scrolling happens inside:
      otherwise the header and tabs scroll away with the body. */
  scrollable?: boolean;
}

/** Below the trigger with a 3 px gap (4 px above it); horizontally from its left or right edge. */
function placer(align: Align, up: boolean, width?: number): Placer {
  return (r, p) => {
    // Without a set width the panel is measured as rendered: it is already in the DOM, just hidden
    const w = width ?? p.width;
    const left = align === "screen-end" ? window.innerWidth - w : align === "end" ? r.right - w : r.left;
    return {
      top: up ? r.top - 4 : r.bottom + 3,
      left: align === "screen-end" ? Math.max(0, left) : Math.max(8, Math.min(left, window.innerWidth - w - 8)),
    };
  };
}

/**
 * Popover panel. Rendered via a portal into `body`: the header and log panels live in
 * containers with `overflow: hidden`, where a nested `absolute` gets clipped.
 * Closes on outside click and Escape; the position is computed from the trigger.
 */
export function Popover({
  trigger,
  children,
  width,
  minWidth,
  align = "start",
  up = false,
  maxHeight = "70vh",
  scrollable = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const place = useMemo(() => placer(align, up, width), [align, up, width]);
  const pos = useAnchoredPosition(open, anchor, panel, place);
  const close = useCallback(() => setOpen(false), []);

  useEscapeKey(open, close);
  useOutsideClick(open, [anchor, panel], close);

  return (
    <div className="relative flex" ref={anchor}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open &&
        createPortal(
          <div
            ref={panel}
            className={cx(
              "fixed z-[1300] rounded-md border border-border-secondary bg-bg-elevated shadow-[var(--shadow-lg)]",
              scrollable ? "scroll-thin overflow-y-auto" : "flex flex-col overflow-hidden",
            )}
            style={{
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              width,
              minWidth,
              maxHeight,
              // Before the first measurement the panel is in the DOM but not shown: otherwise there is nothing to measure
              visibility: pos ? undefined : "hidden",
              transform: up ? "translateY(-100%)" : undefined,
            }}
          >
            {children({ close })}
          </div>,
          document.body,
        )}
    </div>
  );
}
