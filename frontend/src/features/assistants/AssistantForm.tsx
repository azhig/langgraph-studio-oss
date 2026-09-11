import { useEffect, useState } from "react";
import type { Assistant } from "@langchain/langgraph-sdk";
import { Copy, Plus, Trash2, X } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import { Select } from "@/components/Select";
import { Switch } from "@/components/Switch";
import { getClient } from "@/api/client";
import { useStudio } from "@/store/studio";
import { ConfigInput } from "./ConfigInput";
import { RawConfigField } from "./RawConfigField";
import { defaultConfig, type ConfigField } from "./config";
import { assistantTitle, isSystemAssistant } from "./model";

const INPUT =
  "w-full rounded-sm border border-border-secondary bg-transparent px-2 py-1 text-xs leading-normal outline-none focus:border-border-brand";

/**
 * Right column of `Manage Assistants`: name, config fields, `Recursion limit`,
 * `Tags` and buttons. For `Default Configuration` and in `New` mode, edits are not saved
 * to an existing assistant — creating a new one is offered instead.
 */
export function AssistantForm({
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
  const schemas = useStudio((s) => s.schemas);
  const recursionLimit = useStudio((s) => s.recursionLimit);
  const savedTags = useStudio((s) => s.tags);
  const setAssistantVersion = useStudio((s) => s.setAssistantVersion);
  const setRecursionLimit = useStudio((s) => s.setRecursionLimit);
  const setConfig = useStudio((s) => s.setConfig);
  const setTags = useStudio((s) => s.setTags);
  const createAssistant = useStudio((s) => s.createAssistant);
  const saveAssistant = useStudio((s) => s.saveAssistant);
  const deleteAssistant = useStudio((s) => s.deleteAssistant);

  const system = isSystemAssistant(assistant);
  const [name, setName] = useState(() => (creating || system ? "New Assistant" : (assistant?.name ?? "")));
  const [values, setValues] = useState<Record<string, unknown>>(() => ({
    ...defaultConfig(schemas),
    ...((assistant?.config?.configurable ?? {}) as Record<string, unknown>),
  }));
  // Without a `config_schema` the values are edited as text, and bad text blocks saving
  const [rawError, setRawError] = useState<string>();
  const [limit, setLimit] = useState(recursionLimit);
  const [tags, setTagList] = useState<string[]>(savedTags);
  const versions = useVersions(assistant, creating);
  const [busy, setBusy] = useState(false);
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
              {!creating && assistant ? assistantTitle(assistant) : "New Assistant"}
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
            <Switch compact checked={active} disabled={active || creating} onChange={onActivate} />
            <span className="text-xs leading-tight tracking-snug">Active</span>
          </label>
        </div>
        <div className="text-sm text-text-secondary">
          Adjust the settings this graph runs with, and save them as an assistant if you want to keep them.
        </div>
        {assistant && !creating && (
          <button
            type="button"
            className="flex w-fit cursor-pointer items-center gap-1.5 py-2 text-sm whitespace-nowrap"
            title={assistant.assistant_id}
            onClick={() => copyText(assistant.assistant_id)}
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
            className={INPUT}
            placeholder="Assistant Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {fields.length === 0 ? (
          <RawConfigField
            initial={values}
            onChange={({ values: next, error }) => {
              setRawError(error);
              if (next) setValues(next);
            }}
          />
        ) : (
          fields.map((f) => (
            <ConfigInput
              key={f.key}
              field={f}
              value={values[f.key]}
              onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
            />
          ))
        )}

        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-sm">Recursion limit</span>
            <span className="text-xs text-text-tertiary">
              How many steps a single run may take before it is stopped; guards against endless loops.
            </span>
          </div>
          <input
            type="number"
            className="w-full rounded-lg border border-border-secondary bg-transparent p-2 px-2.5 text-sm transition-colors outline-none focus:border-border-brand"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 0)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-sm">Tags</span>
            <span className="text-xs text-text-tertiary">Labels attached to every run, handy for filtering later.</span>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-start gap-2">
            <div className="flex flex-col gap-2">
              {tags.map((tag, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className={INPUT}
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
            Delete Assistant
          </button>
        ) : (
          <span />
        )}
        <div className="flex grow items-center justify-end gap-4">
          <button type="button" className="btn btn-outline !rounded-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-brand-outline !rounded-sm"
            disabled={busy || Boolean(rawError)}
            onClick={() => void apply()}
          >
            {creates ? "Create New Assistant" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Assistant versions: editing creates a new one, picking from the list rolls back to a previous one. */
function useVersions(assistant?: Assistant, creating?: boolean): number[] {
  // The list is stored together with the id: another assistant's versions are never shown
  const [loaded, setLoaded] = useState<{ id: string; versions: number[] }>();
  const wanted = assistant && !creating && !isSystemAssistant(assistant) ? assistant.assistant_id : undefined;
  useEffect(() => {
    if (!wanted) return;
    let stale = false;
    void getClient()
      .assistants.getVersions(wanted, { limit: 50 })
      .then((list) => {
        if (!stale) setLoaded({ id: wanted, versions: list.map((v) => v.version).sort((a, b) => b - a) });
      })
      .catch(() => {
        if (!stale) setLoaded({ id: wanted, versions: [] });
      });
    return () => {
      stale = true;
    };
  }, [wanted]);
  return wanted && loaded?.id === wanted ? loaded.versions : [];
}
