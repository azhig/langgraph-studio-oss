import { isNumericType } from "@/lib/schema";
import { Select } from "@/components/Select";
import { NodeAvatar } from "@/features/graph/NodeAvatar";
import type { ConfigField } from "./config";

/** Config field: label, node avatars on the right, description and value editor. */
export function ConfigInput({
  field,
  value,
  onChange,
  showNodes = true,
}: {
  field: ConfigField;
  value: unknown;
  onChange: (value: unknown) => void;
  /** In a single node's settings the `Used in node` avatars are redundant — the node is already known. */
  showNodes?: boolean;
}) {
  const text = value === undefined || value === null ? "" : String(value);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <div className="flex w-full items-center gap-1">
          <span className="flex items-center capitalize">{field.title}</span>
          {showNodes && field.nodes.length > 0 && (
            <span className="ml-auto flex items-center gap-1">
              <span className="text-xs text-text-secondary">Used in node:</span>
              {field.nodes.map((node) => (
                <NodeAvatar key={node} node={node} title={node} />
              ))}
            </span>
          )}
        </div>
        {field.description && <span className="text-xs text-text-tertiary">{field.description}</span>}
      </div>
      {field.options ? (
        <Select value={text} options={field.options} onChange={onChange} />
      ) : isNumericType(field.type) ? (
        <input
          type="number"
          className="w-full rounded-lg border border-border-secondary bg-transparent p-2 px-2.5 text-sm transition-colors outline-none focus:border-border-brand"
          value={text}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      ) : field.type === "boolean" ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
          {field.title}
        </label>
      ) : (
        <div className="w-full rounded-lg border border-border-secondary p-2 px-2.5 transition-colors focus-within:border-border-brand">
          <textarea
            className="m-0 w-full resize-none border-none bg-transparent p-0 text-sm break-words whitespace-pre-wrap outline-none placeholder:text-text-quaternary"
            rows={field.prompt ? 3 : 1}
            placeholder={field.key}
            value={text}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
