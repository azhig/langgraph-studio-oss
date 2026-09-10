import { memo, useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { CircleAlert, Settings } from "lucide-react";
import { useRun } from "@/store/run";
import { useStudio } from "@/store/studio";
import { HoverCard } from "@/components/HoverCard";
import { NodeConfigModal } from "@/features/assistants/NodeConfigModal";
import { NodeHoverCard } from "./NodeHoverCard";
import { SubgraphIcon } from "./SubgraphFrame";
import { subgraphOf } from "./layout";
import type { NodePalette } from "./colors";
import { isSystemNode } from "./colors";

export type NodeStatus = "idle" | "active" | "error";

export interface GraphNodeData extends Record<string, unknown> {
  name: string;
  palette: NodePalette;
  /** Есть поля конфигурации, привязанные к узлу (config_schema.langgraph_nodes). */
  configurable: boolean;
  /** Соседи узла: показываются в карточке при наведении. */
  sources: string[];
  targets: string[];
  /** За узлом стоит подграф: его можно раскрыть кликом. */
  subgraph: boolean;
}

export type GraphFlowNode = Node<GraphNodeData, "studio">;

/**
 * Узел графа: размеры заданы раскладкой (width/height на самом узле),
 * оформление выведено из тона (DESIGN-TOKENS.md, «Узлы графа»).
 *
 * Во время прогона эталон гасит всё, кроме работающего узла: обёртка получает
 * `opacity: .1`, а активный — `opacity: 1` и увеличение 1.05 с переходом 300 мс.
 * Состояние прогона узел читает из стора сам, а не получает пропсами: объекты узлов
 * React Flow пересоздавать нельзя, иначе теряются измеренные размеры и хэндлы.
 * Сами хэндлы скрыты — рёбра считают точки входа и выхода геометрией (GraphEdge).
 */
function GraphNodeComponent({ id, data }: NodeProps<GraphFlowNode>) {
  const { name, palette, configurable, sources, targets, subgraph } = data;
  const status = useRun((s) =>
    s.activeNode === id ? "active" : s.errorNode === id ? "error" : "idle",
  ) as NodeStatus;
  // Штриховка помечает узел, на котором стоит прерывание: она держится всё время,
  // пока пауза включена в меню `Interrupts`, а не только когда тред на ней встал.
  // Пауза `before` штрихует верхнюю половину узла, `after` — нижнюю, обе — весь узел.
  const before = useRun((s) => s.interruptBefore.includes(id));
  const after = useRun((s) => s.interruptAfter.includes(id));
  const stripes = before && after ? "inset-0 rounded-md" : before ? "top-0 h-1/2 rounded-t-md" : "bottom-0 h-1/2 rounded-b-md";
  // Пока идёт прогон, светится работающий узел; после срыва — тот, на котором встали.
  // На паузе эталон ничего не гасит: узел из `next` просто покрывается штриховкой.
  // Наведение на запись лога подсвечивает её узел и гасит остальные до 30 %.
  // Подсветка распространяется на весь подграф: запись `worker` в логе поднимает
  // и рамку, и вложенные узлы — так же поступает эталон
  const parent = subgraphOf(id);
  const hovered = useRun((s) => s.hoverNode === id || (parent !== undefined && s.hoverNode === parent));
  const dimmed = useRun((s) => {
    if (s.hoverNode) return s.hoverNode !== id && s.hoverNode !== parent;
    if (s.activeNode) return s.activeNode !== id;
    if (s.errorNode) return s.errorNode !== id;
    return false;
  });
  const dimLevel = useRun((s) => (s.hoverNode ? 0.3 : 0.1));
  const system = isSystemNode(id);
  const [configOpen, setConfigOpen] = useState(false);
  const openAssistants = useStudio((s) => s.setAssistantsOpen);
  const toggleSubgraph = useStudio((s) => s.toggleSubgraph);
  const subgraphOpen = useStudio((s) => s.expandedSubgraphs.includes(id));
  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!opacity-0 !pointer-events-none" />
      {configurable && !system && (
        <button
          type="button"
          aria-label="Edit node configuration" title="Edit node configuration"
          className="absolute -right-1 -top-1 z-10 flex size-3 items-center justify-center rounded-full"
          style={{ background: palette.dotBackground, color: palette.dotForeground }}
          onClick={() => setConfigOpen(true)}
        >
          <Settings size={8} strokeWidth={3} />
        </button>
      )}
      <div
        className="w-full text-center backdrop-blur-sm transition-all duration-300 ease-in-out"
        style={{
          opacity: dimmed ? dimLevel : 1,
          transform: status === "active" || hovered ? "scale(1.05)" : undefined,
        }}
      >
        <HoverCard
          card={
            <NodeHoverCard
              node={id}
              label={name}
              sources={sources}
              targets={targets}
              subgraph={subgraph}
              nested={parent !== undefined}
            />
          }
        >
        <div
          className={`node-body group relative w-full border p-2 text-center text-sm font-medium leading-none ${
            system ? "rounded-full" : "rounded-md"
          } ${subgraph ? "cursor-pointer" : ""}`}
          style={{ color: palette.text, background: palette.background, borderColor: palette.border }}
          onClick={subgraph ? () => toggleSubgraph(id) : undefined}
        >
          <div className="relative z-[2] flex items-center justify-center gap-1.5">
            {subgraph && <SubgraphIcon expanded={subgraphOpen} />}
            <span className="leading-none">{name}</span>
          </div>
          <span
            className={`node-stripes pointer-events-none absolute inset-x-0 z-[1] overflow-hidden transition-opacity ${stripes}`}
            style={{ opacity: before || after ? 1 : 0, color: palette.stripes }}
          />
        </div>
        </HoverCard>
      </div>
      <NodeConfigModal
        node={id}
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        onOpenAssistants={() => openAssistants(true)}
      />
      {status === "error" && (
        <div className="absolute left-full top-1/2 ml-2 -translate-y-1/2">
          <div className="flex flex-row items-center gap-0.5 rounded-md border border-border-error bg-bg-error-secondary px-2 py-1 text-text-error-secondary">
            <CircleAlert size={10} strokeWidth={1.8} />
            <span className="text-[8px] font-medium leading-none">Error</span>
          </div>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!opacity-0 !pointer-events-none" />
    </div>
  );
}

export const GraphNode = memo(GraphNodeComponent);
