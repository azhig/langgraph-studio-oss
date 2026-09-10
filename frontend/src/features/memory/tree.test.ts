import { describe, expect, it } from "vitest";
import { buildNamespaceTree, parseNamespace } from "./tree";

describe("buildNamespaceTree", () => {
  it("builds a tree from paths, preserving order of appearance", () => {
    const tree = buildNamespaceTree([["users", "alice"], ["users", "bob"], ["settings"], ["users"]]);
    expect(tree.map((n) => n.name)).toEqual(["users", "settings"]);
    expect(tree[0].children.map((n) => n.path)).toEqual([
      ["users", "alice"],
      ["users", "bob"],
    ]);
    expect(tree[1].children).toEqual([]);
  });

  it("empty list yields an empty tree", () => {
    expect(buildNamespaceTree([])).toEqual([]);
  });
});

describe("parseNamespace", () => {
  it("splits the path by `/`, empty field means root", () => {
    expect(parseNamespace("a/b / c")).toEqual(["a", "b", "c"]);
    expect(parseNamespace("")).toEqual([]);
    expect(parseNamespace(" / ")).toEqual([]);
  });
});
