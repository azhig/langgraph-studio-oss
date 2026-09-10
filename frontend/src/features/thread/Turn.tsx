import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, CircleAlert } from "lucide-react";
import { cx } from "@/lib/cx";
import { useRun, type LogEntry, type NodeEntry } from "@/store/run";
import { useStudioStream } from "@/features/run/StreamProvider";
import { Checkpoint } from "./Checkpoint";
import { NodeRecord } from "./NodeRecord";
import { Updates } from "./Updates";

const lastNode = (entries: LogEntry[]) => [...entries].reverse().find((e): e is NodeEntry => e.kind === "node");

/** One thread turn: `TURN N` header, a summary at the bottom slider level or the list of records. */
export function Turn({
  index,
  entries,
  last,
  headerHost = null,
}: {
  index: number;
  entries: LogEntry[];
  last: boolean;
  /** Where to move the turn header: for the first one it lives in the pinned block. */
  headerHost?: HTMLDivElement | null;
}) {
  const [open, setOpen] = useState(true);
  // `Review` in the summary expands one turn in detail, leaving the slider in place
  const [reviewing, setReviewing] = useState(false);
  const detail = useRun((s) => s.detail);
  const { nextNodes, isLoading } = useStudioStream();
  // The thread is stopped at an interrupt: the server knows which node runs next
  const paused = !isLoading && nextNodes.length > 0;
  const lastEntry = lastNode(entries);
  // The reference offers to continue below the last record of the turn: below the failed node
  // after an error and below the node before which the thread stopped at a static interrupt.
  // A dynamic `interrupt()` is continued by replying in the record itself; there is no button there.
  const failed = [...entries].reverse().find((e): e is NodeEntry => e.kind === "node" && Boolean(e.error));
  const awaitingAnswer = Boolean(lastEntry?.interrupts?.length);
  const continueAt = failed?.key ?? (paused && !awaitingAnswer ? lastEntry?.key : undefined);

  // The reference highlights an unfinished turn with the brand background — both header and summary
  const halted = last && (paused || Boolean(failed));
  const summary = detail === 0 && !reviewing;
  // The reference shows the brand background only in the collapsed turn view
  const highlight = halted && summary;

  const header = (
    <TurnHeader
      index={index}
      open={open}
      halted={highlight}
      summary={summary}
      sticky={!headerHost}
      onToggle={() => setOpen((v) => !v)}
    />
  );

  // Each log row is a separate list item, as in the reference's virtual list
  return (
    <>
      {headerHost ? createPortal(header, headerHost) : header}
      {open && summary && (
        <div className={cx("w-full px-7 pb-3", highlight ? "bg-bg-brand-secondary" : "bg-bg-primary")}>
          <button type="button" className="w-full text-left" onClick={() => setOpen((v) => !v)}>
            <TurnSummary entries={entries} halted={halted} error={failed?.error} onReview={() => setReviewing(true)} />
          </button>
        </div>
      )}
      {open &&
        !summary &&
        entries.map((e) =>
          e.kind === "checkpoint" ? (
            <Checkpoint
              key={e.key}
              ts={e.ts}
              checkpointId={e.checkpointId}
              values={e.values}
              root={e.root || e.turnStart}
              snapshot={{
                values: e.values ?? null,
                next: e.next ?? [],
                tasks: e.tasks ?? [],
                metadata: e.metadata ?? {},
              }}
            />
          ) : (
            <NodeRecord
              key={e.key}
              entry={e}
              defaultOpen={openByDefault(e, detail, e.key === lastEntry?.key)}
              canContinue={last && e.key === continueAt}
              lastOfTurn={e.key === lastEntry?.key}
            />
          ),
        )}
    </>
  );
}

/**
 * What is expanded initially. The reference expands the input and the last record of the turn;
 * from the second level — all records, from the third — together with the values.
 */
function openByDefault(entry: NodeEntry, detail: number, lastOfTurn: boolean): boolean {
  if (detail >= 2) return true;
  return entry.node === "__start__" || lastOfTurn;
}

function TurnHeader({
  index,
  open,
  halted = false,
  summary = false,
  sticky = false,
  onToggle,
}: {
  index: number;
  open: boolean;
  halted?: boolean;
  /** The turn is shown as a summary: the reference draws a right-pointing chevron. */
  summary?: boolean;
  /** The header inside the list sticks to the top and slides over the pinned block. */
  sticky?: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cx(
        "flex w-full cursor-pointer flex-col gap-2",
        sticky && "sticky top-0 z-[2]",
        halted ? "bg-bg-brand-secondary" : "bg-bg-primary",
      )}
      onClick={onToggle}
    >
      <div className="border-t border-border-secondary px-6 pt-3">
        <div className="flex w-full items-center gap-2 pb-4">
          <div data-testid="turn-toggle" className="flex w-full items-center justify-center gap-2 bg-transparent">
            {open && !summary ? (
              <ChevronDown size={16} className="text-text-quaternary" />
            ) : (
              <ChevronRight size={16} className="text-text-quaternary" />
            )}
            <h4 className="text-sm leading-[1.2] font-normal tracking-wide text-text-quaternary uppercase">
              Turn {index}
            </h4>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Bottom slider position: the turn collapses to an `Input` / `Output` pair —
 * what was sent and what was received, without nodes or times. If the turn is unfinished —
 * stopped at an interrupt or failed — instead of the result the reference shows
 * `Pending` (or the error text) and an "Execution paused" row with a `Review` button
 * that expands this turn in full without touching the slider.
 */
function TurnSummary({
  entries,
  halted,
  error,
  onReview,
}: {
  entries: LogEntry[];
  halted: boolean;
  error?: string;
  onReview: () => void;
}) {
  const nodes = entries.filter((e): e is NodeEntry => e.kind === "node");
  const input = nodes.find((e) => e.node === "__start__")?.updates;
  const output = [...nodes].reverse().find((e) => e.node !== "__start__" && e.updates)?.updates;
  return (
    <div className="flex flex-col gap-3 px-7">
      <div className="flex flex-col gap-2">
        <span className="text-sm leading-[1.15] font-semibold tracking-tighter text-text-secondary">Input</span>
        {/* In the summary the reference shows the input as one line without a bubble */}
        <div className="line-clamp-1 flex flex-col justify-start gap-2 text-sm text-text-tertiary">
          <Updates updates={input} bare />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm leading-[1.15] font-semibold tracking-tighter text-text-secondary">Output</span>
        {error ? (
          <div className="flex flex-row items-center gap-2">
            <span className="text-sm font-medium text-text-secondary">Error: </span>
            <span className="truncate text-sm text-text-error-secondary">{error}</span>
            <CircleAlert
              size={24}
              strokeWidth={1.5}
              className="shrink-0 rounded-full bg-bg-error p-0.5 text-text-error-secondary"
            />
          </div>
        ) : halted ? (
          <span className="text-sm text-text-secondary">Pending</span>
        ) : (
          <div className="line-clamp-1 flex flex-col justify-start gap-2 text-sm text-text-tertiary">
            <Updates updates={output} bare />
          </div>
        )}
      </div>
      {halted && (
        <div className="flex w-full items-center gap-1.5">
          <span className="rounded-md border border-border-secondary p-1">
            <CircleAlert size={16} strokeWidth={1.5} className="shrink-0 text-text-secondary" />
          </span>
          <span className="text-xs font-semibold text-text-primary">Execution paused.</span>
          <span className="text-xs text-text-tertiary">Review to continue.</span>
          <button type="button" className="btn btn-primary ml-auto !rounded-sm" onClick={onReview}>
            Review
          </button>
        </div>
      )}
    </div>
  );
}
