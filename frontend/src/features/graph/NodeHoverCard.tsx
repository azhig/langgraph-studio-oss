import { cx } from "@/lib/cx";
import { useRun } from "@/store/run";
import { useStudio, type Theme } from "@/store/studio";
import { Checkbox } from "@/components/Checkbox";
import { CollapseGlyph, ExpandGlyph, SubgraphGlyph } from "@/components/icons/SubgraphGlyphs";
import { isSystemNode, nodePalette } from "./colors";

/**
 * Node hover card. Captured from the reference: the node name as a chip, below it a
 * `Source` / `Target` grid with neighbor chips, at the bottom after a divider the
 * `Interrupt Before` and `Interrupt After` checkboxes. For a subgraph node, instead of neighbors,
 * a `Show subgraph nodes` item (`Hide subgraph nodes` when expanded).
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
  /** Visible name: for a nested node, without the subgraph prefix. */
  label?: string;
  sources: string[];
  targets: string[];
  subgraph?: boolean;
  /** Node inside a subgraph: a pause cannot be set on it, no checkboxes. */
  nested?: boolean;
}) {
  const theme = useStudio((s) => s.theme);
  const expanded = useStudio((s) => s.expandedSubgraphs.includes(node));
  const toggleSubgraph = useStudio((s) => s.toggleSubgraph);
  const before = useRun((s) => s.interruptBefore.includes(node));
  const after = useRun((s) => s.interruptAfter.includes(node));
  const toggleInterrupt = useRun((s) => s.toggleInterrupt);
  // For system nodes the reference shows only connections, without interrupt checkboxes
  const system = isSystemNode(node);

  return (
    <div className="flex w-auto max-w-[300px] flex-col rounded-lg border border-border-secondary bg-bg-elevated pb-3 text-sm shadow-[var(--shadow-lg)]">
      <div className="my-4 ml-3">
        <Chip name={label ?? node} theme={theme} size="sm" icon={subgraph} />
      </div>
      {/* Connections are shown for all nodes, including subgraphs; for system nodes only
          the side that exists */}
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
        <div className="mt-3 -mb-2 flex items-center gap-2 border-t border-border-secondary px-3 pt-1">
          <Checkbox
            label="Interrupt Before"
            className="gap-2"
            checked={before}
            onToggle={() => toggleInterrupt(node, "before")}
          />
          <Checkbox
            label="Interrupt After"
            className="gap-2"
            checked={after}
            onToggle={() => toggleInterrupt(node, "after")}
          />
        </div>
      )}
    </div>
  );
}

function Chips({ names, theme }: { names: string[]; theme: Theme }) {
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

/** Node chip: colors from its tone; system nodes are rounded into a pill. */
function Chip({
  name,
  theme,
  size,
  icon = false,
}: {
  name: string;
  theme: Theme;
  size: "sm" | "xs";
  /** A subgraph has its icon before the name. */
  icon?: boolean;
}) {
  const palette = nodePalette(name, theme);
  return (
    <span
      className={cx(
        "shrink-0 border px-2 py-1 font-medium whitespace-nowrap",
        isSystemNode(name) ? "rounded-full" : "rounded-md",
        size === "sm" ? "text-sm" : "text-xs",
      )}
      style={{ color: palette.text, backgroundColor: palette.chipBackground, borderColor: palette.border }}
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
