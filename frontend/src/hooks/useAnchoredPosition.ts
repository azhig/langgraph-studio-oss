import { useLayoutEffect, useState, type RefObject } from "react";

export interface Position {
  top: number;
  left: number;
}

/** Placement rule: given the anchor and panel rectangles, returns the panel's top-left corner. */
export type Placer = (anchor: DOMRect, panel: DOMRect) => Position;

/**
 * Position of a floating panel (tooltip, card, popover) relative to its anchor.
 *
 * The panel is rendered via a portal into `body` and must stay hidden until the first
 * measurement (`visibility: hidden` while `null`): otherwise there is nothing to measure. It is
 * recomputed on window resize and any scroll — the panel stays next to the anchor.
 *
 * An anchor with `display: contents` has no geometry of its own — then its first
 * child element is measured instead.
 */
export function useAnchoredPosition(
  open: boolean,
  anchor: RefObject<HTMLElement | null>,
  panel: RefObject<HTMLElement | null>,
  place: Placer,
): Position | null {
  const [pos, setPos] = useState<Position | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const host = anchor.current;
      const p = panel.current?.getBoundingClientRect();
      if (!host || !p) return;
      let a = host.getBoundingClientRect();
      if (!a.width && !a.height && host.firstElementChild) a = host.firstElementChild.getBoundingClientRect();
      const next = place(a, p);
      setPos((prev) => (prev && prev.top === next.top && prev.left === next.left ? prev : next));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchor, panel, place]);

  // `null` while closed; the previous position stays in state and is refined before the first paint
  return open ? pos : null;
}

/** Keeps the panel inside the window, leaving a `margin` gap. */
export const clampToViewport = (value: number, size: number, viewport: number, margin: number) =>
  Math.max(margin, Math.min(value, viewport - size - margin));
