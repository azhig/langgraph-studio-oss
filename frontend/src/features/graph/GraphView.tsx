import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import type { AssistantGraph, GraphSchema } from "@langchain/langgraph-sdk";
import { useStudio } from "@/store/studio";
import { collapseSubgraphs, layoutGraph, subgraphOf } from "./layout";
import { nodePalette } from "./colors";
import { GraphNode, type GraphFlowNode } from "./GraphNode";
import { GraphEdge, type GraphFlowEdge } from "./GraphEdge";
import { SubgraphFrame, type SubgraphFlowNode } from "./SubgraphFrame";
import { ZoomControls } from "./ZoomControls";

const nodeTypes: NodeTypes = { studio: GraphNode, subgraph: SubgraphFrame };
const edgeTypes: EdgeTypes = { studio: GraphEdge };

/** Узлы, у которых есть привязанные поля конфигурации (config_schema → langgraph_nodes). */
function configurableNodes(schemas?: GraphSchema): Set<string> {
  const out = new Set<string>();
  const schema = (schemas?.config_schema ?? schemas?.context_schema) as
    | { properties?: Record<string, { langgraph_nodes?: string[] }> }
    | undefined;
  for (const p of Object.values(schema?.properties ?? {})) {
    for (const n of p?.langgraph_nodes ?? []) out.add(n);
  }
  return out;
}

interface Props {
  graph: AssistantGraph;
  schemas?: GraphSchema;
  /** Узлы, за которыми стоит подграф, и те из них, что сейчас раскрыты. */
  subgraphs: string[];
  expanded: string[];
}

/**
 * Узлы и рёбра холста. Состояния прогона здесь намеренно нет: подсветку узлы и рёбра
 * берут из стора сами. Иначе на каждое событие потока пришлось бы пересоздавать
 * объекты узлов, а React Flow привязывает к ним измеренные размеры и положение
 * хэндлов — при пересоздании они теряются, и рёбра пропадают с холста.
 */
function buildFlow(
  graph: AssistantGraph,
  theme: "dark" | "light",
  configurable: Set<string>,
  subgraphs: string[],
  expanded: string[],
): { nodes: (GraphFlowNode | SubgraphFlowNode)[]; edges: GraphFlowEdge[] } {
  const visible = collapseSubgraphs(graph, subgraphs, expanded);
  const layout = layoutGraph(visible, expanded);
  // Эталон держит рамку раскрытого подграфа там же, где стоял свёрнутый узел,
  // поэтому группу сдвигаем на разницу с полностью свёрнутой раскладкой
  if (layout.groups.length) {
    const collapsed = layoutGraph(collapseSubgraphs(graph, subgraphs, []));
    for (const g of layout.groups) {
      const was = collapsed.nodes.find((n) => n.id === g.id);
      if (!was) continue;
      const dx = was.x - g.x;
      if (!dx) continue;
      g.x += dx;
      for (const n of layout.nodes) if (subgraphOf(n.id) === g.id) n.x += dx;
    }
  }
  // Соседи для карточки узла: имена показываются короткими, как и подписи
  const neighbours = new Map<string, { sources: string[]; targets: string[] }>();
  const side = (id: string) => {
    const cur = neighbours.get(id) ?? { sources: [], targets: [] };
    neighbours.set(id, cur);
    return cur;
  };
  for (const e of visible.edges) {
    if (!side(e.target).sources.includes(e.source)) side(e.target).sources.push(e.source);
    if (!side(e.source).targets.includes(e.target)) side(e.source).targets.push(e.target);
  }

  // Рамки раскрытых подграфов идут первыми: React Flow требует родителя до детей
  const frames: SubgraphFlowNode[] = layout.groups.map((g) => ({
    id: g.id,
    type: "subgraph",
    position: { x: g.x, y: g.y },
    width: g.width,
    height: g.height,
    connectable: false,
    // Рамка лежит под узлами, но должна принимать клики: React Flow даёт
    // `pointer-events` только тем узлам, что выделяются или перетаскиваются.
    // Перетаскивается она целиком — вместе с вложенными узлами, а выделение
    // выключено: у эталона рамка никогда не всплывает над узлами.
    selectable: false,
    draggable: true,
    // Как в эталоне: рамка лежит на нулевом слое — под вложенными узлами, но не
    // под холстом. Отрицательный z-index утопил бы её под слой `pane`,
    // и тогда ни клики по рамке, ни перетаскивание холста не работали бы вместе.
    zIndex: 0,
    data: { name: g.name, palette: nodePalette(g.id, theme) },
  }));
  const frameById = new Map(layout.groups.map((g) => [g.id, g]));

  const nodes: (GraphFlowNode | SubgraphFlowNode)[] = [
    ...frames,
    ...layout.nodes.map((n) => {
      // Узел внутри раскрытого подграфа привязан к его рамке: двигается вместе с ней
      // и не может выйти за её пределы (`extent: "parent"`), как в эталоне.
      const frame = frameById.get(subgraphOf(n.id) ?? "");
      return {
      id: n.id,
      type: "studio" as const,
      position: frame ? { x: n.x - frame.x, y: n.y - frame.y } : { x: n.x, y: n.y },
      parentId: frame?.id,
      extent: frame ? ("parent" as const) : undefined,
      width: n.width,
      height: n.height,
      connectable: false,
      selectable: false,
      data: {
        name: n.name,
        palette: nodePalette(n.name, theme),
        configurable: configurable.has(n.id),
        sources: (neighbours.get(n.id)?.sources ?? []).map(shortLabel),
        targets: (neighbours.get(n.id)?.targets ?? []).map(shortLabel),
        subgraph: subgraphs.includes(n.id),
      },
      };
    }),
  ];
  const edges: GraphFlowEdge[] = layout.edges.map((e) => {
    const p = nodePalette(shortLabel(e.source), theme);
    return {
      id: e.id,
      type: "studio",
      source: e.source,
      target: e.target,
      selectable: false,
      data: {
        conditional: e.conditional,
        label: e.label,
        paired: e.paired,
        stroke: p.edge,
        arrow: p.arrow,
      },
    };
  });
  return { nodes, edges };
}

/**
 * Ручные позиции узлов живут между сеансами: эталон хранит их в localStorage
 * по ключу ассистента и помечает закреплёнными (`isFixed`).
 */
type SavedPosition = { x: number; y: number; isFixed: boolean };

const positionsKey = (assistantId?: string) => `ls:studio:${assistantId ?? "unknown"}:nodePosition`;

function readSavedPositions(key: string): Map<string, { x: number; y: number }> {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, SavedPosition>;
    return new Map(Object.entries(raw).map(([id, p]) => [id, { x: p.x, y: p.y }]));
  } catch {
    return new Map();
  }
}

function writeSavedPosition(key: string, id: string, position: { x: number; y: number }) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, SavedPosition>;
    raw[id] = { ...position, isFixed: true };
    localStorage.setItem(key, JSON.stringify(raw));
  } catch {
    /* приватный режим — позиции просто не переживут перезагрузку */
  }
}

function clearSavedPositions(key: string) {
  try {
    localStorage.setItem(key, "{}");
  } catch {
    /* см. выше */
  }
}

/** Подпись узла подграфа: `worker:prepare` показывается как `prepare`. */
const shortLabel = (id: string) => (subgraphOf(id) ? id.slice(id.indexOf(":") + 1) : id);

function Canvas({ graph, schemas, subgraphs, expanded }: Props) {
  const theme = useStudio((s) => s.theme);
  const configurable = useMemo(() => configurableNodes(schemas), [schemas]);
  const flow = useMemo(
    () => buildFlow(graph, theme, configurable, subgraphs, expanded),
    [graph, theme, configurable, subgraphs, expanded],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(flow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flow.edges);
  const { fitView } = useReactFlow();
  const flowRef = useRef(flow);
  flowRef.current = flow;
  /**
   * Узлы, которые пользователь передвинул сам. Их положение переживает перестроение
   * холста — смену темы, раскрытие подграфа и перерисовку по ходу прогона;
   * остальные каждый раз встают по автораскладке. Сбрасывается кнопкой
   * `Reset layout to default`.
   */
  const assistantId = useStudio((s) => s.assistantId);
  const storageKey = positionsKey(assistantId);
  const moved = useRef(readSavedPositions(storageKey));
  // Сменился ассистент — читаем его собственные закреплённые позиции
  useEffect(() => {
    moved.current = readSavedPositions(storageKey);
  }, [storageKey]);

  // Перерисовка возвращает узлы на места автораскладки, кроме тех, что двигал
  // пользователь: их положение хранится отдельно и переживает раскрытие подграфов.
  useEffect(() => {
    setNodes(flow.nodes.map((n) => ({ ...n, position: moved.current.get(n.id) ?? n.position })));
    setEdges(flow.edges);
  }, [flow, setNodes, setEdges]);

  // Граф вписывается один раз — при открытии и смене ассистента. Раскрытие
  // подграфа вьюпорт не трогает: эталон ведёт себя так же.
  useEffect(() => {
    const t = window.setTimeout(() => void fitView({ maxZoom: 1, padding: 0.1, duration: 0 }), 30);
    return () => window.clearTimeout(t);
  }, [graph, fitView]);

  /** Запоминаем ручное положение узла: и на время сеанса, и между сеансами. */
  const rememberPosition = useCallback(
    (_: unknown, node: { id: string; position: { x: number; y: number } }) => {
      moved.current.set(node.id, { ...node.position });
      writeSavedPosition(storageKey, node.id, node.position);
    },
    [storageKey],
  );

  /** Кнопка «Reset layout to default»: автораскладка и свёрнутые подграфы. */
  const collapseAll = useStudio((s) => s.collapseSubgraphs);
  const resetLayout = useCallback(() => {
    moved.current.clear();
    clearSavedPositions(storageKey);
    collapseAll();
    setNodes(flowRef.current.nodes);
    window.setTimeout(() => void fitView({ maxZoom: 1, padding: 0.1, duration: 200 }), 0);
  }, [setNodes, fitView, collapseAll, storageKey]);

  return (
    <>
      <div className="absolute inset-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={rememberPosition}
          fitViewOptions={{ maxZoom: 1, padding: 0.1 }}
          minZoom={0.1}
          maxZoom={2}
          nodesConnectable={false}
          // Как в эталоне: колесо масштабирует, фон холста тянется мышью
          // (`.react-flow__pane` с курсором-рукой), двойной клик ничего не делает
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
          className="studio-flow"
        />
      </div>
      <Overlay onResetLayout={resetLayout} />
    </>
  );
}

/**
 * Панель зума и минимапа живёт вне холста: `.react-flow` обрезает содержимое,
 * а в эталоне панель выступает вверх, в ряд с кнопками Memory / Interrupts.
 */
function Overlay({ onResetLayout }: { onResetLayout: () => void }) {
  return (
    <div className="absolute -top-[54px] left-4 z-10 flex h-fit items-start gap-4">
      <ZoomControls onResetLayout={onResetLayout} />
      <div className="relative" style={{ width: 78, height: 52 }}>
        <MiniMap
          position="top-left"
          pannable
          zoomable={false}
          className="!absolute !left-0 !top-0 !m-0 !bg-[var(--minimap-bg)]"
          style={{ width: 78, height: 52 }}
          maskColor="var(--minimap-mask)"
          nodeBorderRadius={12}
          nodeStrokeWidth={0}
          nodeColor={(n) => (n as GraphFlowNode).data?.palette.minimap ?? "#666"}
        />
      </div>
    </div>
  );
}

export function GraphView(props: Props) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
