import { useState } from "react";
import { PlayCircle } from "lucide-react";
import { useStudioStream } from "@/features/run/StreamProvider";
import { ValueField } from "@/features/input/ValueField";
import { CodeEditor } from "@/features/input/CodeEditor";
import { parseText, toText, type Lang } from "@/features/input/format";
import type { NodeEntry } from "@/store/run";

/**
 * Правка состояния в записи лога. Значения записываются от имени узла в его
 * контрольной точке, поэтому получается новая ветка — в эталоне кнопка так и
 * называется `Fork`.
 */
export function useNodeStateEditor(entry: NodeEntry, onClose: () => void) {
  const { forkState } = useStudioStream();
  const [lang, setLang] = useState<Record<string, Lang>>({});
  const [text, setText] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(entry.updates ?? {}).map(([k, v]) => [k, toText(v, "yaml")])),
  );
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [raw, setRaw] = useState(false);

  const fork = async () => {
    const values: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(text)) {
      const parsed = parseText(value, lang[key] ?? "yaml");
      if (parsed.error) {
        setError(`${key}: ${parsed.error}`);
        return;
      }
      if (parsed.value !== undefined) values[key] = parsed.value;
    }
    if (!entry.checkpointId) {
      setError("No checkpoint for this record");
      return;
    }
    setBusy(true);
    try {
      await forkState(entry.checkpointId, entry.node, values);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // Кнопки эталон держит в строке имени узла справа, а поля — под ней
  const actions = (
    <div className="ml-auto flex items-center gap-1">
      <button
        type="button"
        className="btn btn-ghost h-[26px]"
        onClick={() => setRaw((v) => !v)}
        disabled={busy}
      >
        {raw ? "View Rendered" : "View Raw"}
      </button>
      <button type="button" className="btn btn-outline h-[26px]" onClick={onClose} disabled={busy}>
        Cancel
      </button>
      <button type="button" className="btn btn-primary h-[26px]" onClick={() => void fork()} disabled={busy}>
        <PlayCircle size={14} strokeWidth={1.8} />
        Fork
      </button>
    </div>
  );

  const body = (
    <div className="flex flex-col gap-2">
      {raw ? (
        <RawFields text={text} lang={lang} onChange={setText} />
      ) : (
        Object.keys(text).map((key) => (
          <ValueField
            key={key}
            name={key}
            badge="Optional"
            text={text[key]}
            lang={lang[key] ?? "yaml"}
            onText={(v) => setText((prev) => ({ ...prev, [key]: v }))}
            onLang={(l) => setLang((prev) => ({ ...prev, [key]: l }))}
          />
        ))
      )}
      {error && <div className="px-1 text-[13px] text-text-error-secondary">{error}</div>}
    </div>
  );

  return { actions, body };
}

/** `View Raw`: все поля одним объектом JSON. */
function RawFields({
  text,
  lang,
  onChange,
}: {
  text: Record<string, string>;
  lang: Record<string, Lang>;
  onChange: (next: Record<string, string>) => void;
}) {
  const [value, setValue] = useState(() => {
    const obj: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(text)) {
      const parsed = parseText(raw, lang[key] ?? "yaml");
      if (parsed.value !== undefined) obj[key] = parsed.value;
    }
    return JSON.stringify(obj, null, 2);
  });
  const parsed = parseText(value, "json");

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-md border border-border-secondary">
        <div className="cm-shell">
          <CodeEditor
            value={value}
            lang="json"
            onChange={(next) => {
              setValue(next);
              const p = parseText(next, "json");
              if (p.error || typeof p.value !== "object" || p.value === null) return;
              const obj = p.value as Record<string, unknown>;
              onChange(Object.fromEntries(Object.keys(text).map((k) => [k, toText(obj[k], lang[k] ?? "yaml")])));
            }}
          />
        </div>
      </div>
      {parsed.error && <div className="px-1 text-[13px] text-text-error-secondary">{parsed.error}</div>}
    </div>
  );
}
