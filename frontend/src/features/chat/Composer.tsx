import { useEffect, useRef } from "react";
import { ArrowUp, Plus } from "lucide-react";
import { Switch } from "@/components/Switch";

/**
 * Chat mode input: grows with the text (up to 20 % of the screen), Enter sends,
 * Shift+Enter inserts a line break. Below — `Show tool calls`, file upload and
 * a round 34 px send button — as in the reference.
 */
export function Composer({
  disabled,
  showTools,
  text,
  onText,
  onToggleTools,
  onSend,
}: {
  disabled: boolean;
  showTools: boolean;
  text: string;
  onText: (value: string) => void;
  onToggleTools: () => void;
  onSend: (text: string) => Promise<void>;
}) {
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "40px";
    el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.2)}px`;
  }, [text]);

  const send = async () => {
    const message = text.trim();
    if (!message || disabled) return;
    onText("");
    await onSend(message);
  };

  return (
    <div className="mt-auto flex w-full flex-col gap-4 rounded-xl border border-border-default bg-bg-primary p-4">
      <textarea
        ref={area}
        rows={1}
        placeholder="Enter message"
        value={text}
        onChange={(e) => onText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void send();
          }
        }}
        className="max-h-[20vh] min-h-[2.5rem] w-full resize-none border-none bg-transparent p-0 text-sm outline-none placeholder:text-text-placeholder"
      />
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Switch checked={showTools} onChange={onToggleTools} />
          <span className="text-xs tracking-tighter">Show tool calls</span>
          <button type="button" aria-label="Attach files or images" className="btn btn-ghost !px-2">
            <Plus size={14} strokeWidth={1.8} />
            Attach files or images
          </button>
        </div>
        <button
          type="submit"
          aria-label="Send message"
          disabled={disabled || !text.trim()}
          onClick={() => void send()}
          className="flex size-[34px] items-center justify-center rounded-full border border-transparent bg-bg-elevated-hover text-text-secondary disabled:opacity-50"
        >
          <ArrowUp size={16} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}
