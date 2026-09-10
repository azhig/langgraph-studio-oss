import { useEffect, useMemo, useState } from "react";
import type { Assistant } from "@langchain/langgraph-sdk";
import { Copy, Plus, Trash2, X } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { getClient } from "@/api/client";
import { useStudio } from "@/store/studio";
import { configFields, defaultConfig, type ConfigField } from "./config";
import { ConfigInput } from "./ConfigInput";

/**
 * `Manage Assistants`: слева список ассистентов графа, справа их настройки.
 * Размеры сняты с эталона: полотно 960×640, колонки `2fr / 5fr`, разделитель —
 * правая рамка левой колонки; активная строка помечена полосой слева и заливкой.
 *
 * Ассистент, созданный сервером из кода графа, эталон показывает как
 * `Default Configuration`: его нельзя переименовать, а правка предлагается
 * как создание нового ассистента.
 */
export function AssistantsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { assistants, assistantId, schemas, selectAssistant } = useStudio();
  const current = assistants.find((a) => a.assistant_id === assistantId);
  const list = useMemo(
    () => assistants.filter((a) => a.graph_id === current?.graph_id),
    [assistants, current?.graph_id],
  );
  const [openedId, setOpenedId] = useState<string | undefined>(assistantId);
  useEffect(() => {
    if (open) setOpenedId(assistantId);
  }, [open, assistantId]);
  const opened = list.find((a) => a.assistant_id === openedId) ?? current;
  const fields = useMemo(() => configFields(schemas), [schemas]);

  return (
    <Modal open={open} onClose={onClose}>
      <div className="grid h-full grid-cols-[2fr_5fr]">
        <div className="flex h-full min-h-0 flex-col border-r border-border-secondary">
          <div className="flex items-center justify-between px-2">
            <span className="pt-2 text-sm font-medium text-text-secondary">ASSISTANTS</span>
            <button
              type="button"
              className="btn btn-outline !rounded-sm"
              title="Create a new assistant from the current settings"
              onClick={() => setOpenedId(undefined)}
            >
              <Plus size={14} strokeWidth={1.8} />
              New
            </button>
          </div>
          <div className="scroll-thin flex min-h-0 flex-1 flex-col items-stretch gap-2 overflow-y-auto py-2">
            {list.map((a) => (
              <Row
                key={a.assistant_id}
                assistant={a}
                selected={a.assistant_id === opened?.assistant_id}
                active={a.assistant_id === assistantId}
                onOpen={() => setOpenedId(a.assistant_id)}
              />
            ))}
          </div>
        </div>
        <AssistantForm
          key={opened?.assistant_id ?? "new"}
          assistant={opened}
          creating={openedId === undefined}
          active={opened?.assistant_id === assistantId}
          fields={fields}
          onActivate={() => opened && void selectAssistant(opened.assistant_id)}
          onClose={onClose}
        />
      </div>
    </Modal>
  );
}

/** Ассистент, созданный сервером по коду графа: у эталона это `Default Configuration`. */
const isSystem = (a: Assistant) => (a.metadata as { created_by?: string } | undefined)?.created_by === "system";
const titleOf = (a: Assistant) => (isSystem(a) ? "Default Configuration" : (a.name ?? a.assistant_id));

function Row({
  assistant,
  selected,
  active,
  onOpen,
}: {
  assistant: Assistant;
  selected: boolean;
  active: boolean;
  onOpen: () => void;
}) {
  return (
    <div className="flex flex-col pr-2 hover:bg-bg-secondary">
      <button
        type="button"
        className={`flex w-full cursor-pointer items-center justify-between p-2 text-left ${
          selected ? "border-l-[4px] border-border-brand bg-bg-brand-tertiary" : ""
        }`}
        onClick={onOpen}
      >
        <span className="flex items-center gap-1 overflow-x-hidden">
          <span className="truncate whitespace-nowrap py-1 text-sm font-medium text-text-tertiary">
            {titleOf(assistant)}
          </span>
        </span>
        {active && (
          <span className="flex items-center gap-1 rounded-full border border-border-brand bg-transparent px-2 py-1 text-xs font-medium text-text-brand-primary">
            <span className="size-2 rounded-full bg-bg-brand" />
            Active
          </span>
        )}
      </button>
    </div>
  );
}

function AssistantForm({
  assistant,
  creating,
  active,
  fields,
  onActivate,
  onClose,
}: {
  assistant?: Assistant;
  creating: boolean;
  active: boolean;
  fields: ConfigField[];
  onActivate: () => void;
  onClose: () => void;
}) {
  const {
    schemas,
    recursionLimit,
    setAssistantVersion,
    setRecursionLimit,
    setConfig,
    tags: savedTags,
    setTags,
    createAssistant,
    saveAssistant,
    deleteAssistant,
  } = useStudio();
  const system = assistant ? isSystem(assistant) : false;
  const [name, setName] = useState(() => (creating || system ? "New Assistant" : (assistant?.name ?? "")));
  const [values, setValues] = useState<Record<string, unknown>>(() => ({
    ...defaultConfig(schemas),
    ...((assistant?.config?.configurable ?? {}) as Record<string, unknown>),
  }));
  const [limit, setLimit] = useState(recursionLimit);
  const [tags, setTagList] = useState<string[]>(savedTags);
  const versions = useVersions(assistant, creating);
  const [busy, setBusy] = useState(false);
  // Создать новый ассистент предлагается там, где правка не сохранится:
  // у `Default Configuration` и в режиме `New`
  const creates = creating || system;

  const apply = async () => {
    setBusy(true);
    try {
      setRecursionLimit(limit);
      setTags(tags.filter((t) => t.trim()));
      if (creates) await createAssistant(name, values);
      else if (assistant) await saveAssistant(assistant.assistant_id, name, values);
      else setConfig(values);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-grow flex-col gap-4 overflow-hidden py-4">
      <div className="flex flex-col gap-1 border-b border-border-secondary px-4 pb-2">
        <div className="flex w-full items-center justify-between gap-5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="max-w-[250px] truncate rounded-sm text-xl font-semibold">
              {creating ? "New Assistant" : assistant ? titleOf(assistant) : "New Assistant"}
            </span>
            {assistant && versions.length > 1 && (
              <Select
                value={`v${assistant.version}`}
                options={versions.map((v) => `v${v}`)}
                onChange={(v) => void setAssistantVersion(assistant.assistant_id, Number(v.slice(1)))}
              />
            )}
          </span>
          <label className="flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={active}
              disabled={active || creating}
              onClick={onActivate}
              className={`inline-flex h-4 w-8 items-center rounded-full transition ${
                active ? "bg-bg-brand" : "bg-bg-quaternary"
              } ${active || creating ? "cursor-not-allowed" : ""}`}
            >
              <span
                className={`size-3 rounded-full bg-white transition ${active ? "translate-x-[18px]" : "translate-x-[2px]"}`}
              />
            </button>
            <span className="text-xs leading-tight tracking-snug">Active</span>
          </label>
        </div>
        <div className="text-sm text-text-secondary">
          Edit settings to run this graph with. Optionally, save the configuration as an assistant.
        </div>
        {assistant && !creating && (
          <button
            type="button"
            className="flex w-fit cursor-pointer items-center gap-1.5 whitespace-nowrap py-2 text-sm"
            title={assistant.assistant_id}
            onClick={() => void navigator.clipboard?.writeText(assistant.assistant_id)}
          >
            <Copy size={16} strokeWidth={1.5} />
            Assistant ID
          </button>
        )}
      </div>

      <div className="scroll-thin flex grow flex-col gap-4 overflow-auto px-4 text-sm">
        <div className="flex w-full flex-col items-start gap-1">
          <span className="text-sm font-medium">Assistant Name</span>
          <input
            className="w-full rounded-sm border border-border-secondary bg-transparent px-2 py-1 text-xs leading-normal outline-none focus:border-border-brand"
            placeholder="Assistant Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {fields.map((f) => (
          <ConfigInput
            key={f.key}
            field={f}
            value={values[f.key]}
            onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
          />
        ))}

        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-sm">Recursion limit</span>
            <span className="text-xs text-text-tertiary">
              The maximum number of times the assistant can call itself recursively. This is to prevent infinite
              loops.
            </span>
          </div>
          <input
            type="number"
            className="w-full rounded-lg border border-border-secondary bg-transparent p-2 px-2.5 text-sm outline-none transition-colors focus:border-border-brand"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 0)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-sm">Tags</span>
            <span className="text-xs text-text-tertiary">
              Add tags to categorize runs for easier filtering and organization.
            </span>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-start gap-2">
            <div className="flex flex-col gap-2">
              {tags.map((tag, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="w-full rounded-sm border border-border-secondary bg-transparent px-2 py-1 text-xs leading-normal outline-none focus:border-border-brand"
                    placeholder="tag"
                    value={tag}
                    onChange={(e) => setTagList((prev) => prev.map((t, j) => (j === i ? e.target.value : t)))}
                  />
                  <button
                    type="button"
                    title="Remove tag"
                    className="btn btn-ghost btn-icon !p-1 text-text-secondary"
                    onClick={() => setTagList((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <X size={14} strokeWidth={1.8} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-outline !rounded-sm"
              onClick={() => setTagList((prev) => [...prev, ""])}
            >
              <Plus size={14} strokeWidth={1.8} />
              Add
            </button>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 flex w-full items-center justify-between gap-4 px-4">
        {assistant && !system && !creating ? (
          <button
            type="button"
            className="btn btn-outline !rounded-sm text-text-error-secondary"
            onClick={() => void deleteAssistant(assistant.assistant_id).then(onClose)}
          >
            <Trash2 size={14} strokeWidth={1.8} />
            Delete
          </button>
        ) : (
          <span />
        )}
        <div className="flex grow items-center justify-end gap-4">
          <button type="button" className="btn btn-outline !rounded-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-brand-outline !rounded-sm" disabled={busy} onClick={() => void apply()}>
            {creates ? "Create New Assistant" : "Save Assistant"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Версии ассистента: правка создаёт новую, а выбор из списка откатывает на прежнюю. */
function useVersions(assistant?: Assistant, creating?: boolean): number[] {
  const [versions, setVersions] = useState<number[]>([]);
  useEffect(() => {
    let stale = false;
    if (!assistant || creating || isSystem(assistant)) {
      setVersions([]);
      return;
    }
    void getClient()
      .assistants.getVersions(assistant.assistant_id, { limit: 50 })
      .then((list) => {
        if (!stale) setVersions(list.map((v) => v.version).sort((a, b) => b - a));
      })
      .catch(() => setVersions([]));
    return () => {
      stale = true;
    };
  }, [assistant, creating]);
  return versions;
}
