import { Copy, Wrench } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import {
  messageKind,
  messageText,
  parsedContent,
  roleLabel,
  toolCalls,
  type MessageLike,
  type ToolCall,
} from "@/lib/messages";
import { useRun } from "@/store/run";
import { ValueTree } from "./ValueTree";

/**
 * Contents of one message in the log: the role label and the text — and what the reference
 * draws for tools: a table per tool call under a model message, and for a tool message a pill
 * with the tool name over its result parsed into a tree (docs/DESIGN-TOKENS.md, "Tool calls").
 */
export function MessageBody({ message }: { message: MessageLike }) {
  const detail = useRun((s) => s.detail);
  if (messageKind(message) === "tool") {
    const result = parsedContent(message.content);
    return (
      <div className="flex flex-col gap-2">
        <ToolPill name={message.name} />
        {result !== null && typeof result === "object" ? (
          <div className="flex flex-col gap-2">
            {Object.entries(result as Record<string, unknown>).map(([key, value]) => (
              <div
                key={key}
                className="w-fit max-w-full rounded-md bg-bg-secondary px-4 py-1"
                data-testid={value !== null && typeof value === "object" ? `foreign-data-tree-node-${key}` : undefined}
              >
                <ValueTree name={key} value={value} foreign bubbles defaultOpen={detail >= 2} />
              </div>
            ))}
          </div>
        ) : (
          <Text text={String(result)} />
        )}
      </div>
    );
  }
  const text = messageText(message.content);
  const calls = toolCalls(message);
  return (
    <>
      <span className="text-xs font-semibold text-text-tertiary uppercase">{roleLabel(message)}</span>
      {text && <Text text={text} />}
      {calls.length > 0 && (
        <div className="flex flex-col gap-3">
          {calls.map((call, i) => (
            <ToolCallTable key={call.id ?? i} call={call} />
          ))}
        </div>
      )}
    </>
  );
}

function Text({ text }: { text: string }) {
  return <span className="text-sm leading-[1.65] tracking-tight whitespace-pre-wrap text-text-primary">{text}</span>;
}

/** The tool a message answers for: a 22 px pill with a wrench and the name in monospace. */
function ToolPill({ name }: { name?: string }) {
  return (
    <div className="flex w-fit min-w-0 items-center gap-2 rounded-full border border-border-secondary px-2">
      <Wrench size={16} strokeWidth={1.5} className="shrink-0" />
      <span className="truncate font-mono text-sm leading-5 whitespace-nowrap">{name ?? "tool"}</span>
    </div>
  );
}

/**
 * One tool call as the reference tables it: the name in bold with the call id chip in the
 * header row, then a row per argument — the key on the left of a divider, the value on the right.
 */
export function ToolCallTable({ call }: { call: ToolCall }) {
  const args: Array<[string, unknown]> =
    call.args && typeof call.args === "object" && !Array.isArray(call.args)
      ? Object.entries(call.args as Record<string, unknown>)
      : call.args === undefined
        ? []
        : [["args", call.args]];
  return (
    <div className="w-fit max-w-[80ch] min-w-64 overflow-hidden rounded-lg border border-border-secondary font-mono text-sm leading-5">
      <table className="w-full">
        <thead className="bg-bg-secondary">
          <tr className="border-b border-border-secondary">
            <th colSpan={2} className="p-3 text-left font-bold">
              <div className="flex items-center gap-2">
                <span>{call.name}</span>
                {call.id && (
                  <button
                    type="button"
                    title={call.id}
                    onClick={() => copyText(call.id ?? "")}
                    className="flex items-center gap-1.5 rounded-full border border-border-secondary px-1.5 py-0.5 font-sans text-xs font-normal whitespace-nowrap"
                  >
                    <Copy size={16} strokeWidth={1.5} />
                    ID
                  </button>
                )}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {args.map(([key, value]) => (
            <tr key={key} className="border-b border-border-secondary last:border-b-0">
              <td className="border-r border-border-secondary p-3 align-top">{key}</td>
              <td className="p-3 whitespace-pre-line">
                {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
