import { useState } from "react";
import { Copy, PlayCircle } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import { FieldError } from "@/components/FieldError";
import { useStudioStream } from "@/features/run/StreamProvider";
import { CodeEditor } from "@/features/input/CodeEditor";
import { EditorBar } from "@/features/input/EditorBar";
import { parseText, type Lang } from "@/features/input/format";
import { ValueTree } from "./ValueTree";

/**
 * Dynamic `interrupt()`: the value the node passed out,
 * and a field for the reply. Styling taken from the reference — a panel in brand colors
 * (`border-brand-subtle` / `bg-brand-tertiary`, 12 px padding), below it a form
 * with a 16 px heading, the interrupt id, an editor and the
 * `YAML ▾ … RAW ⧉` bar ending with `Resume`.
 */
export function InterruptBlock({ node, interrupt }: { node: string; interrupt: { id?: string; value: unknown } }) {
  const { resume, isLoading } = useStudioStream();
  // As in the `Input` card, the reference opens the reply field in YAML
  const [lang, setLang] = useState<Lang>("yaml");
  const [text, setText] = useState('""');
  const [error, setError] = useState<string>();

  const send = async () => {
    const parsed = parseText(text, lang);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    setError(undefined);
    await resume(parsed.value);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-md border border-border-brand-subtle bg-bg-brand-tertiary p-3 text-sm">
        <span className="font-medium text-text-brand-primary uppercase">Interrupt</span>
        <div className="mt-1 flex flex-col gap-2 text-text-primary">
          {typeof interrupt.value === "object" && interrupt.value !== null ? (
            // Value fields are sorted alphabetically and shown without a root node — as in the reference
            Object.entries(interrupt.value as Record<string, unknown>)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, value]) => <ValueTree key={key} name={key} value={value} foreign />)
          ) : (
            <span className="leading-[1.65] tracking-tight whitespace-pre-wrap">{String(interrupt.value)}</span>
          )}
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div className="overflow-hidden rounded-md border border-border-secondary bg-bg-secondary">
          <div className="flex items-center justify-between">
            <span className="flex px-3 py-2 text-base leading-6 font-medium tracking-tighter">
              Reply to {node} to continue the run
            </span>
            {interrupt.id && (
              <div className="flex items-center gap-2 px-2">
                <span className="text-xxs leading-[1.15] font-medium text-text-secondary">Interrupt ID:</span>
                <button
                  type="button"
                  title={interrupt.id}
                  className="inline-flex items-center justify-center gap-1 rounded-full border border-transparent bg-bg-tertiary px-2 py-1 text-text-secondary"
                  onClick={() => copyText(interrupt.id ?? "")}
                >
                  <Copy size={12} strokeWidth={1.5} />
                </button>
              </div>
            )}
          </div>
          <div className="h-px w-full border-t border-border-secondary" />
          <div className="cm-shell rounded-none">
            <CodeEditor value={text} lang={lang} onChange={setText} />
          </div>
          <EditorBar
            lang={lang}
            onLang={setLang}
            onCopy={() => copyText(text)}
            action={
              <button type="submit" className="btn btn-primary !rounded-sm" disabled={isLoading}>
                <PlayCircle size={16} strokeWidth={1.5} />
                Resume
              </button>
            }
          />
        </div>
        {error && <FieldError text={error} className="pt-1" />}
      </form>
    </div>
  );
}
