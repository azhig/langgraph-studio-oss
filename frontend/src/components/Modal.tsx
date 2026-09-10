import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useEscapeKey } from "@/hooks/useDismiss";

/**
 * Modal dialog. Sizes taken from the reference: a 960×640 canvas (`w-[60rem] h-[40rem]`),
 * radius 8, a dark backdrop over the page; closes on Escape and outside click.
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
  /** The dialog grows with its content (up to 90% of the screen) — this is how node settings open. */
  autoHeight?: boolean;
}) {
  useEscapeKey(open, onClose);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[3000] bg-[rgba(0,0,0,0.5)]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={`fixed top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg bg-bg-elevated text-text-primary shadow-[var(--shadow-lg)] ${
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
