import dagre from "@dagrejs/dagre";
import type { AssistantGraph } from "@langchain/langgraph-sdk";
import { isSystemNode } from "./colors";

/** Node geometry shared by layout and rendering: they must match. */
export const NODE_HEIGHT = 32;
/** Node width depends on the name length: measured on Studio, 64 px + 7 px per character. */
export const nodeWidth = (name: string) => 64 + 7 * name.length;

/**
 * Layout parameters. Top to bottom, 50 px spacing: with these the node coordinates
 * match the reference to within a quarter pixel on both verified graphs.
 *
 * The dagre version matters: the result is verified on @dagrejs/dagre 1.1.x (2.x and 3.x
 * changed the ordering algorithm, and the picture diverges from the reference).
 *
 * Cycles (`agent <-> tools`) need no special handling: the first step of the Sugiyama
 * algorithm inside dagre finds back edges itself by depth-first traversal and temporarily reverses them.
 * Reversing them manually before dagre changes the edge order and pulls the layout away from the reference.
 */
export const LAYOUT = { rankdir: "TB", nodesep: 50, ranksep: 50 } as const;

export interface LaidOutNode {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LaidOutEdge {
  id: string;
  source: string;
  target: string;
  conditional: boolean;
  label?: string;
  /** Whether an opposing target/source edge exists: such pairs are drawn as arcs in opposite directions. */
  paired: boolean;
}

/**
 * Frame around an expanded subgraph. Padding measured on the reference: 35 px on the sides
 * and 25 px above and below the outermost nested nodes.
 */
export const SUBGRAPH_PAD_X = 35;
export const SUBGRAPH_PAD_Y = 25;

export interface LaidOutGroup {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Layout {
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
  /** Frames of expanded subgraphs; nested nodes sit in `nodes` like regular ones. */
  groups: LaidOutGroup[];
}

/** `inner` lies inside `outer` on the canvas: `worker:prepare` inside `worker`. */
const isInside = (inner: string, outer: string): boolean => inner.startsWith(`${outer}:`);

/** Subgraphs the node lies in, outermost first: `mid`, `mid:leaf` for `mid:leaf:leaf_one`. */
const ancestors = (id: string, subgraphs: string[]): string[] =>
  subgraphs.filter((s) => isInside(id, s)).sort((a, b) => a.length - b.length);

/**
 * The subgraph the node is drawn inside: the deepest one, since only that frame is
 * visible when every subgraph above it is expanded too.
 */
export const parentSubgraph = (id: string, subgraphs: string[]): string | undefined => ancestors(id, subgraphs).at(-1);

/** The node belongs to a subgraph: the server names its nested nodes `<subgraph>:<node>`. */
export const subgraphOf = (id: string): string | undefined =>
  id.includes(":") ? id.slice(0, id.indexOf(":")) : undefined;

/**
 * The hovered log record points at this node. The reference highlights the node itself, the
 * nodes of a hovered subgraph, and — while the subgraph is collapsed — the node standing for
 * a nested record.
 */
export const matchesHover = (hoverNode: string | undefined, id: string): boolean =>
  hoverNode !== undefined && (hoverNode === id || isInside(hoverNode, id) || isInside(id, hoverNode));

/** Short name of a nested node: the reference labels them without the subgraph prefixes. */
export const shortName = (id: string): string => (id.includes(":") ? id.slice(id.lastIndexOf(":") + 1) : id);

/** Graph nodes without the system `__start__` / `__end__`: for the `Interrupts` menu and the `As Node` picker. */
export const userNodeIds = (graph?: AssistantGraph): string[] =>
  (graph?.nodes ?? []).map((n) => String(n.id)).filter((id) => !isSystemNode(id));

/**
 * Collapses subgraphs that are not expanded: their nested nodes are replaced by a single
 * subgraph node, and edges are rerouted to it. The reference receives the expanded
 * graph (`xray`) from the server and shows exactly this collapsed form.
 */
export function collapseSubgraphs(graph: AssistantGraph, subgraphs: string[], expanded: string[]): AssistantGraph {
  // The outermost collapsed subgraph wins: everything deeper hides behind its node
  const map = (id: string) => ancestors(id, subgraphs).find((s) => !expanded.includes(s)) ?? id;
  const nodes: AssistantGraph["nodes"] = [];
  const seen = new Set<string>();
  for (const n of graph.nodes) {
    const id = map(String(n.id));
    if (seen.has(id)) continue;
    seen.add(id);
    nodes.push(id === String(n.id) ? n : { ...n, id, data: { name: id } });
  }
  const edges: AssistantGraph["edges"] = [];
  const pairs = new Set<string>();
  for (const e of graph.edges) {
    const source = map(e.source);
    const target = map(e.target);
    // Internal edges of a collapsed subgraph become self-loops; they are not drawn
    if (source === target && source !== e.source) continue;
    const key = `${source}\u0000${target}\u0000${e.conditional ? 1 : 0}`;
    if (pairs.has(key)) continue;
    pairs.add(key);
    edges.push({ ...e, source, target });
  }
  return { ...graph, nodes, edges };
}

type RawNode = AssistantGraph["nodes"][number];

const nodeName = (n: RawNode): string => {
  if (typeof n.data === "string") return n.data;
  if (n.data && typeof n.data === "object" && typeof n.data.name === "string") return n.data.name;
  return n.name ?? String(n.id);
};

export function layoutGraph(graph: AssistantGraph, expanded: string[] = [], subgraphs: string[] = expanded): Layout {
  const ids = graph.nodes.map((n) => String(n.id));
  const names = new Map(graph.nodes.map((n) => [String(n.id), nodeName(n)]));

  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ ...LAYOUT });
  g.setDefaultEdgeLabel(() => ({}));
  for (const id of ids) {
    // Width is computed from the visible label: for a nested node that is the name without the subgraph prefix
    g.setNode(id, { width: nodeWidth(shortName(names.get(id) ?? id)), height: NODE_HEIGHT });
  }
  graph.edges.forEach((e, i) => g.setEdge(e.source, e.target, {}, String(i)));
  dagre.layout(g);

  let minX = Infinity;
  let minY = Infinity;
  const raw = ids.map((id) => {
    const p = g.node(id);
    const x = p.x - p.width / 2;
    const y = p.y - p.height / 2;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    return { id, name: names.get(id) ?? id, x, y, width: p.width, height: p.height };
  });
  // Shift to the origin; a quarter pixel is the same precision as the reference (82.75)
  const q = (v: number) => Math.round(v * 4) / 4;
  const nodes = raw.map((n) => ({ ...n, name: shortName(n.name), x: q(n.x - minX), y: q(n.y - minY) }));
  const groups = frameSubgraphs(nodes, expanded, subgraphs);
  // The subgraph frame extends left of the nested nodes: shift everything so the canvas
  // still starts at zero, as the reference does
  const shift = -Math.min(0, ...groups.map((g) => g.x));
  if (shift > 0) {
    for (const n of nodes) n.x += shift;
    for (const g of groups) g.x += shift;
  }

  const key = (s: string, t: string) => `${s} ${t}`;
  const present = new Set(graph.edges.map((e) => key(e.source, e.target)));
  // The reference names an edge `source-target`; the ordinal appears only for repeats
  const seen = new Map<string, number>();
  const edges: LaidOutEdge[] = graph.edges.map((e) => {
    const k = key(e.source, e.target);
    const n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    return {
      id: `${e.source}-${e.target}${n ? `-${n}` : ""}`,
      source: e.source,
      target: e.target,
      conditional: Boolean(e.conditional),
      label: typeof e.data === "string" ? e.data : undefined,
      paired: e.source !== e.target && present.has(key(e.target, e.source)),
    };
  });
  return { nodes, edges, groups };
}

/**
 * Spreads the layout around expanded subgraphs and returns their frames.
 *
 * First dagre lays everything out as a regular graph, then rows are spread: nested
 * nodes and everything below them move down by the top frame padding, and what lies
 * below the subgraph moves down by the bottom padding as well. Thus the row step at the
 * frame boundary becomes 107 px instead of 82 px, exactly as in the reference; a subgraph
 * inside a subgraph adds its own 25 px on each side, so the step grows again.
 *
 * The frames themselves are measured from the inside out, so a frame encloses both the
 * nodes and the frames of the subgraphs nested in it.
 */
function frameSubgraphs(nodes: LaidOutNode[], expanded: string[], subgraphs: string[]): LaidOutGroup[] {
  const descendants = (id: string) => nodes.filter((n) => isInside(n.id, id));
  // A subgraph is only drawn when every subgraph around it is expanded as well
  const visible = expanded.filter(
    (id) => descendants(id).length > 0 && ancestors(id, subgraphs).every((a) => expanded.includes(a)),
  );
  const topOf = (id: string) => Math.min(...descendants(id).map((n) => n.y));
  // Outer subgraphs come first: their top row lies above the nested ones
  const order = [...visible].sort((a, b) => topOf(a) - topOf(b) || a.length - b.length);

  for (const id of order) {
    // Top gap: move the subgraph itself and everything below it down
    const above = topOf(id);
    for (const n of nodes) if (n.y >= above) n.y += SUBGRAPH_PAD_Y;
    const bottom = Math.max(...descendants(id).map((n) => n.y + n.height));
    // Bottom gap: move down only what lies below the subgraph
    for (const n of nodes) if (n.y >= bottom) n.y += SUBGRAPH_PAD_Y;
  }

  const groups: LaidOutGroup[] = [];
  // Innermost first: an outer frame is measured around the frames already built
  for (const id of [...order].reverse()) {
    const boxes = [
      ...descendants(id).map((n) => ({ x: n.x, y: n.y, width: n.width, height: n.height })),
      ...groups.filter((g) => isInside(g.id, id)),
    ];
    const left = Math.min(...boxes.map((b) => b.x));
    const right = Math.max(...boxes.map((b) => b.x + b.width));
    const top = Math.min(...boxes.map((b) => b.y));
    const bottom = Math.max(...boxes.map((b) => b.y + b.height));
    groups.push({
      id,
      name: id,
      x: left - SUBGRAPH_PAD_X,
      y: top - SUBGRAPH_PAD_Y,
      width: right - left + 2 * SUBGRAPH_PAD_X,
      height: bottom - top + 2 * SUBGRAPH_PAD_Y,
    });
  }
  // Back to outermost-first: React Flow needs a parent frame before the frames inside it
  return groups.reverse();
}
