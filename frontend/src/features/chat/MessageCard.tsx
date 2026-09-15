import { Copy, Pencil, RefreshCw } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import { cx } from "@/lib/cx";
import { messageKind, messageText, toolCalls, type MessageLike } from "@/lib/messages";
import { ToolCallList, ToolResult } from "./ToolBlocks";

/**
 * Message card. Taken from the reference: header with the role (`px-4 py-3`, 12px
 * small-caps label), the text below it on `border-t`. A human message has a 2 px
 * brand-colored border and a 10 % fill, aligned right and sized to content;
 * the others have a regular border across the full feed width.
 */
export function MessageCard({
  message,
  showTools = true,
  onEdit,
  onRegenerate,
}: {
  message: MessageLike;
  /** `Show tool calls`: off, a model message keeps its text and loses the calls under it. */
  showTools?: boolean;
  /** Edit a human message: the reference opens it in the input. */
  onEdit?: (message: MessageLike) => void;
  /** Regenerate the model's reply from this point. */
  onRegenerate?: (message: MessageLike) => void;
}) {
  const role = messageKind(message, "ai");
  const human = role === "human";
  const tool = role === "tool";
  const calls = showTools ? toolCalls(message) : [];
  const body = messageText(message.content);

  return (
    // A tool message runs the full width of the feed; a model reply stops at 800 px — measured on the reference
    <div
      className={cx("group flex flex-col gap-1", human ? "ml-auto w-fit" : tool ? "w-full" : "w-full max-w-[800px]")}
    >
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
            {message.name && !tool && <span className="text-xs text-text-quaternary">{message.name}</span>}
          </span>
          {/* A tool card keeps a copy button in its header, shown on hover — it also makes the header 50 px tall */}
          {tool && (
            <span className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                aria-label="Copy"
                className="btn btn-ghost btn-icon !p-1"
                onClick={() => copyText(body)}
              >
                <Copy size={16} strokeWidth={1.5} />
              </button>
            </span>
          )}
        </div>
        {tool ? (
          <ToolResult message={message} />
        ) : (
          <div className="overflow-auto border-t border-border-muted">
            {/* A message without text gets no text row: a tool-calling reply starts with its calls */}
            {body && (
              <div className="px-4 pt-3 pb-3 whitespace-pre-wrap">
                <span className="text-sm leading-[1.65] tracking-tight text-text-primary">{body}</span>
              </div>
            )}
            {calls.length > 0 && <ToolCallList calls={calls} />}
          </div>
        )}
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
