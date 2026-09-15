import { describe, expect, it } from "vitest";
import { createStore } from "zustand/vanilla";
import { createLogSlice, detailFromStorage, taskNodeId, type LogSlice } from "./logSlice";

describe("detailFromStorage", () => {
  it("no key — level 1, as in the reference", () => {
    expect(detailFromStorage(null)).toBe(1);
  });

  it("accepts only 0…3, anything else falls back to the default", () => {
    expect(detailFromStorage("0")).toBe(0);
    expect(detailFromStorage("3")).toBe(3);
    expect(detailFromStorage("7")).toBe(1);
    expect(detailFromStorage("abc")).toBe(1);
  });
});

describe("setDetail", () => {
  const store = () => createStore<LogSlice>((set, get, api) => createLogSlice(set, get, api));

  it("levels 0-2 re-apply their defaults to the records, the top level leaves them alone", () => {
    const s = store();
    const epoch = () => s.getState().recordsEpoch;
    const start = epoch();
    // The reference forgets a record collapsed by hand as soon as the level says what to show
    s.getState().setDetail(2);
    expect(epoch()).toBe(start + 1);
    s.getState().setDetail(1);
    expect(epoch()).toBe(start + 2);
    // The top level only expands values: what the user did to the records survives
    s.getState().setDetail(3);
    expect(epoch()).toBe(start + 2);
    s.getState().setDetail(2);
    expect(epoch()).toBe(start + 3);
    expect(s.getState().detail).toBe(2);
  });
});

describe("addTask", () => {
  const store = () => createStore<LogSlice>((set, get, api) => createLogSlice(set, get, api));
  const names = (s: ReturnType<ReturnType<typeof store>["getState"]>) =>
    s.entries.filter((e) => e.kind === "node").map((e) => e.node);

  it("the stream namespace becomes the canvas id of the running node", () => {
    expect(taskNodeId("bottom")).toBe("bottom");
    expect(taskNodeId("mid_start", ["mid:d3f0"])).toBe("mid:mid_start");
    expect(taskNodeId("leaf_one", ["mid:d3f0", "leaf:a71c"])).toBe("mid:leaf:leaf_one");
  });

  it("a task inside a subgraph moves the highlight but adds no record of its own", () => {
    const s = store();
    // The subgraph node itself is a task of the graph: it gets a record
    s.getState().addTask({ id: "t1", name: "mid", input: {} });
    expect(names(s.getState())).toEqual(["mid"]);
    expect(s.getState().activeNode).toBe("mid");
    // Its insides only light up the canvas — the reference keeps the log flat during a run
    s.getState().addTask({ id: "t2", name: "mid_start", input: {} }, [], ["mid:d3f0"]);
    expect(names(s.getState())).toEqual(["mid"]);
    expect(s.getState().activeNode).toBe("mid:mid_start");
    s.getState().addTask({ id: "t3", name: "leaf_one", input: {} }, [], ["mid:d3f0", "leaf:a71c"]);
    expect(s.getState().activeNode).toBe("mid:leaf:leaf_one");
    // Finishing a nested task drops the highlight, the record of the subgraph node stays open
    s.getState().addTask({ id: "t3", name: "leaf_one", result: { n: 100 } }, [], ["mid:d3f0", "leaf:a71c"]);
    expect(s.getState().activeNode).toBeUndefined();
    expect(s.getState().entries.filter((e) => e.kind === "node" && e.done)).toHaveLength(0);
    // And when the subgraph node finishes, its record closes with the result
    s.getState().addTask({ id: "t1", name: "mid", result: { n: 200 } });
    expect(s.getState().entries.filter((e) => e.kind === "node" && e.done)).toHaveLength(1);
  });
});

describe("addCheckpoint", () => {
  const store = () => createStore<LogSlice>((set, get, api) => createLogSlice(set, get, api));

  it("checkpoints of a subgraph add no rows and open no turn", () => {
    const s = store();
    s.getState().setPendingStart({ messages: [] });
    s.getState().addCheckpoint({ checkpointId: "c1", source: "input" });
    // The subgraph starts with an `input` checkpoint of its own, then loops
    s.getState().addCheckpoint({ checkpointId: "s1", source: "input" }, ["mid:d3f0"]);
    s.getState().addCheckpoint({ checkpointId: "s2", source: "loop" }, ["mid:d3f0"]);
    s.getState().addCheckpoint({ checkpointId: "c2", source: "loop" });
    const checkpoints = s.getState().entries.filter((e) => e.kind === "checkpoint");
    expect(checkpoints.map((c) => c.checkpointId)).toEqual(["c1", "c2"]);
    expect(checkpoints.filter((c) => c.turnStart).map((c) => c.checkpointId)).toEqual(["c1"]);
    // The `__start__` record appeared once, after the run's own first checkpoint
    expect(s.getState().entries.filter((e) => e.kind === "node")).toHaveLength(1);
  });
});
