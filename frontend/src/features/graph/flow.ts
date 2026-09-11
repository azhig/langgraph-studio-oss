import type { AssistantGraph, GraphSchema } from "@langchain/langgraph-sdk";
import type { Theme } from "@/store/studio";
import type { JsonSchema } from "@/lib/schema";
import { nodePalette } from "./colors";
import { collapseSubgraphs, layoutGraph, parentSubgraph, shortName } from "./layout";
import type { GraphFlowEdge } from "./GraphEdge";
import type { GraphFlowNode } from "./GraphNode";
import type { SubgraphFlowNode } from "./SubgraphFrame";

export interface FlowModel {
  nodes: (GraphFlowNode | SubgraphFlowNode)[];
  edges: GraphFlowEdge[];
}

/** Nodes that have configuration fields bound to them (config_schema -> langgraph_nodes). */
export function configurableNodes(schemas?: GraphSchema): Set<string> {
  const out = new Set<string>();
  const schema = (schemas?.config_schema ?? schemas?.context_schema) as JsonSchema | undefined;
  for (const p of Object.values(schema?.properties ?? {})) {
    for (const n of p?.langgraph_nodes ?? []) out.add(n);
  }
  return out;
}

/** Neighbors of each node by the edges of the visible graph, for the hover card. */
function neighbourhood(graph: AssistantGraph): Map<string, { sources: string[]; targets: string[] }> {
  const out = new Map<string, { sources: string[]; targets: string[] }>();
  const of = (id: string) => {
    const cur = out.get(id) ?? { sources: [], targets: [] };
    out.set(id, cur);
    return cur;
  };
  for (const e of graph.edges) {
    if (!of(e.target).sources.includes(e.source)) of(e.target).sources.push(e.source);
    if (!of(e.source).targets.includes(e.target)) of(e.source).targets.push(e.target);
  }
  return out;
}

/**
 * Canvas nodes and edges. Run state is deliberately absent here: nodes and edges
 * read their highlighting from the store themselves. Otherwise every stream event
 * would recreate the node objects, and React Flow binds measured sizes and handle
 * positions to them; on recreation they are lost and edges vanish from the canvas.
 */
export function buildFlow(
  graph: AssistantGraph,
  theme: Theme,
  configurable: Set<string>,
  subgraphs: string[],
  expanded: string[],
): FlowModel {
  const visible = collapseSubgraphs(graph, subgraphs, expanded);
  const layout = layoutGraph(visible, expanded, subgraphs);
  // The reference keeps the frame of an expanded subgraph where the collapsed node stood,
  // so the group is shifted by the difference from the fully collapsed layout; everything
  // inside it — nodes and the frames of nested subgraphs — moves along
  if (layout.groups.length) {
    const collapsed = layoutGraph(collapseSubgraphs(graph, subgraphs, []));
    for (const g of layout.groups) {
      const was = collapsed.nodes.find((n) => n.id === g.id);
      if (!was) continue;
      const dx = was.x - g.x;
      if (!dx) continue;
      g.x += dx;
      for (const n of layout.nodes) if (n.id.startsWith(`${g.id}:`)) n.x += dx;
      for (const inner of layout.groups) if (inner.id.startsWith(`${g.id}:`)) inner.x += dx;
    }
  }
  const neighbours = neighbourhood(visible);

  const frameById = new Map(layout.groups.map((g) => [g.id, g]));
  const frameIds = layout.groups.map((g) => g.id);
  /** Frame the element is drawn in: React Flow positions it relative to that frame. */
  const frameOf = (id: string) => frameById.get(parentSubgraph(id, frameIds) ?? "");

  // Frames of expanded subgraphs go first: React Flow requires the parent before its children
  const frames: SubgraphFlowNode[] = layout.groups.map((g) => ({
    id: g.id,
    type: "subgraph",
    // A subgraph inside a subgraph is bound to the outer frame, like the nodes
    parentId: frameOf(g.id)?.id,
    extent: frameOf(g.id) ? ("parent" as const) : undefined,
    position: (() => {
      const outer = frameOf(g.id);
      return outer ? { x: g.x - outer.x, y: g.y - outer.y } : { x: g.x, y: g.y };
    })(),
    width: g.width,
    height: g.height,
    connectable: false,
    // The frame lies under the nodes but must accept clicks: React Flow grants
    // `pointer-events` only to nodes that are selectable or draggable.
    // It is dragged as a whole, together with the nested nodes, while selection
    // is disabled: in the reference the frame never rises above the nodes.
    selectable: false,
    draggable: true,
    // As in the reference: the frame sits on layer zero, under the nested nodes but not
    // under the canvas. A negative z-index would sink it below the `pane` layer,
    // and then neither clicks on the frame nor dragging the canvas would work together.
    zIndex: 0,
    // The heading and the tone follow the short name, as for a nested node
    data: { name: shortName(g.name), palette: nodePalette(shortName(g.name), theme) },
  }));
  const nodes: (GraphFlowNode | SubgraphFlowNode)[] = [
    ...frames,
    ...layout.nodes.map((n): GraphFlowNode => {
      // A node inside an expanded subgraph is bound to its frame: it moves with it
      // and cannot leave its bounds (`extent: "parent"`), as in the reference.
      const frame = frameOf(n.id);
      return {
        id: n.id,
        type: "studio",
        position: frame ? { x: n.x - frame.x, y: n.y - frame.y } : { x: n.x, y: n.y },
        parentId: frame?.id,
        extent: frame ? "parent" : undefined,
        width: n.width,
        height: n.height,
        connectable: false,
        selectable: false,
        data: {
          name: n.name,
          palette: nodePalette(n.name, theme),
          configurable: configurable.has(n.id),
          // Neighbors are shown by short names, like the node labels
          sources: (neighbours.get(n.id)?.sources ?? []).map(shortName),
          targets: (neighbours.get(n.id)?.targets ?? []).map(shortName),
          subgraph: subgraphs.includes(n.id),
        },
      };
    }),
  ];
  const edges: GraphFlowEdge[] = layout.edges.map((e) => {
    const p = nodePalette(shortName(e.source), theme);
    return {
      id: e.id,
      type: "studio",
      source: e.source,
      target: e.target,
      selectable: false,
      data: { conditional: e.conditional, label: e.label, paired: e.paired, stroke: p.edge, arrow: p.arrow },
    };
  });
  return { nodes, edges };
}
