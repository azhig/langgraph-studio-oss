import { Check } from "lucide-react";
import { useRun } from "@/store/run";
import { useStudio } from "@/store/studio";
import { isSystemNode, nodePalette } from "./colors";
import { CollapseGlyph, ExpandGlyph, SubgraphGlyph } from "./SubgraphFrame";

/**
 * Карточка узла по наведению. Снято с эталона: имя узла чипом, ниже сетка
 * `Source` / `Target` с чипами соседей, внизу через разделитель — флажки
 * `Interrupt Before` и `Interrupt After`. У узла-подграфа вместо соседей —
 * пункт `Show subgraph nodes` (в раскрытом виде — `Hide subgraph nodes`).
 */
export function NodeHoverCard({
  node,
  label,
  sources,
  targets,
  subgraph = false,
  nested = false,
}: {
  node: string;
  /** Видимое имя: у вложенного узла — без префикса подграфа. */
  label?: string;
  sources: string[];
  targets: string[];
  subgraph?: boolean;
  /** Узел внутри подграфа: паузу на нём поставить нельзя, флажков нет. */
  nested?: boolean;
}) {
  const theme = useStudio((s) => s.theme);
  const expanded = useStudio((s) => s.expandedSubgraphs.includes(node));
  const toggleSubgraph = useStudio((s) => s.toggleSubgraph);
  const { interruptBefore, interruptAfter, toggleInterrupt } = useRun();
  // У служебных узлов эталон показывает только связи, без флажков прерываний
  const system = isSystemNode(node);

  return (
    <div className="flex w-auto max-w-[300px] flex-col rounded-lg border border-border-secondary bg-bg-elevated pb-3 text-sm shadow-[var(--shadow-lg)]">
      <div className="my-4 ml-3">
        <Chip name={label ?? node} theme={theme} size="sm" icon={subgraph} />
      </div>
      {/* Связи показываются у всех узлов, включая подграфы; у служебных — только
          та сторона, которая есть */}
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
        {sources.length > 0 && (
          <>
            <div className="pl-3 text-text-tertiary">Source</div>
            <Chips names={sources} theme={theme} />
          </>
        )}
        {targets.length > 0 && (
          <>
            <div className="pl-3 text-text-tertiary">Target</div>
            <Chips names={targets} theme={theme} />
          </>
        )}
      </div>
      {subgraph && (
        <div className="mt-3 border-t border-border-secondary px-3 pt-3">
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-2 rounded-md border border-border-default px-2 py-1 text-xs text-text-tertiary"
            onClick={() => toggleSubgraph(node)}
          >
            {expanded ? <CollapseGlyph className="size-4" /> : <ExpandGlyph className="size-4" />}
            {expanded ? "Hide subgraph nodes" : "Show subgraph nodes"}
          </button>
        </div>
      )}
      {!nested && !system && (
        <div className="-mb-2 mt-3 flex items-center gap-2 border-t border-border-secondary px-3 pt-1">
          <Flag
            label="Interrupt Before"
            checked={interruptBefore.includes(node)}
            onToggle={() => toggleInterrupt(node, "before")}
          />
          <Flag
            label="Interrupt After"
            checked={interruptAfter.includes(node)}
            onToggle={() => toggleInterrupt(node, "after")}
          />
        </div>
      )}
    </div>
  );
}

function Chips({ names, theme }: { names: string[]; theme: "dark" | "light" }) {
  if (!names.length) return <span className="pr-3 text-text-quaternary">—</span>;
  return (
    <div className="scroll-thin flex items-center gap-2 overflow-x-auto">
      {names.map((name) => (
        <Chip key={name} name={name} theme={theme} size="xs" />
      ))}
      <div className="w-2 flex-shrink-0" />
    </div>
  );
}

/** Чип узла: цвета из его тона, служебные — со скруглением в кольцо. */
function Chip({
  name,
  theme,
  size,
  icon = false,
}: {
  name: string;
  theme: "dark" | "light";
  size: "sm" | "xs";
  /** У подграфа перед именем стоит его значок. */
  icon?: boolean;
}) {
  const palette = nodePalette(name, theme);
  const [h, s, l] = palette.tone;
  return (
    <span
      className={`shrink-0 whitespace-nowrap border px-2 py-1 font-medium ${
        isSystemNode(name) ? "rounded-full" : "rounded-md"
      } ${size === "sm" ? "text-sm" : "text-xs"}`}
      style={{
        color: palette.text,
        backgroundColor: `hsla(${h}, ${s}%, ${l}%, 0.15)`,
        borderColor: palette.border,
      }}
    >
      {icon ? (
        <span className="-my-1 inline-flex items-center gap-1">
          <SubgraphGlyph className="inline-flex size-3" />
          {name}
        </span>
      ) : (
        name
      )}
    </span>
  );
}

function Flag({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex shrink-0 cursor-pointer items-center gap-2 py-2 text-xs text-text-tertiary"
      onClick={onToggle}
    >
      <span
        className={`flex size-4 items-center justify-center rounded-[4px] border ${
          checked ? "border-bg-brand bg-bg-brand-tertiary text-text-brand-secondary" : "border-border-secondary"
        }`}
      >
        {checked && <Check size={12} strokeWidth={2.4} />}
      </span>
      <span>{label}</span>
    </button>
  );
}
