import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Задержка перед показом, измеренная на эталоне (≈700 мс). */
const DELAY = 700;

/**
 * Подсказка по наведению. Эталон рисует её порталом: белая карточка 14 px с
 * отступом 8 px и радиусом 6, снизу от элемента. Нативный `title` не годится —
 * у него другой вид и другая задержка.
 */
export function Tooltip({
  label,
  children,
  className,
  side = "bottom",
}: {
  label: ReactNode;
  children: ReactNode;
  /** Классы обёртки: она должна повторять геометрию элемента. */
  className?: string;
  side?: "bottom" | "top";
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<number>(0);

  const schedule = useCallback((next: boolean) => {
    window.clearTimeout(timer.current);
    if (!next) {
      setOpen(false);
      return;
    }
    timer.current = window.setTimeout(() => setOpen(true), DELAY);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      const p = panel.current?.getBoundingClientRect();
      if (!a || !p) return;
      const top = side === "top" ? a.top - p.height - 6 : a.bottom + 6;
      setPos({
        top: Math.max(4, top),
        left: Math.max(4, Math.min(a.left + a.width / 2 - p.width / 2, window.innerWidth - p.width - 4)),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, side]);

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
            className="pointer-events-none fixed z-[1400] max-w-[320px] rounded-md bg-bg-elevated p-2 text-sm text-text-primary shadow-[var(--shadow-lg)]"
            style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? undefined : "hidden" }}
          >
            {label}
          </div>,
          document.body,
        )}
    </span>
  );
}
