import { Select } from "@/components/Select";
import { useStudio } from "@/store/studio";
import { nodePalette } from "@/features/graph/colors";
import type { ConfigField } from "./config";

/** Поле конфигурации: подпись, аватары узлов справа, описание и редактор значения. */
export function ConfigInput({
  field,
  value,
  onChange,
  showNodes = true,
}: {
  field: ConfigField;
  value: unknown;
  onChange: (value: unknown) => void;
  /** В настройках одного узла аватары `Used in node` не нужны — узел и так известен. */
  showNodes?: boolean;
}) {
  const theme = useStudio((s) => s.theme);
  const text = value === undefined || value === null ? "" : String(value);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <div className="flex w-full items-center gap-1">
          <span className="flex items-center capitalize">{field.title}</span>
          {showNodes && field.nodes.length > 0 && (
            <span className="ml-auto flex items-center gap-1">
              <span className="text-xs text-text-secondary">Used in node:</span>
              {field.nodes.map((node) => {
                const palette = nodePalette(node, theme);
                const [h, s, l] = palette.tone;
                return (
                  <span
                    key={node}
                    title={node}
                    className="flex size-5 items-center justify-center rounded-full border text-center text-[10px] font-semibold uppercase"
                    style={{
                      color: palette.text,
                      backgroundColor: `hsla(${h}, ${s}%, ${l}%, 0.2)`,
                      borderColor: palette.border,
                    }}
                  >
                    {node.slice(0, 1)}
                  </span>
                );
              })}
            </span>
          )}
        </div>
        {field.description && <span className="text-xs text-text-tertiary">{field.description}</span>}
      </div>
      {field.options ? (
        <Select value={text} options={field.options} onChange={onChange} />
      ) : field.type === "number" || field.type === "integer" ? (
        <input
          type="number"
          className="w-full rounded-lg border border-border-secondary bg-transparent p-2 px-2.5 text-sm outline-none transition-colors focus:border-border-brand"
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
            className="m-0 w-full resize-none whitespace-pre-wrap break-words border-none bg-transparent p-0 text-sm outline-none placeholder:text-text-quaternary"
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
