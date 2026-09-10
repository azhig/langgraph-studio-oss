import type { ThreadState } from "@langchain/langgraph-sdk";

/**
 * Ветки треда.
 *
 * `useStream` отдаёт дерево контрольных точек: последовательности узлов и развилки
 * (`fork`) там, где от одной точки пошло несколько продолжений. Ветка адресуется
 * путём из идентификаторов точек, склеенным через `>`; этот же путь принимает
 * `setBranch`. Здесь дерево разбирается в таблицу «контрольная точка → её ветка
 * и соседние», чтобы в логе показать `‹ Fork 2 of 2 ›`.
 */

const SEP = ">";
const ROOT = "$";

export interface BranchInfo {
  /** Путь текущей ветки — значение для `setBranch`. */
  branch: string;
  /** Все ветки этой развилки, от старой к новой. */
  options: string[];
  /** Порядковый номер текущей ветки, начиная с единицы. */
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

  // Пути ветвлений группируются по развилке — предпоследний элемент пути
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
  // Идентификаторы точек растут со временем, поэтому сортировка даёт порядок появления веток
  for (const paths of byFork.values()) {
    paths.sort((a, b) => (a.at(-1) ?? "").localeCompare(b.at(-1) ?? ""));
  }

  const out: Record<string, BranchInfo> = {};
  for (const node of nodes) {
    const checkpointId = node.value.checkpoint?.checkpoint_id;
    if (!checkpointId || !node.path.length) continue;
    // Переключатель нужен только там, где ветка начинается: путь оканчивается
    // идентификатором этой самой точки. Иначе он повторялся бы на каждом шаге ветки.
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

/** Путь ветки, в которой лежит указанная контрольная точка (значение для `setBranch`). */
export function branchPathOf(tree: TreeSequence | undefined, checkpointId: string): string | undefined {
  if (!tree) return undefined;
  const nodes: TreeNode[] = [];
  collect(tree, nodes);
  const node = nodes.find((n) => n.value.checkpoint?.checkpoint_id === checkpointId);
  return node?.path.join(SEP);
}
