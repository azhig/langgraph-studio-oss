import dagre from "@dagrejs/dagre";
import type { AssistantGraph } from "@langchain/langgraph-sdk";

/** Геометрия узла, общая для раскладки и отрисовки: они обязаны совпадать. */
export const NODE_HEIGHT = 32;
/** Ширина узла зависит от длины имени: измерено на Studio, 64 px + 7 px на символ. */
export const nodeWidth = (name: string) => 64 + 7 * name.length;

/**
 * Параметры раскладки. Сверху вниз, интервалы 50 px — при них координаты узлов
 * совпадают с эталоном с точностью до четверти пикселя на обоих проверенных графах.
 *
 * Версия dagre важна: результат проверен на @dagrejs/dagre 1.1.x (в 2.x и 3.x
 * изменился алгоритм упорядочивания, и картинка расходится с эталоном).
 *
 * Циклы (`agent ⇄ tools`) отдельно не обрабатываем: первый шаг алгоритма Сугиямы
 * внутри dagre сам находит обратные рёбра обходом в глубину и временно их разворачивает.
 * Ручной разворот перед dagre меняет порядок рёбер и уводит раскладку от эталона.
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
  /** Есть ли встречное ребро target/source: такие пары рисуются дугами в разные стороны. */
  paired: boolean;
}

/**
 * Рамка вокруг раскрытого подграфа. Отступы измерены на эталоне: 35 px по бокам
 * и 25 px сверху и снизу от крайних вложенных узлов.
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
  /** Рамки раскрытых подграфов; вложенные узлы лежат в `nodes` как обычные. */
  groups: LaidOutGroup[];
}

/** Узел принадлежит подграфу: сервер называет его вложенные узлы `<подграф>:<узел>`. */
export const subgraphOf = (id: string): string | undefined =>
  id.includes(":") ? id.slice(0, id.indexOf(":")) : undefined;

/** Короткое имя вложенного узла: эталон подписывает их без префикса подграфа. */
export const shortName = (id: string): string => (id.includes(":") ? id.slice(id.indexOf(":") + 1) : id);

/**
 * Схлопывает подграфы, которые не раскрыты: их вложенные узлы заменяются одним
 * узлом-подграфом, а рёбра переносятся на него. Эталон получает от сервера
 * развёрнутый граф (`xray`) и показывает ровно такую свёртку.
 */
export function collapseSubgraphs(
  graph: AssistantGraph,
  subgraphs: string[],
  expanded: string[],
): AssistantGraph {
  const collapse = new Set(subgraphs.filter((s) => !expanded.includes(s)));
  const map = (id: string) => {
    const parent = subgraphOf(id);
    return parent && collapse.has(parent) ? parent : id;
  };
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
    // Внутренние рёбра схлопнутого подграфа превращаются в петли — их не рисуем
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

export function layoutGraph(graph: AssistantGraph, expanded: string[] = []): Layout {
  const ids = graph.nodes.map((n) => String(n.id));
  const names = new Map(graph.nodes.map((n) => [String(n.id), nodeName(n)]));

  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ ...LAYOUT });
  g.setDefaultEdgeLabel(() => ({}));
  for (const id of ids) {
    // Ширина считается по видимой подписи: у вложенного узла это имя без префикса подграфа
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
  // Сдвигаем в начало координат; четверть пикселя — та же точность, что у эталона (82.75)
  const q = (v: number) => Math.round(v * 4) / 4;
  const nodes = raw.map((n) => ({ ...n, name: shortName(n.name), x: q(n.x - minX), y: q(n.y - minY) }));
  const groups = frameSubgraphs(nodes, expanded);
  // Рамка подграфа выступает левее вложенных узлов: сдвигаем всё, чтобы холст
  // по-прежнему начинался с нуля — так же поступает эталон
  const shift = -Math.min(0, ...groups.map((g) => g.x));
  if (shift > 0) {
    for (const n of nodes) n.x += shift;
    for (const g of groups) g.x += shift;
  }

  const key = (s: string, t: string) => `${s} ${t}`;
  const present = new Set(graph.edges.map((e) => key(e.source, e.target)));
  // Эталон зовёт ребро `source-target`; порядковый номер появляется только у повторов
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
 * Раздвигает раскладку вокруг раскрытых подграфов и возвращает их рамки.
 *
 * Сначала dagre считает всё как обычный граф, потом ряды раздвигаются: вложенные
 * узлы и всё, что ниже них, опускаются на отступ рамки сверху, а то, что ниже
 * подграфа, — ещё на отступ снизу. Так шаг между рядами на границе рамки
 * становится 107 px вместо 82 px — ровно как у эталона.
 */
function frameSubgraphs(nodes: LaidOutNode[], expanded: string[]): LaidOutGroup[] {
  const groups: LaidOutGroup[] = [];
  const inner = (id: string) => nodes.filter((n) => subgraphOf(n.id) === id);
  const order = expanded
    .filter((id) => inner(id).length > 0)
    .sort((a, b) => Math.min(...inner(a).map((n) => n.y)) - Math.min(...inner(b).map((n) => n.y)));

  for (const id of order) {
    // Зазор сверху: опускаем сам подграф и всё, что ниже него
    const above = Math.min(...inner(id).map((n) => n.y));
    for (const n of nodes) if (n.y >= above) n.y += SUBGRAPH_PAD_Y;

    const top = Math.min(...inner(id).map((n) => n.y));
    const bottom = Math.max(...inner(id).map((n) => n.y + n.height));
    // Зазор снизу: опускаем только то, что лежит ниже подграфа
    for (const n of nodes) if (n.y >= bottom) n.y += SUBGRAPH_PAD_Y;

    const left = Math.min(...inner(id).map((n) => n.x));
    const right = Math.max(...inner(id).map((n) => n.x + n.width));
    groups.push({
      id,
      name: id,
      x: left - SUBGRAPH_PAD_X,
      y: top - SUBGRAPH_PAD_Y,
      width: right - left + 2 * SUBGRAPH_PAD_X,
      height: bottom - top + 2 * SUBGRAPH_PAD_Y,
    });
  }
  return groups;
}
