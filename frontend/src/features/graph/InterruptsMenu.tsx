import { Bug } from "lucide-react";
import type { AssistantGraph } from "@langchain/langgraph-sdk";
import { Popover } from "@/components/Popover";
import { useRun } from "@/store/run";
import { isSystemNode } from "./colors";

/**
 * Меню `Interrupts`: для каждого узла — паузы `Before` и `After`, внизу «Interrupt on all».
 * Выбранное уходит в запуск (`interruptBefore` / `interruptAfter`), число активных
 * пауз показывается на самой кнопке — как в эталоне.
 */
export function InterruptsMenu({ graph }: { graph?: AssistantGraph }) {
  const { interruptBefore, interruptAfter, toggleInterrupt, interruptAll } = useRun();
  const nodes = (graph?.nodes ?? []).map((n) => String(n.id)).filter((id) => !isSystemNode(id));
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
              className="flex select-none items-center justify-between gap-6 rounded-sm px-2 pb-2 transition-colors hover:bg-bg-secondary"
            >
              <span className="truncate text-base leading-6">{node}</span>
              <span className="flex items-center gap-2">
                <Check
                  label="Before"
                  checked={interruptBefore.includes(node)}
                  onToggle={() => toggleInterrupt(node, "before")}
                />
                <Check
                  label="After"
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
            className="flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-left text-base leading-6 transition-colors hover:bg-bg-secondary"
            onClick={() => interruptAll(nodes)}
          >
            {count > 0 ? "Clear all" : "Interrupt on all"}
          </button>
        </div>
      )}
    </Popover>
  );
}

function Check({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex shrink-0 items-center gap-1.5 py-2 text-xs text-text-tertiary"
      onClick={onToggle}
    >
      <span
        className={`flex size-4 items-center justify-center rounded-[4px] border ${
          checked
            ? "border-bg-brand bg-bg-brand-tertiary text-text-brand-secondary"
            : "border-border-secondary"
        }`}
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
            <path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        )}
      </span>
      <span>{label}</span>
    </button>
  );
}
