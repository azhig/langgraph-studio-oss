import { ChevronLeft, ChevronRight } from "lucide-react";
import { cx } from "@/lib/cx";
import { useStudioStream } from "@/features/run/StreamProvider";
import { Popover } from "@/components/Popover";
import { Tooltip } from "@/components/Tooltip";
import type { BranchInfo } from "./branches";
import { RelativeTime } from "./RelativeTime";
import { ViewState } from "./ViewState";

/**
 * Checkpoint row: time, and on hover — `View state` and `Re-run from here`.
 * At a fork, the branch switcher `‹ Fork 2 of 2 ›` appears on the left.
 */
export function Checkpoint({
  ts,
  checkpointId,
  values,
  nested = false,
  root = false,
  snapshot,
}: {
  ts: number;
  checkpointId?: string;
  values?: unknown;
  /** Full checkpoint snapshot for the JSON tab. */
  snapshot?: Record<string, unknown>;
  /** Inside a subgraph the time row is already nested in the parent column. */
  nested?: boolean;
  /** The very first checkpoint of the thread: the reference offers no re-run from it. */
  root?: boolean;
}) {
  const { branches, setBranch, rerunFrom, isLoading } = useStudioStream();
  const fork = checkpointId ? branches[checkpointId] : undefined;
  return (
    <div className={cx("flex flex-col gap-2 bg-bg-primary py-1.5", !nested && "px-6")}>
      <div
        data-testid="checkpoint-entry"
        className="group mr-4 flex items-center rounded-md p-1.5 transition-colors hover:bg-bg-tertiary"
      >
        <div className="flex w-full flex-col items-start gap-2">
          <div className="mr-4 flex w-full min-w-0 flex-row items-center gap-3">
            {fork && <ForkNav fork={fork} onSelect={setBranch} />}
            {/* The reference shows the checkpoint id when hovering the time */}
            <Tooltip
              side="left"
              label={
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <span className="text-xs leading-tight tracking-snug">Checkpoint:</span>
                  <span className="text-xs leading-tight tracking-snug">{checkpointId ?? "—"}</span>
                </span>
              }
            >
              <span className="text-xs whitespace-nowrap text-text-tertiary">
                <RelativeTime ts={ts} />
              </span>
            </Tooltip>
            <div className="invisible ml-auto flex items-center gap-3 group-hover:visible focus-within:visible">
              <Popover
                width={600}
                maxHeight="50vh"
                align="screen-end"
                trigger={({ toggle }) => (
                  <button
                    type="button"
                    aria-label="View state"
                    aria-haspopup="dialog"
                    className="btn btn-ghost h-[26px] !px-2"
                    onClick={toggle}
                  >
                    View state
                  </button>
                )}
              >
                {() => <ViewState checkpointId={checkpointId} values={values} snapshot={snapshot} />}
              </Popover>
              {!root && (
                <>
                  <span className="size-1 rounded-full bg-text-quaternary" />
                  <button
                    type="button"
                    className="btn btn-ghost h-[26px] !px-2 disabled:text-text-disabled"
                    disabled={!checkpointId || isLoading}
                    aria-label="Re-run from here"
                    onClick={() => checkpointId && void rerunFrom(checkpointId)}
                  >
                    Re-run from here
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Fork: switching between branches that grow from the same checkpoint. */
function ForkNav({ fork, onSelect }: { fork: BranchInfo; onSelect: (branch: string) => void }) {
  const total = fork.options.length;
  const btn = "btn btn-ghost btn-icon !p-1 text-text-secondary disabled:text-text-disabled";
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          title="Previous fork"
          className={btn}
          disabled={fork.index <= 1}
          onClick={() => onSelect(fork.options[fork.index - 2])}
        >
          <ChevronLeft size={16} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          title="Next fork"
          className={btn}
          disabled={fork.index >= total}
          onClick={() => onSelect(fork.options[fork.index])}
        >
          <ChevronRight size={16} strokeWidth={1.5} />
        </button>
      </div>
      <span className="text-xs whitespace-nowrap text-text-tertiary">
        Fork <span className="tabular-nums">{fork.index}</span> of <span className="tabular-nums">{total}</span>
      </span>
    </div>
  );
}
