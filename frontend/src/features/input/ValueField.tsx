import { useState } from "react";
import { Binary, Braces, ChevronRight, MessageSquare } from "lucide-react";
import { cx } from "@/lib/cx";
import { FieldError } from "@/components/FieldError";
import { CodePanel } from "./CodePanel";
import { MessagesField } from "./MessagesField";
import { parseText, type Lang } from "./format";

/**
 * Field with a value: a header with a badge, an editor and the `YAML v ... RAW` bar.
 * Used both in the `Input` card and when editing node state in the log;
 * in the reference it is one and the same element.
 */
export function ValueField({
  name,
  badge,
  text,
  lang,
  onText,
  onLang,
  numeric = false,
  messages = false,
}: {
  name: string;
  badge?: string;
  text: string;
  lang: Lang;
  onText: (value: string) => void;
  onLang: (lang: Lang) => void;
  /** A scalar number the reference shows as a regular field, not a code editor. */
  numeric?: boolean;
  /** A message list the reference edits with the builder, not as text. */
  messages?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const parsed = parseText(text, lang);
  const Icon = messages ? MessageSquare : numeric ? Binary : Braces;

  return (
    <div className="flex flex-col items-stretch rounded-lg">
      <div className="-mx-2 grid grid-cols-[1fr_auto] gap-4 rounded p-2 transition-colors hover:bg-bg-tertiary">
        <button type="button" className="flex items-center gap-2 text-left" onClick={() => setOpen((v) => !v)}>
          <span className="flex items-center gap-2 font-medium capitalize">
            <Icon size={20} strokeWidth={2} className="text-text-tertiary" />
            <span>{name}</span>
          </span>
        </button>
        <span className="flex items-center gap-2">
          {badge && (
            <span className="rounded-md border border-border-secondary px-1 py-0.5 text-sm text-text-tertiary">
              {badge}
            </span>
          )}
          <button
            type="button"
            title={open ? "Collapse" : "Expand"}
            className="flex size-4 items-center justify-center rounded-xs text-text-secondary"
            onClick={() => setOpen((v) => !v)}
          >
            <ChevronRight
              size={12}
              strokeWidth={2}
              className={cx("text-text-primary transition-transform", open && "rotate-90")}
            />
          </button>
        </span>
      </div>
      {open && messages && <MessagesField text={text} lang={lang} onText={onText} />}
      {open && numeric && (
        <input
          type="number"
          placeholder="Input"
          className="w-full rounded-lg border border-border-secondary bg-transparent p-3 text-sm transition-colors outline-none focus-within:border-border-brand"
          value={text}
          onChange={(e) => onText(e.target.value)}
        />
      )}
      {open && !numeric && !messages && (
        <div className="flex flex-col gap-2">
          {/* The language is switched by the field owner: it also converts the text (see store/run) */}
          <CodePanel value={text} lang={lang} onChange={onText} onLang={(next) => onLang(next)} />
          {parsed.error && <FieldError text={parsed.error} />}
        </div>
      )}
    </div>
  );
}
