import { create } from "zustand";
import { useStudio } from "@/store/studio";
import { createInputSlice, type InputSlice } from "./inputSlice";
import { createInterruptsSlice, type InterruptsSlice } from "./interruptsSlice";
import { createLogSlice, type LogSlice } from "./logSlice";

export type { CheckpointEntry, Detail, Interrupt, LogEntry, NodeEntry, TaskEventData } from "./types";
export { asUpdates, errorText } from "./types";

/**
 * Run screen state: input form, thread log with node highlighting and
 * static interrupts. Assembled from three slices — each with its own concern,
 * while components read them through one hook.
 */
export type RunState = InputSlice & LogSlice & InterruptsSlice;

export const useRun = create<RunState>()((...args) => ({
  ...createInputSlice(...args),
  ...createLogSlice(...args),
  ...createInterruptsSlice(...args),
}));

/** Input belongs to the graph: switching assistants resets the form, log and pauses. */
useStudio.subscribe((s, prev) => {
  if (s.assistantId !== prev.assistantId) {
    const run = useRun.getState();
    run.loadInterrupts(s.assistantId);
    run.clearLog();
  }
  if (s.schemas !== prev.schemas && s.schemas) useRun.getState().initInput(s.schemas);
});
