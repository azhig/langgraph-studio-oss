import { ChevronDown, ChevronRight } from "lucide-react";
import { asMessages, messageText, roleLabel, roleTitle, type MessageLike } from "@/lib/messages";
import { useResettableState } from "@/hooks/useResettableState";

/**
 * State value tree. Structure taken from the reference (the `View state` popover and
 * expanded log records): a `[chevron] key` row, the value below or beside it,
 * keys in monospace, primitives in `--text-tertiary`.
 */
export function ValueTree({
  name,
  value,
  depth = 0,
  foreign = false,
  leafBelow = false,
  defaultOpen,
}: {
  name?: string;
  value: unknown;
  depth?: number;
  /**
   * Tree of external data (the `interrupt()` value): in the reference even a string
   * expands with a chevron, the text sits under the key, and keys are alphabetical.
   */
  foreign?: boolean;
  /** Only the "key with chevron, value below" view — this is how the thread log is built. */
  leafBelow?: boolean;
  /** Initial branch state; by default only the root is expanded. */
  defaultOpen?: boolean;
}) {
  const branch = isBranch(value);
  // The detail level changes expansion on the fly, not only on first render
  const [open, setOpen] = useResettableState(defaultOpen ?? depth < 1, defaultOpen);

  if (!branch && (foreign || leafBelow) && name !== undefined) {
    return (
      <div
        className="relative flex w-full flex-col items-stretch justify-center gap-y-1"
        data-testid={`foreign-data-tree-leaf-${name}`}
      >
        <button
          type="button"
          className="grid w-full min-w-0 grid-cols-[auto_1fr] items-center gap-2 text-left outline-none select-none"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="flex size-5 shrink-0 items-center justify-center">
              {open ? <ChevronDown size={16} strokeWidth={1.5} /> : <ChevronRight size={16} strokeWidth={1.5} />}
            </span>
            <span className="min-w-[30px] truncate text-sm leading-[1.15] font-medium tracking-tighter whitespace-nowrap">
              <span className="font-mono">{name}</span>
            </span>
          </span>
          {/* The reference labels a collapsed scalar with its value to the right of the key */}
          <span className="flex min-w-[30px] items-center gap-2">
            {/* The reference keeps the value as a paragraph: in the log text it is separated by a line break */}
            {!open && (
              <p className="min-w-0 truncate text-sm leading-normal tracking-normal text-text-tertiary">
                {format(value)}
              </p>
            )}
          </span>
        </button>
        {open && (
          <span className="flex min-w-0 flex-col gap-2 text-sm">
            <span className="w-full text-sm leading-[1.65] tracking-tight whitespace-pre-wrap text-text-primary">
              {format(value)}
            </span>
          </span>
        )}
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="grid grid-cols-[auto_1fr] items-start gap-2" data-testid={`value-leaf-${name ?? ""}`}>
        {name !== undefined && <Key name={name} />}
        <span className="min-w-0 text-sm break-words whitespace-pre-wrap text-text-tertiary">{format(value)}</span>
      </div>
    );
  }

  // The reference labels the message list with roles (Human, AI, Tool), not indices
  const messages = asMessages(value);
  const entries: Array<[string, unknown]> = Array.isArray(value)
    ? value.map((v, i) => [messages ? roleTitle(messages[i]) : String(i), v])
    : // The reference shows external data keys alphabetically, not in response order
      sortKeys(Object.entries(value as Record<string, unknown>), foreign);

  return (
    <div className="relative flex w-full flex-col items-stretch justify-center gap-y-1">
      <button
        type="button"
        className="grid w-full min-w-0 grid-cols-[auto_1fr] items-center gap-2 text-left outline-none select-none"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="flex size-5 shrink-0 items-center justify-center text-text-secondary">
            {open ? <ChevronDown size={16} strokeWidth={1.5} /> : <ChevronRight size={16} strokeWidth={1.5} />}
          </span>
          {name !== undefined ? (
            <span className="min-w-[30px] truncate text-sm leading-[1.15] font-medium tracking-tighter whitespace-nowrap">
              <span className="font-mono">{name}</span>
            </span>
          ) : (
            <span className="text-sm text-text-tertiary">{Array.isArray(value) ? "list" : "object"}</span>
          )}
        </span>
        {!open && <span className="truncate text-sm text-text-quaternary">{preview(value)}</span>}
      </button>
      {open && (
        <div className="flex min-w-0 flex-col gap-2">
          {entries.length ? (
            entries.map(([key, v], i) =>
              messages ? (
                <MessageNode key={i} title={key} message={messages[i]} defaultOpen={defaultOpen} />
              ) : (
                <div key={key} className="pl-6">
                  <ValueTree name={key} value={v} depth={depth + 1} foreign={foreign} leafBelow={leafBelow} />
                </div>
              ),
            )
          ) : (
            <span className="text-sm text-text-tertiary">{Array.isArray(value) ? "[]" : "{}"}</span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Message in the value tree: a "role — text preview" row, and inside —
 * the same bubble as in the log. Taken from the reference: bold role, preview on the right
 * in gray with truncation, the `ID` chip appears on hover.
 */
function MessageNode({ title, message, defaultOpen }: { title: string; message: MessageLike; defaultOpen?: boolean }) {
  const [open, setOpen] = useResettableState(defaultOpen ?? false, defaultOpen);
  const text = messageText(message.content);
  const id = typeof message.id === "string" ? message.id : undefined;

  return (
    <div className="relative flex w-full flex-col items-stretch justify-center gap-y-1">
      <div className="group/message bg-inherit">
        <button
          type="button"
          className="grid w-full min-w-0 grid-cols-[auto_1fr] items-center gap-2 text-left outline-none select-none"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex size-5 shrink-0 items-center justify-center text-text-secondary">
              {open ? <ChevronDown size={16} strokeWidth={1.5} /> : <ChevronRight size={16} strokeWidth={1.5} />}
            </span>
            <span className="min-w-[30px] truncate text-sm leading-[1.15] font-semibold tracking-tighter whitespace-nowrap">
              {title}
            </span>
          </span>
          <span className="flex min-w-[30px] items-center gap-2">
            {id && (
              <span
                className="ml-auto shrink-0 rounded-full border border-border-secondary px-1 font-sans text-xs text-text-tertiary opacity-0 transition-opacity group-hover/message:opacity-100"
                title={id}
              >
                ID
              </span>
            )}
          </span>
        </button>
      </div>
      {open && (
        // Inside the value tree the reference draws the message without a bubble: role and text in a row
        <span className="flex min-w-0 flex-col gap-2 pl-0 text-sm">
          <span className="flex flex-col gap-2 overflow-auto whitespace-pre-wrap">
            <span className="text-xs font-semibold text-text-tertiary uppercase">{roleLabel(message)}</span>
            <span className="text-sm leading-[1.65] tracking-tight text-text-primary">{text}</span>
          </span>
        </span>
      )}
    </div>
  );
}

function Key({ name }: { name: string }) {
  return (
    <span className="min-w-[30px] truncate pl-5 text-sm leading-[1.15] font-medium tracking-tighter whitespace-nowrap">
      <span className="font-mono">{name}</span>
    </span>
  );
}

const isBranch = (v: unknown) => v !== null && typeof v === "object";

const sortKeys = (entries: Array<[string, unknown]>, on: boolean) =>
  on ? [...entries].sort(([a], [b]) => a.localeCompare(b)) : entries;

const format = (v: unknown) => {
  if (typeof v === "string") return v;
  if (v === null) return "null";
  if (v === undefined) return "";
  return JSON.stringify(v);
};

/** A collapsed branch shows a short summary so not everything has to be expanded. */
function preview(value: unknown): string {
  if (Array.isArray(value)) return value.length ? "[...]" : "[]";
  const keys = Object.keys(value as Record<string, unknown>);
  return keys.length ? "{...}" : "{}";
}
