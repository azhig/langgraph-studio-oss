import { cx } from "@/lib/cx";
import { asMessages, messageText, roleLabel } from "@/lib/messages";
import { useRun } from "@/store/run";
import { ValueTree } from "./ValueTree";

/**
 * What the node wrote. If it is only `messages`, the reference draws them as
 * "role + text" cards; in the turn summary — the same cards without a bubble (`bare`).
 */
export function Updates({ updates, bare = false }: { updates?: Record<string, unknown>; bare?: boolean }) {
  const content = Object.entries(updates ?? {});
  if (!content.length) return <span className="text-sm text-text-tertiary">None</span>;
  const messages = content.length === 1 && content[0][0] === "messages" ? asMessages(content[0][1]) : null;
  return (
    <div className="flex flex-col gap-2">
      {messages
        ? messages.map((m, i) => (
            <div
              key={i}
              className={cx("flex flex-col gap-2", !bare && "w-fit max-w-full rounded-md bg-bg-secondary px-4 py-1")}
            >
              <span className="text-xs font-semibold text-text-tertiary uppercase">{roleLabel(m)}</span>
              <span className="text-sm leading-[1.65] tracking-tight whitespace-pre-wrap text-text-primary">
                {messageText(m.content)}
              </span>
            </div>
          ))
        : content.map(([key, value]) => <Value key={key} name={key} value={value} />)}
    </div>
  );
}

/**
 * State value in a log record. The reference draws it with the same tree as in
 * the `View state` popover: a "chevron + key" row, value below, everything collapsible;
 * the `messages` list is split into messages with roles.
 */
function Value({ name, value }: { name: string; value: unknown }) {
  // At the two top slider levels the reference also expands the value contents
  const detail = useRun((s) => s.detail);
  return (
    <div className="w-fit max-w-full rounded-md bg-bg-secondary px-4 py-1">
      <ValueTree name={name} value={value} leafBelow defaultOpen={detail >= 2} />
    </div>
  );
}
