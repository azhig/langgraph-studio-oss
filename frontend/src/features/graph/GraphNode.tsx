import { memo, useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { CircleAlert, Settings } from "lucide-react";
import { cx } from "@/lib/cx";
import { useRun } from "@/store/run";
import { useStudio } from "@/store/studio";
import { HoverCard } from "@/components/HoverCard";
import { NodeConfigModal } from "@/features/assistants/NodeConfigModal";
import { NodeHoverCard } from "./NodeHoverCard";
import { SubgraphIcon } from "./SubgraphFrame";
import { matchesHover, subgraphOf } from "./layout";
import { isSystemNode, type NodePalette } from "./colors";

export type NodeStatus = "idle" | "active" | "error";

export interface GraphNodeData extends Record<string, unknown> {
  name: string;
  palette: NodePalette;
  /** Has configuration fields bound to the node (config_schema.langgraph_nodes). */
  configurable: boolean;
  /** Node neighbors: shown in the hover card. */
  sources: string[];
  targets: string[];
  /** A subgraph stands behind the node: it can be expanded by clicking. */
  subgraph: boolean;
}

export type GraphFlowNode = Node<GraphNodeData, "studio">;

/**
 * Graph node: dimensions come from the layout (width/height on the node itself),
 * styling is derived from the tone (DESIGN-TOKENS.md, "Graph nodes").
 *
 * During a run the reference dims everything except the running node: the wrapper gets
 * `opacity: .1`, while the active one gets `opacity: 1` and a 1.05 scale with a 300 ms transition.
 * The node reads run state from the store itself rather than via props: React Flow
 * node objects must not be recreated, or measured sizes and handles are lost.
 * The handles themselves are hidden; edges compute entry and exit points geometrically (GraphEdge).
 */
function GraphNodeComponent({ id, data }: NodeProps<GraphFlowNode>) {
  const { name, palette, configurable, sources, targets, subgraph } = data;
  const status = useRun((s) => (s.activeNode === id ? "active" : s.errorNode === id ? "error" : "idle")) as NodeStatus;
  // Hatching marks the node that has an interrupt set: it stays on the whole time
  // the pause is enabled in the `Interrupts` menu, not only when the thread has stopped on it.
  // A `before` pause hatches the top half of the node, `after` the bottom, both the whole node.
  const before = useRun((s) => s.interruptBefore.includes(id));
  const after = useRun((s) => s.interruptAfter.includes(id));
  const stripes =
    before && after ? "inset-0 rounded-md" : before ? "top-0 h-1/2 rounded-t-md" : "bottom-0 h-1/2 rounded-b-md";
  // While a run is in progress the running node glows; after a failure, the one it stopped on.
  // On pause the reference dims nothing: the node from `next` is simply covered with hatching.
  // Hovering a log entry highlights its node and dims the rest to 30 %.
  // The highlight extends to the whole subgraph: a `worker` entry in the log raises
  // both the frame and the nested nodes, as the reference does
  const parent = subgraphOf(id);
  const hovered = useRun((s) => matchesHover(s.hoverNode, id));
  const dimmed = useRun((s) => {
    if (s.hoverNode) return !matchesHover(s.hoverNode, id);
    if (s.activeNode) return s.activeNode !== id;
    if (s.errorNode) return s.errorNode !== id;
    return false;
  });
  const dimLevel = useRun((s) => (s.hoverNode ? 0.3 : 0.1));
  const system = isSystemNode(id);
  const [configOpen, setConfigOpen] = useState(false);
  const openAssistants = useStudio((s) => s.setAssistantsOpen);
  const toggleSubgraph = useStudio((s) => s.toggleSubgraph);
  const subgraphOpen = useStudio((s) => s.expandedSubgraphs.includes(id));
  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!pointer-events-none !opacity-0" />
      {configurable && !system && (
        <button
          type="button"
          aria-label="Edit node configuration"
          title="Edit node configuration"
          className="absolute -top-1 -right-1 z-10 flex size-3 items-center justify-center rounded-full"
          style={{ background: palette.dotBackground, color: palette.dotForeground }}
          onClick={() => setConfigOpen(true)}
        >
          <Settings size={8} strokeWidth={3} />
        </button>
      )}
      <div
        className="w-full text-center backdrop-blur-sm transition-all duration-300 ease-in-out"
        style={{
          opacity: dimmed ? dimLevel : 1,
          transform: status === "active" || hovered ? "scale(1.05)" : undefined,
        }}
      >
        <HoverCard
          card={
            <NodeHoverCard
              node={id}
              label={name}
              sources={sources}
              targets={targets}
              subgraph={subgraph}
              nested={parent !== undefined}
            />
          }
        >
          <div
            className={cx(
              "node-body group relative w-full border p-2 text-center text-sm leading-none font-medium",
              system ? "rounded-full" : "rounded-md",
              subgraph && "cursor-pointer",
            )}
            style={{ color: palette.text, background: palette.background, borderColor: palette.border }}
            onClick={subgraph ? () => toggleSubgraph(id) : undefined}
          >
            <div className="relative z-[2] flex items-center justify-center gap-1.5">
              {subgraph && <SubgraphIcon expanded={subgraphOpen} />}
              <span className="leading-none">{name}</span>
            </div>
            <span
              className={`node-stripes pointer-events-none absolute inset-x-0 z-[1] overflow-hidden transition-opacity ${stripes}`}
              style={{ opacity: before || after ? 1 : 0, color: palette.stripes }}
            />
          </div>
        </HoverCard>
      </div>
      <NodeConfigModal
        node={id}
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        onOpenAssistants={() => openAssistants(true)}
      />
      {status === "error" && (
        <div className="absolute top-1/2 left-full ml-2 -translate-y-1/2">
          <div className="flex flex-row items-center gap-0.5 rounded-md border border-border-error bg-bg-error-secondary px-2 py-1 text-text-error-secondary">
            <CircleAlert size={10} strokeWidth={1.8} />
            <span className="text-[8px] leading-none font-medium">Error</span>
          </div>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!pointer-events-none !opacity-0" />
    </div>
  );
}

export const GraphNode = memo(GraphNodeComponent);
