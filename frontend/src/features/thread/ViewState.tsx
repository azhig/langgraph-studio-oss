import { useState } from "react";
import { Copy, Maximize2 } from "lucide-react";
import { stringify } from "yaml";
import { CodeEditor } from "@/features/input/CodeEditor";
import { EditorBar } from "@/features/input/ValueField";
import type { Lang } from "@/features/input/format";
import { Tooltip } from "@/components/Tooltip";
import { ValueTree } from "./ValueTree";

/**
 * Содержимое поповера `View state`: состояние графа на контрольной точке.
 * Шапка с идентификатором, вкладки `Values` / `JSON` — как в эталоне.
 */
export function ViewState({
  checkpointId,
  values,
  snapshot,
}: {
  checkpointId?: string;
  values: unknown;
  /** Полный снимок точки: эталон показывает во вкладке JSON и `next`, и `tasks`. */
  snapshot?: Record<string, unknown>;
}) {
  const [tab, setTab] = useState<"values" | "json">("values");
  const [lang, setLang] = useState<Lang>("yaml");
  const [expanded, setExpanded] = useState(false);
  const full = snapshot ?? { values: values ?? null };
  const text =
    lang === "json" ? JSON.stringify(full, null, 2) : stringify(full, { lineWidth: 0 }).replace(/\n$/, "");

  return (
    // Эталон прокручивает панель целиком, а редактор внутри — сам по себе
    <div className="group flex flex-col">
      <div className="flex shrink-0 items-center gap-2 whitespace-nowrap border-b border-border-secondary bg-bg-elevated p-4 text-sm text-text-tertiary">
        Viewing checkpoint:
        <button
          type="button"
          aria-label="Copy checkpoint id"
          className="flex cursor-pointer items-center text-text-secondary"
          onClick={() => void navigator.clipboard?.writeText(checkpointId ?? "")}
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
            className={`border-b-2 pb-5 text-sm leading-[1.15] tracking-tighter transition-colors ${
              tab === key ? "border-b-text-primary font-medium" : "border-b-transparent font-normal"
            }`}
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
        // Эталон показывает весь снимок целиком тем же редактором, что и поля ввода
        <div className="relative flex flex-col">
          <Tooltip
            label="Show full editor to collapse sections and show line numbers"
            className="absolute right-2 top-2 z-10"
          >
            <button
              type="button"
              aria-label="Show full editor"
              data-testid="show-full"
              className="btn btn-ghost btn-icon !p-1 text-text-secondary opacity-0 transition-opacity hover:opacity-100 focus:opacity-100 group-hover:opacity-100"
              onClick={() => setExpanded((v) => !v)}
            >
              <Maximize2 size={14} strokeWidth={1.8} />
            </button>
          </Tooltip>
          {/* Высота редактора у эталона фиксирована: 450 px со своей прокруткой */}
          <div className="scroll-thin h-[450px] overflow-y-auto">
            <CodeEditor value={text} lang={lang} onChange={() => {}} readOnly plain={!expanded} />
          </div>
          <EditorBar lang={lang} onLang={setLang} onCopy={() => void navigator.clipboard?.writeText(text)} />
        </div>
      )}
    </div>
  );
}

/** Корень состояния показываем списком полей, без обёртки «object». */
function StateValues({ values }: { values: unknown }) {
  if (!values || typeof values !== "object") return <ValueTree value={values} />;
  const entries = Object.entries(values as Record<string, unknown>);
  if (!entries.length) return <span className="text-sm text-text-tertiary">{"{}"}</span>;
  return (
    <>
      {/* В панели состояния эталон показывает значения и сообщения раскрытыми */}
      {entries.map(([key, value]) => (
        <ValueTree key={key} name={key} value={value} defaultOpen />
      ))}
    </>
  );
}
