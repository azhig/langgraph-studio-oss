import { Bug } from "lucide-react";
import type { AssistantGraph } from "@langchain/langgraph-sdk";
import { Popover } from "@/components/Popover";
import { Checkbox } from "@/components/Checkbox";
import { useRun } from "@/store/run";
import { userNodeIds } from "./layout";

/**
 * The `Interrupts` menu: `Before` and `After` pauses for each node, "Interrupt on all" at the bottom.
 * The selection goes into the run (`interruptBefore` / `interruptAfter`); the number of active
 * pauses is shown on the button itself, as in the reference.
 */
export function InterruptsMenu({ graph }: { graph?: AssistantGraph }) {
  const interruptBefore = useRun((s) => s.interruptBefore);
  const interruptAfter = useRun((s) => s.interruptAfter);
  const toggleInterrupt = useRun((s) => s.toggleInterrupt);
  const interruptAll = useRun((s) => s.interruptAll);
  const nodes = userNodeIds(graph);
  const count = interruptBefore.length + interruptAfter.length;

  return (
    <Popover
      minWidth={160}
      align="end"
      trigger={({ toggle }) => (
        <button
          type="button"
          className="flex h-[38px] items-center gap-2 rounded-md border border-border-secondary px-2.5 py-1.5 text-sm transition-colors hover:bg-bg-tertiary"
          onClick={toggle}
        >
          <span className="flex size-6 items-center justify-center">
            <Bug size={18} strokeWidth={1.6} />
          </span>
          <span>Interrupts</span>
          {count > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full border border-border-secondary bg-bg-secondary text-center text-xs text-text-tertiary">
              {count}
            </span>
          )}
        </button>
      )}
    >
      {() => (
        <div className="p-1" role="menu" aria-orientation="vertical" data-state="open">
          {nodes.map((node) => (
            <div
              key={node}
              role="menuitem"
              className="flex items-center justify-between gap-6 rounded-sm px-2 pb-2 transition-colors select-none hover:bg-bg-secondary"
            >
              <span className="truncate text-base leading-6">{node}</span>
              <span className="flex items-center gap-2">
                <Checkbox
                  label="Before"
                  className="gap-1.5"
                  checked={interruptBefore.includes(node)}
                  onToggle={() => toggleInterrupt(node, "before")}
                />
                <Checkbox
                  label="After"
                  className="gap-1.5"
                  checked={interruptAfter.includes(node)}
                  onToggle={() => toggleInterrupt(node, "after")}
                />
              </span>
            </div>
          ))}
          {nodes.length === 0 && <div className="px-2 py-1 text-sm text-text-tertiary">No nodes</div>}
          <div role="separator" aria-orientation="horizontal" className="my-1 h-px bg-bg-secondary" />
          <button
            type="button"
            role="menuitem"
            className="flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-left text-base leading-6 transition-colors select-none hover:bg-bg-secondary"
            onClick={() => interruptAll(nodes)}
          >
            {count > 0 ? "Clear all" : "Interrupt on all"}
          </button>
        </div>
      )}
    </Popover>
  );
}
