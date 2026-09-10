import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Модальное окно. Размеры сняты с эталона: полотно 960×640 (`w-[60rem] h-[40rem]`),
 * радиус 8, тёмная подложка поверх страницы; закрывается по Escape и клику мимо.
 */
export function Modal({
  open,
  onClose,
  children,
  width = 960,
  height,
  autoHeight = false,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  height?: number;
  /** Окно растёт по содержимому (не выше 90 % экрана) — так открыты настройки узла. */
  autoHeight?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[3000] bg-[rgba(0,0,0,0.5)]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={`fixed left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg bg-bg-elevated text-text-primary shadow-[var(--shadow-lg)] ${
          autoHeight ? "max-h-[90vh]" : "max-h-[calc(100vh-2rem)]"
        }`}
        style={{ width, height: autoHeight ? undefined : (height ?? 640) }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
