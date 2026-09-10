import { memo } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { useStudio } from "@/store/studio";
import { useRun } from "@/store/run";
import { HoverCard } from "@/components/HoverCard";
import { NodeHoverCard } from "./NodeHoverCard";
import type { NodePalette } from "./colors";

export interface SubgraphFrameData extends Record<string, unknown> {
  name: string;
  palette: NodePalette;
}

export type SubgraphFlowNode = Node<SubgraphFrameData, "subgraph">;

/**
 * Рамка раскрытого подграфа. Снято с эталона: прямоугольник в тоне узла
 * (заливка 10 %, рамка — тон), радиус 8, поднят на 24 px вверх, чтобы
 * вместить заголовок с именем; лежит под узлами (`z-index: -1`).
 * Клик по рамке сворачивает подграф — так же, как клик по свёрнутому узлу.
 */
function SubgraphFrameComponent({ id, data }: NodeProps<SubgraphFlowNode>) {
  const { name, palette } = data;
  const toggleSubgraph = useStudio((s) => s.toggleSubgraph);
  const dimmed = useRun((s) => {
    if (s.hoverNode) return s.hoverNode !== id;
    return Boolean(s.activeNode) || Boolean(s.errorNode);
  });

  return (
    <HoverCard
      className="absolute inset-0 -top-6"
      card={<NodeHoverCard node={id} sources={[]} targets={[]} subgraph />}
    >
      <div
        className="group flex h-full w-full cursor-pointer flex-col place-items-center rounded-lg border transition-opacity"
        style={{
          color: palette.text,
          backgroundColor: palette.background,
          borderColor: palette.border,
          opacity: dimmed ? 0.3 : 1,
        }}
        onClick={() => toggleSubgraph(id)}
      >
        <div className="mt-2 flex items-center justify-center gap-1.5">
          <SubgraphIcon expanded />
          <div className="text-xs font-medium">{name}</div>
        </div>
        <span
          className="node-stripes pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-1/2 overflow-hidden rounded-b-lg opacity-0 transition-opacity"
          style={{ color: palette.stripes }}
        />
      </div>
    </HoverCard>
  );
}

/** Значок подграфа: две скобы. Отдельно от кнопок — им нужен свой размер. */
export function SubgraphGlyph({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M14 10c.932 0 1.398 0 1.765-.152a2 2 0 0 0 1.083-1.083C17 8.398 17 7.932 17 7s0-1.398-.152-1.765a2 2 0 0 0-1.083-1.083C15.398 4 14.932 4 14 4H6c-.932 0-1.398 0-1.765.152a2 2 0 0 0-1.083 1.083C3 5.602 3 6.068 3 7s0 1.398.152 1.765a2 2 0 0 0 1.083 1.083C4.602 10 5.068 10 6 10zM18 20c.932 0 1.398 0 1.765-.152a2 2 0 0 0 1.083-1.083C21 18.398 21 17.932 21 17s0-1.398-.152-1.765a2 2 0 0 0-1.083-1.083C19.398 14 18.932 14 18 14h-8c-.932 0-1.398 0-1.765.152a2 2 0 0 0-1.083 1.083C7 15.602 7 16.068 7 17s0 1.398.152 1.765a2 2 0 0 0 1.083 1.083C8.602 20 9.068 20 10 20z"
      />
    </svg>
  );
}

/** Значок «развернуть»: стрелки в разные стороны. */
export function ExpandGlyph({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" fill="currentColor" className={className}>
      <path d="M216,48V96a8,8,0,0,1-16,0V67.31l-50.34,50.35a8,8,0,0,1-11.32-11.32L188.69,56H160a8,8,0,0,1,0-16h48A8,8,0,0,1,216,48ZM106.34,138.34,56,188.69V160a8,8,0,0,0-16,0v48a8,8,0,0,0,8,8H96a8,8,0,0,0,0-16H67.31l50.35-50.34a8,8,0,0,0-11.32-11.32Z" />
    </svg>
  );
}

/** Значок «свернуть»: стрелки внутрь. */
export function CollapseGlyph({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" fill="currentColor" className={className}>
      <path d="M213.66,53.66,163.31,104H192a8,8,0,0,1,0,16H144a8,8,0,0,1-8-8V64a8,8,0,0,1,16,0V92.69l50.34-50.35a8,8,0,1,1,11.32,11.32ZM112,136H64a8,8,0,0,0,0,16H92.69L42.34,202.34a8,8,0,0,0,11.32,11.32L104,163.31V192a8,8,0,0,0,16,0V144A8,8,0,0,0,112,136Z" />
    </svg>
  );
}

/**
 * Значок подграфа на узле: скобы, а при наведении — стрелки. У свёрнутого узла
 * это «развернуть», у раскрытой рамки — «свернуть».
 */
export function SubgraphIcon({ expanded = false }: { expanded?: boolean }) {
  return (
    <span className="pointer-events-auto relative size-4">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="absolute inset-0 size-4 opacity-100 transition-opacity group-hover:opacity-0"
      >
        <path
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M14 10c.932 0 1.398 0 1.765-.152a2 2 0 0 0 1.083-1.083C17 8.398 17 7.932 17 7s0-1.398-.152-1.765a2 2 0 0 0-1.083-1.083C15.398 4 14.932 4 14 4H6c-.932 0-1.398 0-1.765.152a2 2 0 0 0-1.083 1.083C3 5.602 3 6.068 3 7s0 1.398.152 1.765a2 2 0 0 0 1.083 1.083C4.602 10 5.068 10 6 10zM18 20c.932 0 1.398 0 1.765-.152a2 2 0 0 0 1.083-1.083C21 18.398 21 17.932 21 17s0-1.398-.152-1.765a2 2 0 0 0-1.083-1.083C19.398 14 18.932 14 18 14h-8c-.932 0-1.398 0-1.765.152a2 2 0 0 0-1.083 1.083C7 15.602 7 16.068 7 17s0 1.398.152 1.765a2 2 0 0 0 1.083 1.083C8.602 20 9.068 20 10 20z"
        />
      </svg>
      {expanded ? (
        <CollapseGlyph className="absolute inset-0 size-4 opacity-0 transition-opacity group-hover:opacity-100" />
      ) : (
        <ExpandGlyph className="absolute inset-0 size-4 opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </span>
  );
}

export const SubgraphFrame = memo(SubgraphFrameComponent);
