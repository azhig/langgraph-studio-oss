import { useMemo, useState } from "react";
import type { Assistant } from "@langchain/langgraph-sdk";
import { Plus } from "lucide-react";
import { cx } from "@/lib/cx";
import { Modal } from "@/components/Modal";
import { useCurrentAssistant, useStudio } from "@/store/studio";
import { AssistantForm } from "./AssistantForm";
import { configFields } from "./config";
import { assistantTitle } from "./model";

/**
 * `Manage Assistants`: the graph's assistants on the left, their settings on the right.
 * Sizes are taken from the reference: 960×640 canvas inset by 16 px, `2fr / 5fr` columns
 * (265 / 663), the divider is the left column's right border; the active row is marked with
 * a left bar and a fill.
 */
export function AssistantsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const assistantId = useStudio((s) => s.assistantId);
  return (
    <Modal open={open} onClose={onClose}>
      {/* The window always opens on the active assistant and follows its changes */}
      <AssistantsPanel key={assistantId} onClose={onClose} />
    </Modal>
  );
}

function AssistantsPanel({ onClose }: { onClose: () => void }) {
  const assistants = useStudio((s) => s.assistants);
  const assistantId = useStudio((s) => s.assistantId);
  const schemas = useStudio((s) => s.schemas);
  const selectAssistant = useStudio((s) => s.selectAssistant);
  const current = useCurrentAssistant();
  const list = useMemo(
    () => assistants.filter((a) => a.graph_id === current?.graph_id),
    [assistants, current?.graph_id],
  );
  // `undefined` — `New` mode: form without an assistant
  const [openedId, setOpenedId] = useState<string | undefined>(assistantId);
  const opened = list.find((a) => a.assistant_id === openedId) ?? current;
  const fields = useMemo(() => configFields(schemas), [schemas]);

  return (
    <div className="grid h-full grid-cols-[2fr_5fr] p-4">
      <div className="flex h-full min-h-0 flex-col rounded-l-xl border-r border-border-secondary">
        <div className="flex items-center justify-between px-2">
          <span className="pt-2 text-sm font-medium text-text-secondary">ASSISTANTS</span>
          <button
            type="button"
            className="btn btn-outline !rounded-sm"
            title="Create a new assistant from the current settings"
            onClick={() => setOpenedId(undefined)}
          >
            <Plus size={14} strokeWidth={1.8} />
            New
          </button>
        </div>
        <div className="scroll-thin flex min-h-0 flex-1 flex-col items-stretch gap-2 overflow-y-auto py-2">
          {list.map((a) => (
            <Row
              key={a.assistant_id}
              assistant={a}
              selected={a.assistant_id === opened?.assistant_id}
              active={a.assistant_id === assistantId}
              onOpen={() => setOpenedId(a.assistant_id)}
            />
          ))}
        </div>
      </div>
      <AssistantForm
        key={opened?.assistant_id ?? "new"}
        assistant={opened}
        creating={openedId === undefined}
        active={opened?.assistant_id === assistantId}
        fields={fields}
        onActivate={() => opened && void selectAssistant(opened.assistant_id)}
        onClose={onClose}
      />
    </div>
  );
}

function Row({
  assistant,
  selected,
  active,
  onOpen,
}: {
  assistant: Assistant;
  selected: boolean;
  active: boolean;
  onOpen: () => void;
}) {
  return (
    <div className="flex flex-col pr-2 hover:bg-bg-secondary">
      <button
        type="button"
        className={cx(
          "flex w-full cursor-pointer items-center justify-between p-2 text-left",
          selected && "border-l-[4px] border-border-brand bg-bg-brand-tertiary",
        )}
        onClick={onOpen}
      >
        <span className="flex items-center gap-1 overflow-x-hidden">
          <span className="truncate py-1 text-sm font-medium whitespace-nowrap text-text-tertiary">
            {assistantTitle(assistant)}
          </span>
        </span>
        {active && (
          <span className="flex items-center gap-1 rounded-full border border-border-brand bg-transparent px-2 py-1 text-xs font-medium text-text-brand-primary">
            <span className="size-2 rounded-full bg-bg-brand" />
            Active
          </span>
        )}
      </button>
    </div>
  );
}
