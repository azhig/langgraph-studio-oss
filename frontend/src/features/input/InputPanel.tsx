import { useMemo, useState } from "react";
import { ChevronDown, LoaderCircle, PlayCircle, Settings } from "lucide-react";
import { isNumericType } from "@/lib/schema";
import { Popover } from "@/components/Popover";
import { Select } from "@/components/Select";
import { Switch } from "@/components/Switch";
import { FieldError } from "@/components/FieldError";
import { AssistantsModal } from "@/features/assistants/AssistantsModal";
import { userNodeIds } from "@/features/graph/layout";
import { useStudio } from "@/store/studio";
import { useRun } from "@/store/run";
import { useStudioStream } from "@/features/run/StreamProvider";
import { CodePanel } from "./CodePanel";
import { ValueField } from "./ValueField";
import { inputFields, isMessagesField, parseText, toText, type Field, type Lang } from "./format";

/**
 * The `Input` card at the bottom of the left panel: a form by input_schema, switching
 * the form to a single editor (`View Raw`), starting and cancelling a run.
 * Geometry: docs/DESIGN-TOKENS.md, "Input card".
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
              <span className="text-xl leading-[30px] font-semibold tracking-[-0.8px]">Input</span>
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
        <span className="text-xl leading-[30px] font-semibold tracking-[-0.8px]">Input</span>
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

/** `View Raw`: the whole input as one object, as in the reference, with the format bar below. */
function RawEditor({ fields }: { fields: Field[] }) {
  const inputText = useRun((s) => s.inputText);
  const inputLang = useRun((s) => s.inputLang);
  const setInput = useRun((s) => s.setInput);
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

  // An edit of the combined object is spread over the form fields, each in its own language
  const push = (next: string) => {
    setText(next);
    const p = parseText(next, lang);
    if (p.error || typeof p.value !== "object" || p.value === null) return;
    const obj = p.value as Record<string, unknown>;
    for (const f of fields) setInput(f.key, toText(obj[f.key], inputLang[f.key] ?? "yaml"));
  };

  return (
    <div className="flex flex-col gap-2">
      <CodePanel
        value={text}
        lang={lang}
        onChange={push}
        onLang={(next, converted) => {
          setLang(next);
          setText(converted);
        }}
      />
      {parsed.error && <FieldError text={parsed.error} />}
    </div>
  );
}

function FieldRow({ field }: { field: Field }) {
  const type = field.schema?.type;
  const text = useRun((s) => s.inputText[field.key] ?? "");
  const lang = useRun((s) => s.inputLang[field.key] ?? "yaml");
  const setInput = useRun((s) => s.setInput);
  const setLang = useRun((s) => s.setLang);
  return (
    <ValueField
      name={field.title}
      badge={field.required ? "Required" : "Optional"}
      numeric={typeof type === "string" && isNumericType(type)}
      // The reference shows the message builder only where the schema actually
      // describes messages; an untyped list is edited with the regular editor
      messages={isMessagesField(field)}
      text={text}
      lang={lang}
      onText={(v) => setInput(field.key, v)}
      onLang={(l) => setLang(field.key, l)}
    />
  );
}

function Footer() {
  const error = useRun((s) => s.inputError);
  const { submit, submitAsNode, stop, isLoading: running, nextNodes } = useStudioStream();
  const assistantId = useStudio((s) => s.assistantId);
  // While the thread is stopped, the reference offers to write the input on behalf of a node: instead of
  // starting a new turn the value goes into the state as the result of the selected node.
  const paused = !running && nextNodes.length > 0;
  // The modal is also opened by the gear on the graph node, so the flag lives in the store
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
 * The `More options` panel next to `Submit`. Captured from the reference: a 400 px sheet,
 * the only setting is the `messages` stream mode, with a two-line description
 * and a 40x20 toggle.
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
          aria-label="More options"
          title="More options"
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
                Receive message tokens as they are generated, even when the model is called via{" "}
                <span className="font-mono">invoke()</span>.
              </span>
              <span className="text-sm text-text-tertiary">Turn off if your model cannot stream partial messages.</span>
            </label>
            <span className="my-auto flex items-center gap-2">
              <Switch
                id="messages-stream-mode"
                label="Enable messages stream mode"
                checked={messagesStream}
                onChange={setMessagesStream}
              />
            </span>
          </div>
        </div>
      )}
    </Popover>
  );
}

/** `As Node` + `Submit`: pick the node on whose behalf the input goes into the state. */
function AsNodeSubmit({ onSubmit }: { onSubmit: (node: string) => Promise<void> }) {
  const graph = useStudio((s) => s.graph);
  const nextNodes = useStudioStream().nextNodes;
  const nodes = useMemo(() => userNodeIds(graph), [graph]);
  // By default the reference offers the node that would run next
  const [chosen, setNode] = useState<string>();
  const node = chosen ?? nextNodes[0] ?? nodes.at(-1);

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
