import { useEffect, useMemo, useState } from "react";
import { ChevronDown, LoaderCircle, PlayCircle, Settings } from "lucide-react";
import { Popover } from "@/components/Popover";
import { Select } from "@/components/Select";
import { AssistantsModal } from "@/features/assistants/AssistantsModal";
import { isSystemNode } from "@/features/graph/colors";
import { useStudio } from "@/store/studio";
import { useRun } from "@/store/run";
import { useStudioStream } from "@/features/run/StreamProvider";
import { CodeEditor } from "./CodeEditor";
import { EditorBar, ValueField } from "./ValueField";
import { inputFields, isMessagesField, parseText, toText, type Field, type Lang } from "./format";

/**
 * Карточка `Input` внизу левой панели: форма по input_schema, переключение
 * формы на единый редактор (`View Raw`), запуск и отмена прогона.
 * Геометрия — docs/DESIGN-TOKENS.md, «Карточка Input».
 */
export function InputPanel() {
  const schemas = useStudio((s) => s.schemas);
  const fields = useMemo(() => inputFields(schemas?.input_schema), [schemas]);
  const [raw, setRaw] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const running = useStudioStream().isLoading;

  return (
    <div className="relative mx-4 mb-5">
      <div className="scroll-thin relative max-h-[50vh] overflow-y-auto rounded-xl border border-border-secondary bg-bg-primary shadow-[var(--shadow-lg)]">
        <div className="relative flex h-full flex-col">
          {running || collapsed ? (
            <div className="flex-1" />
          ) : (
            <div className="flex flex-col gap-2 p-3.5">
              <Head raw={raw} onRaw={() => setRaw((v) => !v)} onCollapse={() => setCollapsed(true)} />
              {raw ? <RawEditor fields={fields} /> : fields.map((f) => <FieldRow key={f.key} field={f} />)}
            </div>
          )}
          {collapsed && !running && (
            <div className="flex items-center justify-between p-3.5 pb-0">
              <span className="text-xl font-semibold leading-[30px] tracking-[-0.8px]">Input</span>
              <button
                type="button"
                className="btn btn-ghost btn-icon size-[26px] !p-1 text-text-secondary"
                title="Expand input editor"
                onClick={() => setCollapsed(false)}
              >
                <ChevronDown size={16} strokeWidth={1.5} className="rotate-180" />
              </button>
            </div>
          )}
          <Footer />
        </div>
      </div>
    </div>
  );
}

function Head({ raw, onRaw, onCollapse }: { raw: boolean; onRaw: () => void; onCollapse: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-xl font-semibold leading-[30px] tracking-[-0.8px]">Input</span>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" className="btn btn-outline h-[26px]" onClick={onRaw}>
          {raw ? "View Rendered" : "View Raw"}
        </button>
        <button
          type="button"
          title="Collapse input editor"
          className="btn btn-ghost btn-icon size-[26px] !p-1 text-text-secondary"
          onClick={onCollapse}
        >
          <ChevronDown size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

/** `View Raw`: весь ввод одним объектом, как в эталоне — с полосой формата снизу. */
function RawEditor({ fields }: { fields: Field[] }) {
  const { inputText, inputLang, setInput } = useRun();
  const [lang, setLang] = useState<Lang>("yaml");
  const [text, setText] = useState(() => {
    const obj: Record<string, unknown> = {};
    for (const f of fields) {
      const parsed = parseText(inputText[f.key] ?? "", inputLang[f.key] ?? "yaml");
      if (parsed.value !== undefined) obj[f.key] = parsed.value;
    }
    return toText(obj, "yaml");
  });
  const parsed = parseText(text, lang);

  const push = (next: string) => {
    setText(next);
    const p = parseText(next, lang);
    if (p.error || typeof p.value !== "object" || p.value === null) return;
    const obj = p.value as Record<string, unknown>;
    for (const f of fields) setInput(f.key, toText(obj[f.key], inputLang[f.key] ?? "yaml"));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-md border border-border-secondary">
        <div className="cm-shell rounded-b-none">
          <CodeEditor value={text} lang={lang} onChange={push} />
        </div>
        <EditorBar
          lang={lang}
          onLang={(next) => {
            const p = parseText(text, lang);
            setLang(next);
            if (!p.error) setText(toText(p.value, next));
          }}
          onCopy={() => void navigator.clipboard?.writeText(text)}
        />
      </div>
      {parsed.error && <ErrorLine text={parsed.error} />}
    </div>
  );
}

function FieldRow({ field }: { field: Field }) {
  const { inputText, inputLang, setInput, setLang } = useRun();
  const type = field.schema?.type;
  const numeric = type === "number" || type === "integer";
  // Конструктор сообщений эталон показывает только там, где схема действительно
  // описывает сообщения; список без типов правится обычным редактором
  const messages = isMessagesField(field);
  return (
    <ValueField
      name={field.title}
      badge={field.required ? "Required" : "Optional"}
      numeric={numeric}
      messages={messages}
      text={inputText[field.key] ?? ""}
      lang={inputLang[field.key] ?? "yaml"}
      onText={(v) => setInput(field.key, v)}
      onLang={(l) => setLang(field.key, l)}
    />
  );
}

function ErrorLine({ text }: { text: string }) {
  return <div className="px-1 text-[13px] leading-tight text-text-error-secondary">{text}</div>;
}

function Footer() {
  const error = useRun((s) => s.inputError);
  const { submit, submitAsNode, stop, isLoading: running, nextNodes } = useStudioStream();
  const assistantId = useStudio((s) => s.assistantId);
  // Пока тред стоит, эталон предлагает записать ввод от имени узла: вместо запуска
  // нового хода значение уходит в состояние как результат выбранного узла.
  const paused = !running && nextNodes.length > 0;
  // Модалку открывает и шестерёнка на узле графа, поэтому флаг живёт в сторе
  const assistants = useStudio((s) => s.assistantsOpen);
  const setAssistants = useStudio((s) => s.setAssistantsOpen);

  return (
    <div className="sticky bottom-0 flex justify-between gap-2 border-t border-border-secondary bg-bg-primary p-3.5">
      <button
        type="button"
        className="btn btn-sm btn-outline h-[34px] disabled:text-text-disabled"
        title="Manage Assistants"
        disabled={running}
        onClick={() => setAssistants(true)}
      >
        <Settings size={16} strokeWidth={1.5} />
        Manage Assistants
      </button>
      <AssistantsModal open={assistants} onClose={() => setAssistants(false)} />
      <div className="flex items-center gap-2">
        {!running && error && (
          <span className="max-w-[220px] truncate text-[13px] text-text-error-secondary" title={error}>
            {error}
          </span>
        )}
        {running ? (
          <button type="button" className="btn btn-sm btn-primary h-[35px] !rounded-md" onClick={() => void stop()}>
            <LoaderCircle size={16} strokeWidth={1.5} className="animate-spin" />
            Cancel
          </button>
        ) : paused ? (
          <AsNodeSubmit onSubmit={submitAsNode} />
        ) : (
          <div className="inline-flex items-stretch">
            <button
              type="button"
              disabled={!assistantId}
              className="btn btn-sm btn-primary h-[35px] !rounded-r-none disabled:opacity-60"
              onClick={() => void submit()}
            >
              <PlayCircle size={16} strokeWidth={1.5} />
              Submit
            </button>
            <RunOptions />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Панель `More options` рядом с `Submit`. Снято с эталона: полотно 400 px,
 * единственная настройка — режим потока `messages`, с описанием в две строки
 * и переключателем 40×20.
 */
function RunOptions() {
  const messagesStream = useStudio((s) => s.messagesStream);
  const setMessagesStream = useStudio((s) => s.setMessagesStream);
  return (
    <Popover
      width={400}
      align="end"
      up
      trigger={({ toggle }) => (
        <button
          type="button"
          aria-label="More options" title="More options"
          className="btn btn-sm btn-primary h-[35px] w-[33px] !rounded-l-none !border-l-0 !p-2"
          onClick={toggle}
        >
          <ChevronDown size={16} strokeWidth={1.5} />
        </button>
      )}
    >
      {() => (
        <div className="flex flex-col space-y-4 p-3 text-sm">
          <div className="flex items-center justify-between">
            <label htmlFor="messages-stream-mode" className="mr-4 flex cursor-pointer flex-col gap-1">
              <span className="text-sm font-medium">Enable messages stream mode</span>
              <span className="text-sm text-text-tertiary">
                Stream message chunks even if the LLM is called via <span className="font-mono">invoke()</span>.
              </span>
              <span className="text-sm text-text-tertiary">
                Disable if your model does not support streaming message chunks.
              </span>
            </label>
            <span className="my-auto flex items-center gap-2">
              <button
                id="messages-stream-mode"
                type="button"
                role="switch"
                aria-label="Enable messages stream mode"
                data-state={messagesStream ? "checked" : "unchecked"}
                aria-checked={messagesStream}
                onClick={() => setMessagesStream(!messagesStream)}
                className={`inline-flex h-5 w-10 items-center rounded-full transition ${
                  messagesStream ? "bg-bg-control-active" : "bg-bg-quaternary"
                }`}
              >
                <span
                  className={`size-4 rounded-full bg-white transition ${
                    messagesStream ? "translate-x-[22px]" : "translate-x-[2px]"
                  }`}
                />
              </button>
            </span>
          </div>
        </div>
      )}
    </Popover>
  );
}

/** `As Node` + `Submit`: выбор узла, от имени которого ввод попадёт в состояние. */
function AsNodeSubmit({ onSubmit }: { onSubmit: (node: string) => Promise<void> }) {
  const graph = useStudio((s) => s.graph);
  const nextNodes = useStudioStream().nextNodes;
  const nodes = useMemo(
    () => (graph?.nodes ?? []).map((n) => String(n.id)).filter((id) => !isSystemNode(id)),
    [graph],
  );
  // По умолчанию эталон предлагает узел, который выполнялся бы следующим
  const [node, setNode] = useState(() => nextNodes[0] ?? nodes.at(-1));
  useEffect(() => {
    setNode((prev) => prev ?? nextNodes[0] ?? nodes.at(-1));
  }, [nextNodes, nodes]);

  return (
    <div className="flex items-center gap-2">
      <div className="flex place-items-center gap-2">
        <span className="text-sm text-text-tertiary">As Node</span>
        <Select value={node} options={nodes} onChange={setNode} placeholder="Select node" up />
      </div>
      <button
        type="button"
        disabled={!node}
        className="btn btn-sm btn-primary h-[35px] !rounded-md disabled:opacity-60"
        onClick={() => node && void onSubmit(node)}
      >
        <PlayCircle size={16} strokeWidth={1.5} />
        Submit
      </button>
    </div>
  );
}
