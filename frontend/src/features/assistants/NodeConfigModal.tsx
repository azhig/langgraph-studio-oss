import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Modal } from "@/components/Modal";
import { useStudio } from "@/store/studio";
import { nodePalette } from "@/features/graph/colors";
import { configFields } from "./config";
import { ConfigInput } from "./ConfigInput";

/**
 * Настройки одного узла: те же поля конфигурации, но отобранные по
 * `langgraph_nodes`. Размеры сняты с эталона — полотно 896 px (`w-[56rem]`),
 * высота по содержимому (не больше 90 % экрана), шапка с аватаром узла.
 *
 * `Save` у собственного ассистента создаёт новую версию, у `Default Configuration`
 * значения просто уходят в конфигурацию ближайших запусков.
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
  const { assistants, assistantId, schemas, config, setConfig, saveAssistant, theme } = useStudio();
  const assistant = assistants.find((a) => a.assistant_id === assistantId);
  const system = (assistant?.metadata as { created_by?: string } | undefined)?.created_by === "system";
  const fields = useMemo(() => configFields(schemas).filter((f) => f.nodes.includes(node)), [schemas, node]);
  const [values, setValues] = useState<Record<string, unknown>>(config);
  const palette = nodePalette(node, theme);
  const [h, s, l] = palette.tone;

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
            <h3 className="text-base font-semibold leading-tight tracking-tight">
              <span className="inline-flex items-center gap-2">
                <span
                  className="flex size-5 items-center justify-center rounded-full border text-center text-[10px] font-semibold uppercase"
                  style={{
                    color: palette.text,
                    backgroundColor: `hsla(${h}, ${s}%, ${l}%, 0.2)`,
                    borderColor: palette.border,
                  }}
                >
                  {node.slice(0, 1)}
                </span>
                {node} Configuration
              </span>
            </h3>
            <span className="text-xs leading-tight tracking-snug text-text-quaternary">
              Edit assistant settings specific to this node and save to create a new assistant version.
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
