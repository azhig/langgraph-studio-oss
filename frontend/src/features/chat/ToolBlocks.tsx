import { useState } from "react";
import { cx } from "@/lib/cx";
import { copyText } from "@/lib/clipboard";
import { parsedContent, type MessageLike, type ToolCall } from "@/lib/messages";
import { EditorBar, LangPicker } from "@/features/input/EditorBar";
import { HighlightedCode } from "@/features/input/Highlight";
import { toText, type Lang } from "@/features/input/format";

/**
 * Tool calls and results in the chat, as the reference draws them with `Show tool calls` on
 * (docs/DESIGN-TOKENS.md, "Chat mode"): the tool name in monospace with the call id chip,
 * the data as highlighted YAML or JSON on `--bg-secondary`, and a language picker.
 */

/** Data block: 14 px padding, `Fira Code` 14px/21px; the bottom corners follow what comes after it. */
function CodeBlock({ value, lang, last }: { value: unknown; lang: Lang; last: boolean }) {
  return (
    <div
      className={cx(
        "flex flex-col overflow-y-auto rounded bg-bg-secondary p-3.5",
        last ? "rounded-b-lg" : "rounded-b-none",
      )}
    >
      <HighlightedCode text={toText(value, lang)} lang={lang} className="min-w-[10rem]" />
    </div>
  );
}

function CallId({ id }: { id: string }) {
  return <span className="rounded-md border border-border-muted p-1 font-mono text-sm text-text-tertiary">{id}</span>;
}

/** The calls of a model message: name and id, the arguments as code, one language picker for all of them. */
export function ToolCallList({ calls }: { calls: ToolCall[] }) {
  const [lang, setLang] = useState<Lang>("yaml");
  return (
    <div className="flex flex-col" data-testid="tool-calls-list-in-message">
      {calls.map((call, i) => (
        <div key={call.id ?? i} className="flex flex-col">
          <span className="px-4 py-3 font-mono text-base leading-6">
            {call.name} {call.id && <CallId id={call.id} />}
          </span>
          <CodeBlock value={call.args ?? {}} lang={lang} last />
        </div>
      ))}
      <div className="flex items-center">
        <LangPicker lang={lang} onLang={setLang} />
      </div>
    </div>
  );
}

/** Body of a tool message: the tool and call id on a `border-y` row, the result as code, the editor bar under it. */
export function ToolResult({ message }: { message: MessageLike }) {
  const [lang, setLang] = useState<Lang>("yaml");
  const value = parsedContent(message.content);
  return (
    <>
      <div className="border-y border-border-muted px-4 py-3">
        <span className="font-mono text-base leading-6">
          {message.name ?? "tool"} {message.tool_call_id && <CallId id={message.tool_call_id} />}
        </span>
      </div>
      <div>
        <CodeBlock value={value} lang={lang} last={false} />
        <EditorBar lang={lang} onLang={setLang} onCopy={() => copyText(toText(value, lang))} />
      </div>
    </>
  );
}
