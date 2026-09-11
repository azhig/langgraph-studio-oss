import { describe, expect, it } from "vitest";
import type { AssistantGraph } from "@langchain/langgraph-sdk";
import {
  collapseSubgraphs,
  layoutGraph,
  matchesHover,
  nodeWidth,
  parentSubgraph,
  shortName,
  subgraphOf,
  userNodeIds,
} from "./layout";

const node = (id: string) => ({ id, type: "runnable", data: { id: [id], name: id } });
const edge = (source: string, target: string, conditional = false) => ({ source, target, conditional });

/** `agent <-> action`: a minimal graph with a cycle, like the `agent` example. */
const AGENT: AssistantGraph = {
  nodes: [node("__start__"), node("agent"), node("action"), node("__end__")],
  edges: [
    edge("__start__", "agent"),
    edge("agent", "action", true),
    edge("action", "agent"),
    edge("agent", "__end__", true),
  ],
};

/** Graph with a subgraph inside a subgraph: `mid` holds `mid:leaf`. */
const DEEP: AssistantGraph = {
  nodes: [
    node("__start__"),
    node("top"),
    node("mid:mid_start"),
    node("mid:leaf:leaf_one"),
    node("mid:leaf:leaf_two"),
    node("bottom"),
    node("__end__"),
  ],
  edges: [
    edge("__start__", "top"),
    edge("top", "mid:mid_start"),
    edge("mid:mid_start", "mid:leaf:leaf_one"),
    edge("mid:leaf:leaf_one", "mid:leaf:leaf_two"),
    edge("mid:leaf:leaf_two", "bottom"),
    edge("bottom", "__end__"),
  ],
};

/** Graph with the `worker` subgraph; nested nodes are named `worker:<name>`. */
const NESTED: AssistantGraph = {
  nodes: [
    node("__start__"),
    node("outer"),
    node("worker:prepare"),
    node("worker:finish"),
    node("done"),
    node("__end__"),
  ],
  edges: [
    edge("__start__", "outer"),
    edge("outer", "worker:prepare"),
    edge("worker:prepare", "worker:finish"),
    edge("worker:finish", "done"),
    edge("done", "__end__"),
  ],
};

describe("node names", () => {
  it("width grows by 7 px per character from a base of 64", () => {
    expect(nodeWidth("")).toBe(64);
    expect(nodeWidth("agent")).toBe(99);
  });

  it("nested nodes are named with a colon", () => {
    expect(subgraphOf("worker:prepare")).toBe("worker");
    expect(subgraphOf("agent")).toBeUndefined();
    expect(shortName("worker:prepare")).toBe("prepare");
  });

  it("a hovered log record matches its node, the nodes inside it and the node it hides in", () => {
    // a plain record
    expect(matchesHover("agent", "agent")).toBe(true);
    expect(matchesHover("agent", "tools")).toBe(false);
    // the subgraph record raises every node of the expanded subgraph, but not its neighbours
    expect(matchesHover("worker", "worker:prepare")).toBe(true);
    expect(matchesHover("worker", "worker")).toBe(true);
    expect(matchesHover("worker", "workers")).toBe(false);
    // a nested record raises its own node, and the subgraph while it is collapsed
    expect(matchesHover("worker:prepare", "worker:prepare")).toBe(true);
    expect(matchesHover("worker:prepare", "worker")).toBe(true);
    expect(matchesHover("worker:prepare", "worker:finish")).toBe(false);
    expect(matchesHover(undefined, "worker")).toBe(false);
  });

  it("userNodeIds drops system nodes", () => {
    expect(userNodeIds(AGENT)).toEqual(["agent", "action"]);
    expect(userNodeIds(undefined)).toEqual([]);
  });
});

describe("layoutGraph", () => {
  it("layout starts at zero, row step is 82 px", () => {
    const { nodes, edges } = layoutGraph(AGENT);
    expect(Math.min(...nodes.map((n) => n.x))).toBe(0);
    expect(Math.min(...nodes.map((n) => n.y))).toBe(0);
    const ys = [...new Set(nodes.map((n) => n.y))].sort((a, b) => a - b);
    expect(ys[1] - ys[0]).toBe(82);
    expect(edges.map((e) => e.id)).toEqual(["__start__-agent", "agent-action", "action-agent", "agent-__end__"]);
  });

  it("opposing edges are marked as paired, conditional ones as dashed", () => {
    const { edges } = layoutGraph(AGENT);
    const byId = Object.fromEntries(edges.map((e) => [e.id, e]));
    expect(byId["agent-action"].paired).toBe(true);
    expect(byId["action-agent"].paired).toBe(true);
    expect(byId["agent-action"].conditional).toBe(true);
    expect(byId["__start__-agent"].paired).toBe(false);
  });

  it("a repeated edge between the same nodes gets an ordinal number", () => {
    const { edges } = layoutGraph({ nodes: [node("a"), node("b")], edges: [edge("a", "b"), edge("a", "b", true)] });
    expect(edges.map((e) => e.id)).toEqual(["a-b", "a-b-1"]);
  });
});

describe("subgraphs", () => {
  it("a collapsed subgraph replaces nested nodes with one and reroutes edges", () => {
    const g = collapseSubgraphs(NESTED, ["worker"], []);
    expect(g.nodes.map((n) => n.id)).toEqual(["__start__", "outer", "worker", "done", "__end__"]);
    expect(g.edges.map((e) => `${e.source}>${e.target}`)).toEqual([
      "__start__>outer",
      "outer>worker",
      "worker>done",
      "done>__end__",
    ]);
  });

  it("a subgraph inside a subgraph collapses into the outermost one that is closed", () => {
    const subgraphs = ["mid", "mid:leaf"];
    // Nothing expanded: only the outer node is left
    expect(collapseSubgraphs(DEEP, subgraphs, []).nodes.map((n) => n.id)).toEqual([
      "__start__",
      "top",
      "mid",
      "bottom",
      "__end__",
    ]);
    // The outer one is open, the inner one still stands for its nodes
    expect(collapseSubgraphs(DEEP, subgraphs, ["mid"]).nodes.map((n) => n.id)).toEqual([
      "__start__",
      "top",
      "mid:mid_start",
      "mid:leaf",
      "bottom",
      "__end__",
    ]);
    // Both open: every node is its own
    expect(collapseSubgraphs(DEEP, subgraphs, subgraphs).nodes.map((n) => n.id)).toEqual([
      "__start__",
      "top",
      "mid:mid_start",
      "mid:leaf:leaf_one",
      "mid:leaf:leaf_two",
      "bottom",
      "__end__",
    ]);
    expect(parentSubgraph("mid:leaf:leaf_one", subgraphs)).toBe("mid:leaf");
    expect(parentSubgraph("mid:mid_start", subgraphs)).toBe("mid");
    expect(parentSubgraph("top", subgraphs)).toBeUndefined();
    expect(shortName("mid:leaf:leaf_one")).toBe("leaf_one");
  });

  it("nested frames enclose one another and each boundary spreads the rows by 25 px", () => {
    const subgraphs = ["mid", "mid:leaf"];
    const g = collapseSubgraphs(DEEP, subgraphs, subgraphs);
    const { nodes, groups } = layoutGraph(g, subgraphs, subgraphs);
    expect(groups.map((f) => f.id)).toEqual(["mid", "mid:leaf"]);
    const [outer, leaf] = groups;
    const leafNodes = nodes.filter((n) => n.id.startsWith("mid:leaf:"));
    // The inner frame hugs its own nodes
    expect(leaf.x).toBe(Math.min(...leafNodes.map((n) => n.x)) - 35);
    expect(leaf.y).toBe(Math.min(...leafNodes.map((n) => n.y)) - 25);
    // and lies inside the outer one, which also holds the node next to it
    expect(outer.x).toBeLessThanOrEqual(leaf.x - 35);
    expect(outer.y).toBeLessThanOrEqual(leaf.y - 25);
    expect(outer.x + outer.width).toBeGreaterThanOrEqual(leaf.x + leaf.width + 35);
    expect(outer.y + outer.height).toBe(leaf.y + leaf.height + 25);
    // Two boundaries between `top` and the deepest node: 82 + 25 + 25 + 82
    const top = nodes.find((n) => n.id === "top")!;
    expect(leafNodes[0].y - top.y).toBe(214);
    // and two more below it, before the node after the subgraph
    const bottom = nodes.find((n) => n.id === "bottom")!;
    expect(bottom.y - leafNodes[1].y).toBe(132);
  });

  it("an expanded subgraph keeps its nodes and gets a frame with 35/25 padding", () => {
    const g = collapseSubgraphs(NESTED, ["worker"], ["worker"]);
    expect(g.nodes).toHaveLength(6);
    const { nodes, groups } = layoutGraph(g, ["worker"]);
    expect(groups).toHaveLength(1);
    const inner = nodes.filter((n) => subgraphOf(n.id) === "worker");
    const frame = groups[0];
    expect(frame.x).toBe(Math.min(...inner.map((n) => n.x)) - 35);
    expect(frame.y).toBe(Math.min(...inner.map((n) => n.y)) - 25);
    expect(inner.map((n) => n.name)).toEqual(["prepare", "finish"]);
    // Rows on both sides of the frame are spread apart: step 107 instead of 82
    const outer = nodes.find((n) => n.id === "outer")!;
    expect(inner[0].y - outer.y).toBe(107);
  });
});
