import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Задержка появления, измеренная на эталоне (≈330 мс). */
const OPEN_DELAY = 330;
/** Пока курсор идёт от объекта к карточке, она не должна исчезать. */
const CLOSE_DELAY = 160;

/**
 * Панель, всплывающая по наведению. Как и `Popover`, рисуется порталом в `body`:
 * холст графа обрезает содержимое по `overflow`. Встаёт справа от объекта по центру,
 * а если справа не хватает места — слева (так же ведёт себя эталон).
 */
export function HoverCard({
  children,
  card,
  disabled = false,
  className,
}: {
  children: ReactNode;
  card: ReactNode;
  disabled?: boolean;
  /** Классы обёртки: она должна повторять геометрию объекта, иначе наведение не ловится. */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<number>(0);

  const schedule = useCallback((next: boolean) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(next), next ? OPEN_DELAY : CLOSE_DELAY);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      const p = panel.current?.getBoundingClientRect();
      if (!a || !p) return;
      const gap = 8;
      const right = a.right + gap;
      const left = right + p.width < window.innerWidth - 8 ? right : a.left - gap - p.width;
      setPos({
        top: Math.max(8, Math.min(a.top + a.height / 2 - p.height / 2, window.innerHeight - p.height - 8)),
        left: Math.max(8, left),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  return (
    <div
      ref={anchor}
      className={className}
      onMouseEnter={() => !disabled && schedule(true)}
      onMouseLeave={() => schedule(false)}
    >
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
