import { Copy, Pencil, RefreshCw } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import { cx } from "@/lib/cx";
import { messageKind, messageText, type MessageLike } from "@/lib/messages";

/**
 * Message card. Taken from the reference: header with the role (`px-4 py-3`, 12px
 * small-caps label), the text below it on `border-t`. A human message has a 2 px
 * brand-colored border and a 10 % fill, aligned right and sized to content;
 * the others have a regular border across the full feed width.
 */
export function MessageCard({
  message,
  onEdit,
  onRegenerate,
}: {
  message: MessageLike;
  /** Edit a human message: the reference opens it in the input. */
  onEdit?: (message: MessageLike) => void;
  /** Regenerate the model's reply from this point. */
  onRegenerate?: (message: MessageLike) => void;
}) {
  const role = messageKind(message, "ai");
  const human = role === "human";
  const calls = message.tool_calls ?? [];
  const body = messageText(message.content);

  return (
    <div className={cx("group flex flex-col gap-1", human ? "ml-auto w-fit" : "w-full max-w-[800px]")}>
      <div
        data-testid="message-component"
        className={cx(
          "max-w-full rounded-lg",
          human ? "border-2 border-border-brand bg-bg-brand/10" : "w-full border border-border-muted bg-bg-primary",
        )}
      >
        <div className="flex w-full cursor-default items-center justify-between gap-3 px-4 py-3">
          <span className="flex items-center gap-1">
            <span
              className="text-xs leading-[18px] font-semibold text-text-tertiary uppercase"
              style={{ fontVariant: "small-caps" }}
            >
              {role}
            </span>
            {message.name && <span className="text-xs text-text-quaternary">{message.name}</span>}
          </span>
        </div>
        <div className="overflow-auto border-t border-border-muted">
          <div className="px-4 pt-3 pb-3 whitespace-pre-wrap">
            <span className="text-sm leading-[1.65] tracking-tight text-text-primary">{body}</span>
          </div>
          {calls.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-border-muted px-4 py-3">
              {calls.map((call, i) => (
                <div key={call.id ?? i} className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-text-tertiary uppercase">{call.name}</span>
                  <span className="text-sm whitespace-pre-wrap text-text-tertiary">
                    {JSON.stringify(call.args ?? {}, null, 2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Below the card the reference keeps actions: Copy and Edit for a human message,
          Copy and Regenerate for a model reply; shown on hover */}
      <div
        className={cx(
          "flex flex-row items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100",
          human ? "justify-end" : "justify-start",
        )}
      >
        <button type="button" aria-label="Copy" className="btn btn-ghost btn-icon !p-1" onClick={() => copyText(body)}>
          <Copy size={16} strokeWidth={1.5} />
        </button>
        {human ? (
          <button
            type="button"
            aria-label="Edit"
            className="btn btn-ghost btn-icon !p-1"
            onClick={() => onEdit?.(message)}
          >
            <Pencil size={16} strokeWidth={1.5} />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Regenerate"
            className="btn btn-ghost btn-icon !p-1"
            onClick={() => onRegenerate?.(message)}
          >
            <RefreshCw size={16} strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
}
