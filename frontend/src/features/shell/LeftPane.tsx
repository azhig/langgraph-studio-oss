import { useState } from "react";
import { useStudio } from "@/store/studio";
import { MemoryModal } from "@/features/memory/MemoryModal";
import { GraphView } from "@/features/graph/GraphView";
import { InterruptsMenu } from "@/features/graph/InterruptsMenu";
import { LeftHeader } from "./Header";
import { InputPanel } from "@/features/input/InputPanel";

/**
 * Левая панель: шапка, ряд `Memory / Interrupts`, холст графа и карточка `Input`.
 * Фон панели bg-secondary (#111521 в тёмной теме) — чуть светлее правой.
 */
export function LeftPane() {
  const { graph, xrayGraph, subgraphs, expandedSubgraphs, schemas, connection, connectionError } = useStudio();
  const [memory, setMemory] = useState(false);
  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden bg-bg-secondary">
      <LeftHeader />
      <div className="flex items-center justify-between border-t border-border-secondary p-4">
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="flex min-h-[38px] items-center justify-between gap-2 rounded-md border border-border-secondary bg-transparent px-3 py-2 text-sm hover:bg-bg-tertiary"
            onClick={() => setMemory(true)}
          >
            Memory
          </button>
          <MemoryModal open={memory} onClose={() => setMemory(false)} />
          <InterruptsMenu graph={graph} />
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col text-sm">
        {graph ? (
          // Развёрнутый граф от сервера — источник вложенных узлов; свёртку делает GraphView
          <GraphView
            graph={xrayGraph ?? graph}
            schemas={schemas}
            subgraphs={subgraphs}
            expanded={expandedSubgraphs}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-text-quaternary">
            {connection === "error" ? `Could not connect to the server: ${connectionError}` : "Loading graph…"}
          </div>
        )}
      </div>
      <InputPanel />
    </div>
  );
}
