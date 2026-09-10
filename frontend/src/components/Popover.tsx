import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Всплывающая панель. Рисуется порталом в `body`: панели шапки и лога лежат в
 * контейнерах с `overflow: hidden`, и вложенный `absolute` там обрезается.
 * Закрывается по клику вне и по Escape; положение считается от триггера.
 */
interface Props {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (props: { close: () => void }) => ReactNode;
  /** Ширина панели; в эталоне списки и состояние — 288 px (`w-72`).
      Без неё панель растягивается по содержимому (так устроено меню `Interrupts`). */
  width?: number;
  /** Наименьшая ширина панели без заданной `width`: у меню эталона это 160 px. */
  minWidth?: number;
  /** `screen-end` прижимает панель к правому краю окна — так открыт `View state`. */
  align?: "start" | "end" | "screen-end";
  /** Ограничение высоты панели; у `View state` эталон держит половину экрана. */
  maxHeight?: string;
  /** Раскрывать вверх — для элементов у нижней кромки окна. */
  up?: boolean;
  /** Панель сама прокручивает содержимое. Выключается там, где прокрутка внутри
      (`View state`): иначе вместе с телом уезжают шапка и вкладки. */
  scrollable?: boolean;
}

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
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    const place = () => {
      const r = anchor.current?.getBoundingClientRect();
      if (!r) return;
      // Без заданной ширины панель меряется по факту: она уже в DOM, просто спрятана
      const w = width ?? panel.current?.offsetWidth ?? 0;
      const left = align === "screen-end" ? window.innerWidth - w : align === "end" ? r.right - w : r.left;
      const top = up ? r.top - 4 : r.bottom + 3;
      setPos({
        top,
        left:
          align === "screen-end"
            ? Math.max(0, left)
            : Math.max(8, Math.min(left, window.innerWidth - w - 8)),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, align, width, up]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!anchor.current?.contains(t) && !panel.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative flex" ref={anchor}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open &&
        createPortal(
          <div
            ref={panel}
            className={`fixed z-[1300] rounded-md border border-border-secondary bg-bg-elevated shadow-[var(--shadow-lg)] ${
              scrollable ? "scroll-thin overflow-y-auto" : "flex flex-col overflow-hidden"
            }`}
            style={{
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              width,
              minWidth,
              maxHeight,
              // До первого замера панель уже в DOM, но не показана: иначе её нечем мерить
              visibility: pos ? undefined : "hidden",
              transform: up ? "translateY(-100%)" : undefined,
            }}
          >
            {children({ close: () => setOpen(false) })}
          </div>,
          document.body,
        )}
    </div>
  );
}
