export interface NamespaceTree {
  /** Namespace segment. */
  name: string;
  /** Full path to this segment. */
  path: string[];
  children: NamespaceTree[];
}

/** Namespaces arrive as a list of paths — build a tree from them, like the reference. */
export function buildNamespaceTree(namespaces: string[][]): NamespaceTree[] {
  const roots: NamespaceTree[] = [];
  for (const path of namespaces) {
    let level = roots;
    path.forEach((name, i) => {
      let node = level.find((n) => n.name === name);
      if (!node) {
        node = { name, path: path.slice(0, i + 1), children: [] };
        level.push(node);
      }
      level = node.children;
    });
  }
  return roots;
}

/** Path input separated by `/`; an empty field means the root. */
export const parseNamespace = (text: string): string[] =>
  text
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
