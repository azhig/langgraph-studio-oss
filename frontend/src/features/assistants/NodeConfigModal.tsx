import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Modal } from "@/components/Modal";
import { useCurrentAssistant, useStudio } from "@/store/studio";
import { NodeAvatar } from "@/features/graph/NodeAvatar";
import { configFields } from "./config";
import { ConfigInput } from "./ConfigInput";
import { isSystemAssistant } from "./model";

/**
 * Settings of a single node: the same config fields, filtered by
 * `langgraph_nodes`. Sizes are taken from the reference — 896 px canvas (`w-[56rem]`),
 * height fits the content (at most 90% of the screen), header with the node avatar.
 *
 * `Save` on a user's own assistant creates a new version; for `Default Configuration`
 * the values simply go into the config of upcoming runs.
 */
export function NodeConfigModal({
  node,
  open,
  onClose,
  onOpenAssistants,
}: {
  node: string;
  open: boolean;
  onClose: () => void;
  onOpenAssistants: () => void;
}) {
  const schemas = useStudio((s) => s.schemas);
  const config = useStudio((s) => s.config);
  const setConfig = useStudio((s) => s.setConfig);
  const saveAssistant = useStudio((s) => s.saveAssistant);
  const assistant = useCurrentAssistant();
  const system = isSystemAssistant(assistant);
  const fields = useMemo(() => configFields(schemas).filter((f) => f.nodes.includes(node)), [schemas, node]);
  const [values, setValues] = useState<Record<string, unknown>>(config);

  const save = async () => {
    const next = { ...config, ...values };
    if (assistant && !system) await saveAssistant(assistant.assistant_id, assistant.name ?? "", next);
    else setConfig(next);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} width={896} autoHeight>
      <div className="m-0 min-h-14 shrink-0 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h3 className="text-base leading-tight font-semibold tracking-tight">
              <span className="inline-flex items-center gap-2">
                <NodeAvatar node={node} />
                {node} Configuration
              </span>
            </h3>
            <span className="text-xs leading-tight tracking-snug text-text-quaternary">
              Settings that apply to this node only; saving creates a new version of the assistant.
            </span>
          </div>
          <button
            type="button"
            title="Close"
            className="btn btn-ghost btn-icon shrink-0 self-start !p-1 text-text-secondary"
            onClick={onClose}
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>
      </div>
      <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0">
        {fields.map((f) => (
          <ConfigInput
            key={f.key}
            field={f}
            value={values[f.key]}
            onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
            showNodes={false}
          />
        ))}
        {fields.length === 0 && (
          <span className="text-sm text-text-tertiary">This node has no configuration fields.</span>
        )}
      </div>
      <div className="flex items-center justify-between gap-4 p-4 pt-0">
        <button
          type="button"
          className="btn btn-ghost !rounded-sm text-text-link"
          onClick={() => {
            onClose();
            onOpenAssistants();
          }}
        >
          View full assistant settings
        </button>
        <div className="flex items-center gap-4">
          <button type="button" className="btn btn-outline !rounded-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary !rounded-sm" onClick={() => void save()}>
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}
