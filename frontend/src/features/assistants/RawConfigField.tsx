import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { FieldError } from "@/components/FieldError";
import { WarningGlyph } from "@/components/icons/WarningGlyph";
import { CodePanel } from "@/features/input/CodePanel";
import { toText, type Lang } from "@/features/input/format";
import { readConfigText, type RawConfig } from "./config";

/** Graph configuration guide: where the notice sends you to declare a `config_schema`. */
const DOCS = "https://langchain-ai.github.io/langgraph/how-tos/configuration/";

/**
 * `configurable` as text. The reference falls back to it when the graph declares no
 * `config_schema` (or an empty one): there are no fields to generate, so the whole object
 * is edited in the same YAML/JSON editor the `Input` card uses, under a warning notice.
 */
export function RawConfigField({
  initial,
  onChange,
}: {
  initial: Record<string, unknown>;
  onChange: (result: RawConfig) => void;
}) {
  const [lang, setLang] = useState<Lang>("yaml");
  const [text, setText] = useState(() => toText(initial, "yaml"));
  const [error, setError] = useState<string>();

  const update = (nextText: string, nextLang: Lang) => {
    setText(nextText);
    setLang(nextLang);
    const result = readConfigText(nextText, nextLang);
    setError(result.error);
    onChange(result);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 rounded-md border border-transparent bg-bg-warning px-4 py-3">
        <span className="mr-1 flex shrink-0 items-center text-text-warning-secondary">
          <WarningGlyph />
        </span>
        {/* The text is inline inside a block: its line boxes follow the notice's 20 px leading, as in the reference */}
        <div className="min-w-0 flex-1">
          <span className="text-xs leading-tight tracking-snug text-text-secondary">
            This graph declares no configuration schema, so there are no fields to fill in. Set the `configurable`
            values yourself below.
          </span>
        </div>
        <a
          href={DOCS}
          target="_blank"
          rel="noreferrer"
          className="flex shrink-0 items-center gap-[2px] text-sm leading-normal text-text-link underline-offset-2 hover:underline dark:text-text-brand-secondary"
        >
          How to add a schema
          <ExternalLink size={14} strokeWidth={1.5} />
        </a>
      </div>
      <div className="flex flex-col gap-2">
        <CodePanel
          value={text}
          lang={lang}
          onChange={(next) => update(next, lang)}
          onLang={(next, converted) => update(converted, next)}
        />
        {error && <FieldError text={error} />}
      </div>
    </div>
  );
}
