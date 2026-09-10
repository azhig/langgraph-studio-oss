import { useState } from "react";
import { Copy, PlayCircle } from "lucide-react";
import { useStudioStream } from "@/features/run/StreamProvider";
import { CodeEditor } from "@/features/input/CodeEditor";
import { EditorBar } from "@/features/input/ValueField";
import { parseText, type Lang } from "@/features/input/format";
import { ValueTree } from "./ValueTree";

/**
 * Динамическое прерывание `interrupt()`: значение, которое узел передал наружу,
 * и поле для ответа. Оформление снято с эталона — плашка в брендовых цветах
 * (`border-brand-subtle` / `bg-brand-tertiary`, отступ 12 px), под ней форма
 * с заголовком 16 px, идентификатором прерывания, редактором и полосой
 * `YAML ▾ … RAW ⧉`, в конце которой стоит `Resume`.
 */
export function InterruptBlock({
  node,
  interrupt,
}: {
  node: string;
  interrupt: { id?: string; value: unknown };
}) {
  const { resume, isLoading } = useStudioStream();
  // Как и в карточке `Input`, эталон открывает поле ответа в YAML
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
        <span className="font-medium uppercase text-text-brand-primary">Interrupt</span>
        <div className="mt-1 flex flex-col gap-2 text-text-primary">
          {typeof interrupt.value === "object" && interrupt.value !== null ? (
            // Поля значения идут по алфавиту и без корневого узла — так их показывает эталон
            Object.entries(interrupt.value as Record<string, unknown>)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, value]) => <ValueTree key={key} name={key} value={value} foreign />)
          ) : (
            <span className="whitespace-pre-wrap leading-[1.65] tracking-tight">{String(interrupt.value)}</span>
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
            <span className="flex px-3 py-2 text-base font-medium leading-6 tracking-tighter">
              Provide a value to resume execution for {node}
            </span>
            {interrupt.id && (
              <div className="flex items-center gap-2 px-2">
                <span className="text-xxs font-medium leading-[1.15] text-text-secondary">Interrupt ID:</span>
                <button
                  type="button"
                  title={interrupt.id}
                  className="inline-flex items-center justify-center gap-1 rounded-full border border-transparent bg-bg-tertiary px-2 py-1 text-text-secondary"
                  onClick={() => void navigator.clipboard?.writeText(interrupt.id ?? "")}
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
            onCopy={() => void navigator.clipboard?.writeText(text)}
            action={
              <button type="submit" className="btn btn-primary !rounded-sm" disabled={isLoading}>
                <PlayCircle size={16} strokeWidth={1.5} />
                Resume
              </button>
            }
          />
        </div>
        {error && <div className="px-1 pt-1 text-[13px] text-text-error-secondary">{error}</div>}
      </form>
    </div>
  );
}
