import type { ReactNode } from "react";
import { Modal } from "./Modal";

/**
 * Confirmation of a dangerous action: title, explanation and two buttons.
 * The reference opens such a dialog, for example, before `Cancel all pending runs`.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmText,
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmText: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} width={480} autoHeight>
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-base leading-tight font-semibold tracking-tight">{title}</h3>
          <span className="text-sm text-text-tertiary">{description}</span>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button type="button" className="btn btn-outline !rounded-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary !rounded-sm" disabled={busy} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
