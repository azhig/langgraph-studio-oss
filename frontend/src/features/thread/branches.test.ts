import { describe, expect, it } from "vitest";
import type { ThreadState } from "@langchain/langgraph-sdk";
import { branchPathOf, branchesByCheckpoint, type TreeSequence } from "./branches";

const state = (id: string) =>
  ({ checkpoint: { checkpoint_id: id } }) as unknown as ThreadState<Record<string, unknown>>;
const node = (id: string, path: string[]) => ({ type: "node" as const, value: state(id), path });

/** Thread `c1 → c2`, two branches from `c2`: `c3` and `c4 → c5`. */
const TREE: TreeSequence = {
  type: "sequence",
  items: [
    node("c1", []),
    node("c2", []),
    {
      type: "fork",
      items: [
        { type: "sequence", items: [node("c3", ["c3"])] },
        { type: "sequence", items: [node("c4", ["c4"]), node("c5", ["c4"])] },
      ],
    },
  ],
};

describe("branchesByCheckpoint", () => {
  it("gives a switcher only at the first checkpoint of each branch", () => {
    const branches = branchesByCheckpoint(TREE);
    expect(Object.keys(branches).sort()).toEqual(["c3", "c4"]);
    expect(branches.c3).toEqual({ branch: "c3", options: ["c3", "c4"], index: 1 });
    expect(branches.c4).toEqual({ branch: "c4", options: ["c3", "c4"], index: 2 });
  });

  it("no tree — empty", () => {
    expect(branchesByCheckpoint(undefined)).toEqual({});
  });
});

describe("branchPathOf", () => {
  it("finds the branch path by any of its checkpoints", () => {
    expect(branchPathOf(TREE, "c5")).toBe("c4");
    expect(branchPathOf(TREE, "c1")).toBe("");
    expect(branchPathOf(TREE, "nope")).toBeUndefined();
  });
});
