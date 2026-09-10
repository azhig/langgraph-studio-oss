import { useState } from "react";
import { ChevronRight, Copy, CircleAlert } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import { cx } from "@/lib/cx";

/**
 * Error panel below a node record.
 *
 * Taken from the reference: a `bg-error` bar with 4 px radius and `2px 4px 2px 6px` padding,
 * a round 16 px icon on `--bg-error-subtle`, the `Error` label and the error text — 12px/16px.
 * Collapsed, it shows one line with an ellipsis; buttons on the right — copy
 * and expand the full message.
 */
export function ErrorBlock({ message }: { message: string }) {
  const [open, setOpen] = useState(false);
  const full = formatError(message);
  return (
    <div className="w-full rounded-sm bg-bg-error py-0.5 pr-1 pl-1.5">
      <div className="flex w-full items-start gap-2">
        <span className="shrink-0 pt-px">
          <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-bg-error-subtle p-[2px] text-text-error-tertiary">
            <CircleAlert size={12} strokeWidth={1.5} />
          </span>
        </span>
        <div className="flex min-w-0 flex-1 flex-row gap-1">
          <span className="flex shrink-0 items-center text-xxs leading-4 font-medium whitespace-nowrap text-text-error-secondary dark:text-text-error-tertiary">
            Error
          </span>
          <span
            aria-hidden={open}
            className={cx(
              "min-w-0 truncate text-xxs leading-4 whitespace-nowrap text-text-error-secondary dark:text-text-error-primary",
              open && "pointer-events-none h-0",
            )}
          >
            {message}
          </span>
        </div>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            title="Copy error"
            className="btn btn-ghost !rounded-xs !p-0.5 text-text-secondary"
            onClick={() => copyText(message)}
          >
            <Copy size={14} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            aria-label={open ? "Collapse" : "Show full error message"}
            aria-expanded={open}
            title={open ? "Collapse" : "Show full error message"}
            className="btn btn-ghost !rounded-xs !p-0.5 text-text-secondary"
            onClick={() => setOpen((v) => !v)}
          >
            <ChevronRight size={14} strokeWidth={1.5} className={cx("transition-transform", open && "rotate-90")} />
          </button>
        </div>
      </div>
      {/* The expanded error is a separate block below the panel header, as in the reference */}
      {open && (
        <div className="flex flex-col gap-1 pr-1 pb-1 pl-5">
          <span className="text-xxs leading-4 break-words whitespace-pre-wrap text-text-error-secondary dark:text-text-error-primary">
            {full}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * The message arrives as one line (`RuntimeError('…')`), while the reference splits it
 * into the name, indented arguments and the closing bracket.
 */
function formatError(message: string): string {
  const m = /^([A-Za-z_][\w.]*)\((.*)\)$/s.exec(message.trim());
  if (!m) return message;
  return `${m[1]}(\n  ${m[2]}\n)`;
}
