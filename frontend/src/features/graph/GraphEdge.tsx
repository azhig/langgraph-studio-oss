import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Position,
  useInternalNode,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import { useRun } from "@/store/run";

export interface GraphEdgeData extends Record<string, unknown> {
  conditional: boolean;
  label?: string;
  /** Есть встречное ребро: пара рисуется двумя дугами, выгнутыми в разные стороны. */
  paired: boolean;
  /** Цвет линии (тон узла-источника, alpha 0.8) и стрелки (тот же тон, непрозрачный). */
  stroke: string;
  arrow: string;
}

export type GraphFlowEdge = Edge<GraphEdgeData, "studio">;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Точки входа/выхода ребра. Снято с эталона: ребро выходит через нижнюю
 * (или верхнюю, если цель выше) грань источника и входит через верхнюю (нижнюю)
 * грань цели, а точка на грани — пересечение отрезка между центрами узлов с этой гранью.
 * Поэтому рёбра к соседям слева/справа выходят не из центра, а со сдвигом к цели.
 */
function endpoints(s: Rect, t: Rect) {
  const sc = { x: s.x + s.w / 2, y: s.y + s.h / 2 };
  const tc = { x: t.x + t.w / 2, y: t.y + t.h / 2 };
  const down = tc.y >= sc.y;
  const sy = down ? s.y + s.h : s.y;
  const ty = down ? t.y : t.y + t.h;
  const dy = tc.y - sc.y;
  const clamp = (x: number, r: Rect) => Math.min(r.x + r.w, Math.max(r.x, x));
  if (Math.abs(dy) < 1e-6) {
    // Узлы на одном уровне: соединяем ближайшие боковые грани
    const right = tc.x >= sc.x;
    return {
      sx: right ? s.x + s.w : s.x,
      sy: sc.y,
      tx: right ? t.x : t.x + t.w,
      ty: tc.y,
      sourcePosition: right ? Position.Right : Position.Left,
      targetPosition: right ? Position.Left : Position.Right,
    };
  }
  const k = (tc.x - sc.x) / dy;
  return {
    sx: clamp(sc.x + (sy - sc.y) * k, s),
    sy,
    tx: clamp(sc.x + (ty - sc.y) * k, t),
    ty,
    sourcePosition: down ? Position.Bottom : Position.Top,
    targetPosition: down ? Position.Top : Position.Bottom,
  };
}

function GraphEdgeComponent({ id, source, target, data }: EdgeProps<GraphFlowEdge>) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  // Во время прогона и после срыва эталон гасит все рёбра до 20 %; пауза их не трогает
  const dimmed = useRun((s) => s.running || Boolean(s.errorNode));
  if (!sourceNode || !targetNode || !data) return null;

  const rect = (n: typeof sourceNode): Rect => ({
    x: n.internals.positionAbsolute.x,
    y: n.internals.positionAbsolute.y,
    w: n.measured.width ?? 0,
    h: n.measured.height ?? 0,
  });
  const s = rect(sourceNode);
  const t = rect(targetNode);

  let path: string;
  let labelX: number;
  let labelY: number;

  if (source === target) {
    // Петля: небольшая дуга справа от узла
    const x = s.x + s.w;
    const y = s.y + s.h / 2;
    path = `M ${x - 8},${s.y + s.h} C ${x + 30},${s.y + s.h + 20} ${x + 30},${s.y - 20} ${x - 8},${s.y}`;
    labelX = x + 24;
    labelY = y;
  } else {
    const e = endpoints(s, t);
    if (data.paired) {
      // Встречные рёбра: квадратичная дуга. Контрольная точка сдвинута от середины
      // по горизонтали на половину вертикального расстояния в сторону движения,
      // а по вертикали на половину горизонтального против движения. Снято с эталона:
      // при таком правиле обе дуги пары расходятся симметрично при любом взаимном
      // расположении узлов. Для строго вертикальной пары сдвиг задаём явно.
      const dx = e.tx - e.sx;
      const dy = e.ty - e.sy;
      const sx = dx === 0 ? Math.sign(dy) : Math.sign(dx);
      const cx = (e.sx + e.tx) / 2 + sx * (Math.abs(dy) / 2);
      const cy = (e.sy + e.ty) / 2 - Math.sign(dy) * (Math.abs(dx) / 2);
      path = `M ${e.sx} ${e.sy} Q ${cx} ${cy} ${e.tx} ${e.ty}`;
      labelX = (e.sx + 2 * cx + e.tx) / 4;
      labelY = (e.sy + 2 * cy + e.ty) / 4;
    } else {
      [path, labelX, labelY] = getBezierPath({
        sourceX: e.sx,
        sourceY: e.sy,
        sourcePosition: e.sourcePosition,
        targetX: e.tx,
        targetY: e.ty,
        targetPosition: e.targetPosition,
      });
    }
  }

  const markerId = `arrow-${id}`;
  return (
    <>
      <defs>
        <marker
          id={markerId}
          markerWidth="30"
          markerHeight="30"
          viewBox="-10 -10 20 20"
          markerUnits="strokeWidth"
          orient="auto-start-reverse"
          refX="0"
          refY="0"
        >
          <polyline
            strokeLinecap="round"
            strokeLinejoin="round"
            points="-5,-4 0,0 -5,4 -5,-4"
            style={{ fill: data.arrow }}
          />
        </marker>
      </defs>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={`url(#${markerId})`}
        style={{
          stroke: data.stroke,
          strokeWidth: 1,
          strokeDasharray: data.conditional ? "3 1" : undefined,
          opacity: dimmed ? 0.2 : 1,
          transition: "opacity 300ms ease-in-out",
        }}
      />
      {data.label && (
        <EdgeLabelRenderer>
          <div
            className="edge-label pointer-events-none absolute rounded-sm px-1 text-[11px] leading-4 opacity-0 transition-opacity"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              color: data.arrow,
              background: "var(--bg-secondary)",
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const GraphEdge = memo(GraphEdgeComponent);
