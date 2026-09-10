import { useState } from "react";
import { Copy, Maximize2 } from "lucide-react";
import { stringify } from "yaml";
import { copyText } from "@/lib/clipboard";
import { cx } from "@/lib/cx";
import { CodeEditor } from "@/features/input/CodeEditor";
import { HighlightedCode } from "@/features/input/Highlight";
import { EditorBar } from "@/features/input/EditorBar";
import type { Lang } from "@/features/input/format";
import { Tooltip } from "@/components/Tooltip";
import { ValueTree } from "./ValueTree";

/**
 * Contents of the `View state` popover: graph state at a checkpoint.
 * Header with the id, `Values` / `JSON` tabs — as in the reference.
 */
export function ViewState({
  checkpointId,
  values,
  snapshot,
}: {
  checkpointId?: string;
  values: unknown;
  /** Full checkpoint snapshot: the reference shows both `next` and `tasks` in the JSON tab. */
  snapshot?: Record<string, unknown>;
}) {
  const [tab, setTab] = useState<"values" | "json">("values");
  const [lang, setLang] = useState<Lang>("yaml");
  const [expanded, setExpanded] = useState(false);
  const full = snapshot ?? { values: values ?? null };
  const text = lang === "json" ? JSON.stringify(full, null, 2) : stringify(full, { lineWidth: 0 }).replace(/\n$/, "");

  return (
    // The reference scrolls the panel as a whole, and the editor inside scrolls on its own
    <div className="group flex flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border-secondary bg-bg-elevated p-4 text-sm whitespace-nowrap text-text-tertiary">
        Viewing checkpoint:
        <button
          type="button"
          aria-label="Copy checkpoint id"
          className="flex cursor-pointer items-center text-text-secondary"
          onClick={() => copyText(checkpointId ?? "")}
        >
          <Copy size={16} strokeWidth={1.5} className="shrink-0" />
        </button>
        <span className="font-mono text-sm">{checkpointId ?? "—"}</span>
      </div>
      <div className="flex shrink-0 gap-5 border-b border-border-secondary px-4 pt-4">
        {(["values", "json"] as const).map((key) => (
          <button
            key={key}
            type="button"
            className={cx(
              "border-b-2 pb-5 text-sm leading-[1.15] font-normal tracking-tighter transition-colors",
              // The reference paints the active tab in the brand color — both text and underline
              tab === key
                ? "border-b-text-brand-secondary text-text-brand-secondary"
                : "border-b-transparent text-text-primary",
            )}
            onClick={() => setTab(key)}
          >
            {key === "values" ? "Values" : "JSON"}
          </button>
        ))}
      </div>
      {tab === "values" ? (
        <div className="flex flex-col gap-2 p-4">
          <StateValues values={values} />
        </div>
      ) : (
        // The reference shows the whole snapshot with the same editor as the input fields
        <div className="relative flex flex-col">
          <Tooltip
            label="Show full editor to collapse sections and show line numbers"
            className="absolute top-2 right-2 z-10"
          >
            <button
              type="button"
              aria-label="Show full editor"
              data-testid="show-full"
              className="btn btn-ghost btn-icon !p-1 text-text-secondary opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100 focus:opacity-100"
              onClick={() => setExpanded((v) => !v)}
            >
              <Maximize2 size={14} strokeWidth={1.8} />
            </button>
          </Tooltip>
          {/* The reference fixes the height: 450 px with its own scrolling. By default
              this is highlighted text, and "Show full editor" swaps it for an editor
              with line numbers and section folding */}
          {expanded ? (
            // The reference keeps the full editor at exactly 30vh, scrolling inside it
            <div className="cm-fixed h-[30vh]">
              <CodeEditor value={text} lang={lang} onChange={() => {}} readOnly />
            </div>
          ) : (
            <div className="scroll-thin h-[450px] overflow-y-auto">
              <HighlightedCode text={text} lang={lang} />
            </div>
          )}
          <EditorBar lang={lang} onLang={setLang} onCopy={() => copyText(text)} />
        </div>
      )}
    </div>
  );
}

/** The state root is shown as a list of fields, without an "object" wrapper. */
function StateValues({ values }: { values: unknown }) {
  if (!values || typeof values !== "object") return <ValueTree value={values} />;
  const entries = Object.entries(values as Record<string, unknown>);
  if (!entries.length) return <span className="text-sm text-text-tertiary">{"{}"}</span>;
  return (
    <>
      {/* In the state panel the reference shows values and messages expanded */}
      {entries.map(([key, value]) => (
        <ValueTree key={key} name={key} value={value} defaultOpen />
      ))}
    </>
  );
}
