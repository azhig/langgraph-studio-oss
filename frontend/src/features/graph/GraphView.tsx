import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import type { AssistantGraph, GraphSchema } from "@langchain/langgraph-sdk";
import { useStudio } from "@/store/studio";
import { buildFlow, configurableNodes } from "./flow";
import { clearSavedPositions, positionsKey, readSavedPositions, writeSavedPosition, type Point } from "./positions";
import { GraphNode, type GraphFlowNode } from "./GraphNode";
import { GraphEdge } from "./GraphEdge";
import { SubgraphFrame } from "./SubgraphFrame";
import { ZoomControls } from "./ZoomControls";

const nodeTypes: NodeTypes = { studio: GraphNode, subgraph: SubgraphFrame };
const edgeTypes: EdgeTypes = { studio: GraphEdge };

/** Fitting the graph: no larger than 1:1, with a 10 % margin, as in the reference. */
const FIT = { maxZoom: 1, padding: 0.1 } as const;

interface Props {
  graph: AssistantGraph;
  schemas?: GraphSchema;
  /** Nodes backed by a subgraph, and those of them that are currently expanded. */
  subgraphs: string[];
  expanded: string[];
}

function Canvas({ graph, schemas, subgraphs, expanded }: Props) {
  const theme = useStudio((s) => s.theme);
  const configurable = useMemo(() => configurableNodes(schemas), [schemas]);
  const flow = useMemo(
    () => buildFlow(graph, theme, configurable, subgraphs, expanded),
    [graph, theme, configurable, subgraphs, expanded],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(flow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flow.edges);
  const { fitView } = useReactFlow();

  /**
   * Nodes the user moved themselves. Their position survives a canvas rebuild:
   * theme change, subgraph expansion and redraws during a run;
   * the rest snap to the auto layout every time. Reset by the
   * `Reset layout to default`.
   */
  const assistantId = useStudio((s) => s.assistantId);
  const storageKey = positionsKey(assistantId);
  const moved = useRef(readSavedPositions(storageKey));
  // The assistant changed: read its own pinned positions
  useEffect(() => {
    moved.current = readSavedPositions(storageKey);
  }, [storageKey]);

  // A redraw returns nodes to their auto-layout places, except those the user
  // moved: their position is stored separately and survives subgraph expansion.
  useEffect(() => {
    setNodes(flow.nodes.map((n) => ({ ...n, position: moved.current.get(n.id) ?? n.position })));
    setEdges(flow.edges);
  }, [flow, setNodes, setEdges]);

  // The graph is fitted once: on open and on assistant change. Expanding
  // a subgraph leaves the viewport alone: the reference behaves the same way.
  useEffect(() => {
    const t = window.setTimeout(() => void fitView({ ...FIT, duration: 0 }), 30);
    return () => window.clearTimeout(t);
  }, [graph, fitView]);

  /** Remember the manual node position: both for the session and across sessions. */
  const rememberPosition = useCallback(
    (_: unknown, node: { id: string; position: Point }) => {
      moved.current.set(node.id, { ...node.position });
      writeSavedPosition(storageKey, node.id, node.position);
    },
    [storageKey],
  );

  /** The "Reset layout to default" button: auto layout and collapsed subgraphs. */
  const collapseAll = useStudio((s) => s.collapseSubgraphs);
  const resetLayout = useCallback(() => {
    moved.current.clear();
    clearSavedPositions(storageKey);
    collapseAll();
    setNodes(flow.nodes);
    window.setTimeout(() => void fitView({ ...FIT, duration: 200 }), 0);
  }, [flow, setNodes, fitView, collapseAll, storageKey]);

  return (
    <>
      <div className="absolute inset-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={rememberPosition}
          fitViewOptions={FIT}
          minZoom={0.1}
          maxZoom={2}
          nodesConnectable={false}
          // As in the reference: the wheel zooms, the canvas background is dragged with the mouse
          // (`.react-flow__pane` with a hand cursor), double click does nothing
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
          className="studio-flow"
        />
      </div>
      <Overlay onResetLayout={resetLayout} />
    </>
  );
}

/**
 * The zoom panel and minimap live outside the canvas: `.react-flow` clips its content,
 * while in the reference the panel sticks out upward, in line with the Memory / Interrupts buttons.
 */
function Overlay({ onResetLayout }: { onResetLayout: () => void }) {
  return (
    <div className="absolute -top-[54px] left-4 z-10 flex h-fit items-start gap-4">
      <ZoomControls onResetLayout={onResetLayout} />
      <div className="relative" style={{ width: 78, height: 52 }}>
        <MiniMap
          position="top-left"
          pannable
          zoomable={false}
          className="!absolute !top-0 !left-0 !m-0 !bg-[var(--minimap-bg)]"
          style={{ width: 78, height: 52 }}
          maskColor="var(--minimap-mask)"
          nodeBorderRadius={12}
          nodeStrokeWidth={0}
          nodeColor={(n) => (n as GraphFlowNode).data?.palette.minimap ?? "#666"}
        />
      </div>
    </div>
  );
}

export function GraphView(props: Props) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
