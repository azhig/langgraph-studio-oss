import { useReactFlow } from "@xyflow/react";
import { Expand, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

/**
 * Vertical zoom panel to the left above the graph: in / out / fit / reset.
 * Buttons 26x26 with a 34 px step, 16 px icons, as in the reference.
 * The last button restores the auto layout: nodes can be dragged,
 * and this is the only way to return them to their original places (the reference aria-label is
 * «Reset layout to default»).
 */
export function ZoomControls({ onResetLayout }: { onResetLayout: () => void }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const btn = "btn btn-ghost btn-icon size-[26px] !p-1 text-text-secondary";
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className={btn}
        aria-label="Zoom in"
        title="Zoom in"
        onClick={() => void zoomIn({ duration: 200 })}
      >
        <ZoomIn size={16} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        className={btn}
        aria-label="Zoom out"
        title="Zoom out"
        onClick={() => void zoomOut({ duration: 200 })}
      >
        <ZoomOut size={16} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        className={btn}
        aria-label="Fit graph to view"
        title="Fit graph to view"
        onClick={() => void fitView({ padding: 0.1, duration: 200 })}
      >
        <Expand size={16} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        className={btn}
        aria-label="Reset layout to default"
        title="Reset layout to default"
        onClick={onResetLayout}
      >
        <RotateCcw size={16} strokeWidth={1.8} />
      </button>
    </div>
  );
}
