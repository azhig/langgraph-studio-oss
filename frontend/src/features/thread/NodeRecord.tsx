import { useEffect, useState } from "react";
import { ArrowRight, ChevronDown, ChevronRight, Pencil, User } from "lucide-react";
import type { ThreadState } from "@langchain/langgraph-sdk";
import { cx } from "@/lib/cx";
import { getClient } from "@/api/client";
import { useStudio } from "@/store/studio";
import { useRun, type LogEntry, type NodeEntry } from "@/store/run";
import { useStudioStream } from "@/features/run/StreamProvider";
import { CollapseGlyph, ExpandGlyph, SubgraphGlyph } from "@/components/icons/SubgraphGlyphs";
import { NodeAvatar, NodeChip } from "@/features/graph/NodeAvatar";
import { useNodeStateEditor } from "./EditNodeState";
import { Checkpoint } from "./Checkpoint";
import { ErrorBlock } from "./ErrorBlock";
import { InterruptBlock } from "./InterruptBlock";
import { entriesFromHistory } from "./history";
import { Updates } from "./Updates";

/** Sticky headers are nested: a subgraph has its own step. */
const stickyTop = (depth: number) => 46 + depth * 24;
const stickyZ = (depth: number) => 5 - depth;

/**
 * Node record: avatar, name, contents of what the node wrote to the state;
 * on hover — state editing (`Fork`), for a subgraph — expanding its steps.
 */
export function NodeRecord({
  entry,
  defaultOpen,
  canContinue = false,
  depth = 0,
  lastOfTurn = false,
}: {
  entry: NodeEntry;
  defaultOpen: boolean;
  canContinue?: boolean;
  /** Last record of the turn: the reference offers no state editing for it. */
  lastOfTurn?: boolean;
  /** Nesting depth: subgraph records stick below the parent row. */
  depth?: number;
}) {
  // An interrupt awaits a reply only at the last checkpoint of the thread: in earlier records
  // it is already closed, and the reply form should not be shown
  const headCheckpointId = useStudioStream().headCheckpointId;
  const active = Boolean(entry.checkpointId && entry.checkpointId === headCheckpointId);
  // Until the record is touched manually it follows the reference rule: input and
  // the last step are expanded, the rest collapse as new records appear.
  const [manual, setManual] = useState<boolean | null>(null);
  const [editing, setEditing] = useState(false);
  const editor = useNodeStateEditor(entry, () => setEditing(false));
  const open = manual ?? defaultOpen;
  const toggle = () => setManual(!open);
  const content = Object.entries(entry.updates ?? {});
  const system = entry.node === "__start__";

  // Hovering a record highlights its node on the canvas and dims the rest — as in the reference
  const setHoverNode = useRun((s) => s.setHoverNode);
  const isSubgraph = useStudio((s) => s.subgraphs.includes(entry.node));
  // Subgraph steps in the log expand independently of the frame on the canvas
  const [steps, setSteps] = useState(false);
  const sticky = { top: stickyTop(depth), zIndex: stickyZ(depth) };

  return (
    <div
      className={cx("flex flex-col gap-2 bg-bg-primary py-1.5", !depth && "px-6")}
      onMouseEnter={() => !system && setHoverNode(entry.node)}
      onMouseLeave={() => setHoverNode(undefined)}
    >
      <div className="relative mr-4 grid grid-cols-[auto_1fr] gap-x-3">
        <div className="flex flex-col items-center pt-0.5">
          <NodeAvatar node={entry.node} square={Boolean(entry.subgraphNs)} className="sticky" style={sticky}>
            {entry.subgraphNs ? (
              <SubgraphGlyph className="size-3" />
            ) : system ? (
              <User size={12} strokeWidth={1.8} />
            ) : undefined}
          </NodeAvatar>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <div className="group sticky flex h-6 items-center gap-1.5 bg-bg-primary" style={sticky}>
            <button
              type="button"
              aria-label={open ? "Collapse node" : "Expand node"}
              className="btn btn-ghost btn-icon !p-1 text-text-secondary"
              onClick={toggle}
            >
              {open ? <ChevronDown size={16} strokeWidth={1.5} /> : <ChevronRight size={16} strokeWidth={1.5} />}
            </button>
            {isSubgraph ? (
              // Subgraph node: an icon to the right of the name; clicking expands and collapses
              // the subgraph steps in the log, as in the reference
              <button
                type="button"
                aria-label={steps ? "Hide subgraph steps" : "See subgraph steps"}
                title={steps ? "Hide subgraph steps" : "See subgraph steps"}
                className="inline-flex cursor-pointer items-center gap-1.5 self-start rounded"
                onClick={() => setSteps((v) => !v)}
              >
                <span className="text-sm leading-[1.15] font-medium tracking-tighter">{entry.node}</span>
                {steps ? (
                  <CollapseGlyph className="invisible size-6 rounded-md p-1 text-text-secondary group-hover:visible hover:bg-bg-tertiary" />
                ) : (
                  <ExpandGlyph className="invisible size-6 rounded-md p-1 text-text-secondary group-hover:visible hover:bg-bg-tertiary" />
                )}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm leading-[1.15] font-medium tracking-tighter">{entry.node}</span>
              </div>
            )}
            {editing && editor.actions}
            {entry.checkpointId && !editing && open && !entry.error && !lastOfTurn && (
              <div className="invisible flex items-center gap-2 text-text-secondary group-hover:visible focus-within:visible">
                <button
                  type="button"
                  aria-label="Edit node state"
                  className="btn btn-ghost btn-icon !p-1"
                  onClick={() => setEditing(true)}
                >
                  <Pencil size={16} strokeWidth={1.5} />
                </button>
              </div>
            )}
          </div>
          {editing && editor.body}
          {steps && entry.subgraphNs && <SubgraphLog ns={entry.subgraphNs} depth={depth + 1} />}
          {!editing && open && content.length > 0 && <Updates updates={entry.updates} />}
          {entry.error && <ErrorBlock message={entry.error} />}
          {active &&
            entry.interrupts?.map((it, i) => <InterruptBlock key={it.id ?? i} node={entry.node} interrupt={it} />)}
        </div>
      </div>
      {canContinue && <ContinueRow />}
    </div>
  );
}

/**
 * Nested subgraph log. The server returns its step history by the task
 * namespace (`<node>:<task id>`) — the same `POST /threads/{id}/history`, only with
 * `checkpoint.checkpoint_ns`. Records are drawn with the same components as the top
 * level, but stick one step lower.
 */
function SubgraphLog({ ns, depth }: { ns: string; depth: number }) {
  const threadId = useStudioStream().threadId;
  const detail = useRun((s) => s.detail);
  const [entries, setEntries] = useState<LogEntry[]>([]);

  useEffect(() => {
    if (!threadId) return;
    let stale = false;
    void getClient()
      .threads.getHistory(threadId, { limit: 100, checkpoint: { checkpoint_ns: ns } })
      .then((history) => {
        // `getHistory` returns newest to oldest, while the log reads top to bottom
        if (!stale) setEntries(entriesFromHistory([...history].reverse() as ThreadState<Record<string, unknown>>[]));
      })
      .catch(() => setEntries([]));
    return () => {
      stale = true;
    };
  }, [threadId, ns]);

  if (!entries.length) return null;
  const lastNode = [...entries].reverse().find((e) => e.kind === "node")?.key;
  return (
    <div className="flex flex-col">
      {entries.map((e) =>
        e.kind === "checkpoint" ? (
          <Checkpoint key={e.key} ts={e.ts} checkpointId={e.checkpointId} values={e.values} nested />
        ) : (
          <NodeRecord
            key={e.key}
            entry={e}
            depth={depth}
            defaultOpen={detail === 2 || e.node === "__start__" || e.key === lastNode}
          />
        ),
      )}
    </div>
  );
}

/** Below a failed step the reference offers to continue: a button and a chip of the next node. */
function ContinueRow() {
  const { continueRun, nextNodes, isLoading } = useStudioStream();
  const node = nextNodes[0];
  if (!node) return null;
  return (
    <div className="flex items-center gap-2 pl-6">
      <button
        type="button"
        className="btn btn-primary !rounded-sm"
        disabled={isLoading}
        onClick={() => void continueRun()}
      >
        Continue
      </button>
      <ArrowRight size={16} strokeWidth={1.5} className="text-text-tertiary" />
      <span className="inline-flex items-center gap-2">
        <NodeChip node={node} />
      </span>
    </div>
  );
}
