import { useMemo, useState } from "react";
import { useRun } from "@/store/run";
import { useStudioStream } from "@/features/run/StreamProvider";
import { entriesFromHistory, splitTurns } from "./history";
import { Turn } from "./Turn";

/**
 * Thread log: alternating checkpoints (a row with time and actions) and
 * node records (avatar with the first letter of the name, name, contents).
 * Structure and sizes taken from the reference — docs/DESIGN-TOKENS.md, "Thread log".
 *
 * Container markup mirrors the reference: it renders the log as a virtual list,
 * and tests rely on its labels — scroller outside, the list of turns inside.
 * The reference keeps the first turn's header as a separate pinned block on top;
 * headers of subsequent turns slide over it while scrolling.
 */
export function ThreadLog() {
  // Where the first turn's header goes: the pinned block above the list
  const [top, setTop] = useState<HTMLDivElement | null>(null);
  const history = useStudioStream().history;
  // History is what is already saved on the server; live is the steps of the running run
  // that are not in history yet (it is re-read after completion).
  const live = useRun((s) => s.entries);
  const turns = useMemo(() => splitTurns([...entriesFromHistory(history), ...live]), [history, live]);

  return (
    <div data-testid="virtuoso-scroller" className="flex flex-1 flex-col bg-bg-primary">
      <div className="flex flex-1 flex-col">
        <div ref={setTop} data-testid="virtuoso-top-item-list" className="sticky top-0 z-[1]" />
        <div data-testid="virtuoso-item-list" className="flex flex-1 flex-col">
          {turns.map((turn, i) => (
            <Turn
              key={turn.key}
              index={i + 1}
              entries={turn.entries}
              last={i === turns.length - 1}
              headerHost={i === 0 ? top : null}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
