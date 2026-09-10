import { memo } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { useStudio } from "@/store/studio";
import { useRun } from "@/store/run";
import { HoverCard } from "@/components/HoverCard";
import { CollapseGlyph, ExpandGlyph, SubgraphGlyph } from "@/components/icons/SubgraphGlyphs";
import { NodeHoverCard } from "./NodeHoverCard";
import type { NodePalette } from "./colors";

export interface SubgraphFrameData extends Record<string, unknown> {
  name: string;
  palette: NodePalette;
}

export type SubgraphFlowNode = Node<SubgraphFrameData, "subgraph">;

/**
 * Frame of an expanded subgraph. Captured from the reference: a rectangle in the node tone
 * (10 % fill, border in the tone), radius 8, raised 24 px upward to
 * fit the header with the name; lies under the nodes (layer zero, see flow.ts).
 * Clicking the frame collapses the subgraph, just like clicking the collapsed node.
 */
function SubgraphFrameComponent({ id, data }: NodeProps<SubgraphFlowNode>) {
  const { name, palette } = data;
  const toggleSubgraph = useStudio((s) => s.toggleSubgraph);
  const dimmed = useRun((s) => {
    if (s.hoverNode) return s.hoverNode !== id;
    return Boolean(s.activeNode) || Boolean(s.errorNode);
  });

  return (
    <HoverCard
      className="absolute inset-0 -top-6"
      card={<NodeHoverCard node={id} sources={[]} targets={[]} subgraph />}
    >
      <div
        className="group flex h-full w-full cursor-pointer flex-col place-items-center rounded-lg border transition-opacity"
        style={{
          color: palette.text,
          backgroundColor: palette.background,
          borderColor: palette.border,
          opacity: dimmed ? 0.3 : 1,
        }}
        onClick={() => toggleSubgraph(id)}
      >
        <div className="mt-2 flex items-center justify-center gap-1.5">
          <SubgraphIcon expanded />
          <div className="text-xs font-medium">{name}</div>
        </div>
        <span
          className="node-stripes pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-1/2 overflow-hidden rounded-b-lg opacity-0 transition-opacity"
          style={{ color: palette.stripes }}
        />
      </div>
    </HoverCard>
  );
}

/**
 * Subgraph icon on the node: brackets, and arrows on hover. On a collapsed node
 * it means "expand", on an expanded frame "collapse".
 */
export function SubgraphIcon({ expanded = false }: { expanded?: boolean }) {
  const Arrows = expanded ? CollapseGlyph : ExpandGlyph;
  return (
    <span className="pointer-events-auto relative size-4">
      <SubgraphGlyph className="absolute inset-0 size-4 opacity-100 transition-opacity group-hover:opacity-0" />
      <Arrows className="absolute inset-0 size-4 opacity-0 transition-opacity group-hover:opacity-100" />
    </span>
  );
}

export const SubgraphFrame = memo(SubgraphFrameComponent);
