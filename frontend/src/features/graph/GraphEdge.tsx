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
  /** An opposing edge exists: the pair is drawn as two arcs bowed in opposite directions. */
  paired: boolean;
  /** Line color (source node tone, alpha 0.8) and arrow color (same tone, opaque). */
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
 * Edge entry/exit points. Captured from the reference: the edge leaves through the bottom
 * (or top, if the target is above) side of the source and enters through the top (bottom)
 * side of the target; the point on the side is the intersection of the segment between node centers with that side.
 * Hence edges to neighbors on the left/right leave not from the center but shifted toward the target.
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
    // Nodes on the same level: connect the nearest lateral sides
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
  // During a run and after a failure the reference dims all edges to 20 %; a pause leaves them alone
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
    // Self-loop: a small arc to the right of the node
    const x = s.x + s.w;
    const y = s.y + s.h / 2;
    path = `M ${x - 8},${s.y + s.h} C ${x + 30},${s.y + s.h + 20} ${x + 30},${s.y - 20} ${x - 8},${s.y}`;
    labelX = x + 24;
    labelY = y;
  } else {
    const e = endpoints(s, t);
    if (data.paired) {
      // Opposing edges: a quadratic arc. The control point is shifted from the midpoint
      // horizontally by half the vertical distance in the direction of travel,
      // and vertically by half the horizontal distance against it. Captured from the reference:
      // with this rule both arcs of a pair diverge symmetrically for any mutual
      // placement of the nodes. For a strictly vertical pair the offset is set explicitly.
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
