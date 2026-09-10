import { useEffect, type RefObject } from "react";

/** Dismiss on Escape while `active`. */
export function useEscapeKey(active: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, onEscape]);
}

/** Dismiss on a click outside the listed elements (the panel and its trigger) while `active`. */
export function useOutsideClick(
  active: boolean,
  inside: Array<RefObject<HTMLElement | null>>,
  onOutside: () => void,
): void {
  useEffect(() => {
    if (!active) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!inside.some((ref) => ref.current?.contains(target))) onOutside();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
    // The ref list has a stable length: the array is created at the call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, onOutside, ...inside]);
}
