import { useReactFlow } from "@xyflow/react";
import { Expand, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

/**
 * Вертикальная панель зума слева над графом: in / out / fit / reset.
 * Кнопки 26×26 с шагом 34 px, иконки 16 px, как в эталоне.
 * Последняя кнопка возвращает автораскладку — узлы можно перетаскивать,
 * и это единственный способ вернуть их на исходные места (aria-label эталона —
 * «Reset layout to default»).
 */
export function ZoomControls({ onResetLayout }: { onResetLayout: () => void }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const btn = "btn btn-ghost btn-icon size-[26px] !p-1 text-text-secondary";
  return (
    <div className="flex flex-col gap-2">
      <button type="button" className={btn} aria-label="Zoom in" title="Zoom in" onClick={() => void zoomIn({ duration: 200 })}>
        <ZoomIn size={16} strokeWidth={1.8} />
      </button>
      <button type="button" className={btn} aria-label="Zoom out" title="Zoom out" onClick={() => void zoomOut({ duration: 200 })}>
        <ZoomOut size={16} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        className={btn}
        aria-label="Fit graph to view" title="Fit graph to view"
        onClick={() => void fitView({ padding: 0.1, duration: 200 })}
      >
        <Expand size={16} strokeWidth={1.8} />
      </button>
      <button type="button" className={btn} aria-label="Reset layout to default" title="Reset layout to default" onClick={onResetLayout}>
        <RotateCcw size={16} strokeWidth={1.8} />
      </button>
    </div>
  );
}
