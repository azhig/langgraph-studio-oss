import type { ThreadState } from "@langchain/langgraph-sdk";

/**
 * Thread branches.
 *
 * `useStream` returns a tree of checkpoints: sequences of nodes and forks
 * (`fork`) where several continuations grew from one checkpoint. A branch is addressed
 * by a path of checkpoint ids joined with `>`; the same path is accepted by
 * `setBranch`. Here the tree is parsed into a table "checkpoint → its branch
 * and siblings" so the log can show `‹ Fork 2 of 2 ›`.
 */

const SEP = ">";
const ROOT = "$";

export interface BranchInfo {
  /** Path of the current branch — the value for `setBranch`. */
  branch: string;
  /** All branches of this fork, oldest to newest. */
  options: string[];
  /** One-based index of the current branch. */
  index: number;
}

interface TreeNode {
  type: "node";
  value: ThreadState<Record<string, unknown>>;
  path: string[];
}

interface TreeFork {
  type: "fork";
  items: TreeSequence[];
}

export interface TreeSequence {
  type: "sequence";
  items: Array<TreeNode | TreeFork>;
}

export function branchesByCheckpoint(tree?: TreeSequence): Record<string, BranchInfo> {
  if (!tree) return {};
  const nodes: TreeNode[] = [];
  collect(tree, nodes);

  // Branch paths are grouped by fork — the second-to-last element of the path
  const byFork = new Map<string, string[][]>();
  const seen = new Set<string>();
  for (const node of nodes) {
    if (!node.path.length) continue;
    const key = node.path.join(SEP);
    if (seen.has(key)) continue;
    seen.add(key);
    const fork = node.path.at(-2) ?? ROOT;
    byFork.set(fork, [...(byFork.get(fork) ?? []), node.path]);
  }
  // Checkpoint ids grow over time, so sorting yields the order branches appeared
  for (const paths of byFork.values()) {
    paths.sort((a, b) => (a.at(-1) ?? "").localeCompare(b.at(-1) ?? ""));
  }

  const out: Record<string, BranchInfo> = {};
  for (const node of nodes) {
    const checkpointId = node.value.checkpoint?.checkpoint_id;
    if (!checkpointId || !node.path.length) continue;
    // The switcher is needed only where a branch starts: the path ends with
    // the id of this very checkpoint. Otherwise it would repeat on every step of the branch.
    if (checkpointId !== node.path.at(-1)) continue;
    const options = (byFork.get(node.path.at(-2) ?? ROOT) ?? []).map((p) => p.join(SEP));
    const branch = node.path.join(SEP);
    if (options.length < 2) continue;
    out[checkpointId] = { branch, options, index: options.indexOf(branch) + 1 };
  }
  return out;
}

function collect(sequence: TreeSequence, out: TreeNode[]) {
  for (const item of sequence.items) {
    if (item.type === "node") out.push(item);
    else for (const inner of item.items) collect(inner, out);
  }
}

/** Path of the branch containing the given checkpoint (the value for `setBranch`). */
export function branchPathOf(tree: TreeSequence | undefined, checkpointId: string): string | undefined {
  if (!tree) return undefined;
  const nodes: TreeNode[] = [];
  collect(tree, nodes);
  const node = nodes.find((n) => n.value.checkpoint?.checkpoint_id === checkpointId);
  return node?.path.join(SEP);
}
