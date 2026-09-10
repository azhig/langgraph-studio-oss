import { describe, expect, it } from "vitest";
import type { ThreadState } from "@langchain/langgraph-sdk";
import { entriesFromHistory, splitTurns } from "./history";

const state = (
  id: string,
  extra: { source?: string; tasks?: Array<Record<string, unknown>>; next?: string[] } = {},
): ThreadState<Record<string, unknown>> =>
  ({
    checkpoint: { checkpoint_id: id, checkpoint_ns: "" },
    created_at: "2026-09-10T10:00:00.000Z",
    values: { n: id },
    next: extra.next ?? [],
    metadata: extra.source ? { source: extra.source } : {},
    tasks: extra.tasks ?? [],
  }) as unknown as ThreadState<Record<string, unknown>>;

/** One turn: input checkpoint with `__start__`, then a checkpoint with node `agent`, then the final one. */
const HISTORY = [
  state("c1", { source: "input", tasks: [{ id: "t1", name: "__start__", result: { q: 1 } }] }),
  state("c2", { source: "loop", tasks: [{ id: "t2", name: "agent", result: [["messages", ["hi"]]] }] }),
  state("c3", { source: "loop" }),
];

describe("entriesFromHistory", () => {
  it("alternates checkpoints and node records, marking the turn start and the root", () => {
    const entries = entriesFromHistory(HISTORY);
    expect(entries.map((e) => e.kind)).toEqual(["checkpoint", "node", "checkpoint", "node", "checkpoint"]);
    const [c1, start, , agent] = entries;
    expect(c1).toMatchObject({ checkpointId: "c1", turnStart: true, root: true });
    expect(start).toMatchObject({ node: "__start__", taskId: "t1", checkpointId: "c1", updates: { q: 1 }, done: true });
    // A result given as [channel, value] pairs is converted to an object
    expect(agent).toMatchObject({ node: "agent", updates: { messages: ["hi"] } });
    expect(entries[2]).toMatchObject({ turnStart: false, root: false });
  });

  it("carries task error and subgraph into the record", () => {
    const [, entry] = entriesFromHistory([
      state("c1", {
        tasks: [
          {
            id: "t",
            name: "worker",
            error: { error: "ValueError", message: "boom" },
            checkpoint: { checkpoint_ns: "worker:t" },
          },
        ],
      }),
    ]);
    expect(entry).toMatchObject({ kind: "node", error: "ValueError: boom", subgraphNs: "worker:t" });
  });
});

describe("splitTurns", () => {
  it("splits the log at input checkpoints", () => {
    const entries = entriesFromHistory([...HISTORY, state("c4", { source: "input" }), state("c5")]);
    const turns = splitTurns(entries);
    expect(turns).toHaveLength(2);
    expect(turns[0].key).toBe("cp:c1");
    expect(turns[1].key).toBe("cp:c4");
    expect(turns[1].entries).toHaveLength(2);
  });

  it("a log without an input checkpoint still forms a turn", () => {
    expect(splitTurns(entriesFromHistory([state("x")]))).toHaveLength(1);
    expect(splitTurns([])).toEqual([]);
  });
});
