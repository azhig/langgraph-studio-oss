import type { StateCreator } from "zustand";
import { readJson, storageKeys, writeJson } from "@/lib/storage";
import { useStudio } from "@/store/studio";

/**
 * Static interrupts: nodes before and after which the run pauses.
 * Bound to the assistant and survive a reload — as in the reference.
 */
export interface InterruptsSlice {
  interruptBefore: string[];
  interruptAfter: string[];
  toggleInterrupt: (node: string, when: "before" | "after") => void;
  /**
   * Bottom item of the `Interrupts` menu: while there are no pauses, "Interrupt on all" pauses
   * before every node; once at least one is enabled, the item becomes "Clear all"
   * and removes them all at once — both `before` and `after`.
   */
  interruptAll: (nodes: string[]) => void;
  /** Read the pause set of the selected assistant: each has its own. */
  loadInterrupts: (assistantId?: string) => void;
}

interface Saved {
  before?: string[];
  after?: string[];
}

export const createInterruptsSlice: StateCreator<InterruptsSlice, [], [], InterruptsSlice> = (set) => {
  const persist = (before: string[], after: string[]) => {
    writeJson(storageKeys.interrupts(useStudio.getState().assistantId), { before, after });
    return { interruptBefore: before, interruptAfter: after };
  };
  return {
    interruptBefore: [],
    interruptAfter: [],

    toggleInterrupt: (node, when) =>
      set((s) => {
        const list = when === "before" ? s.interruptBefore : s.interruptAfter;
        const next = list.includes(node) ? list.filter((n) => n !== node) : [...list, node];
        return persist(when === "before" ? next : s.interruptBefore, when === "after" ? next : s.interruptAfter);
      }),

    interruptAll: (nodes) =>
      set((s) => {
        const clear = s.interruptBefore.length > 0 || s.interruptAfter.length > 0;
        return persist(clear ? [] : [...nodes], clear ? [] : [...nodes]);
      }),

    loadInterrupts: (assistantId) => {
      const saved = readJson<Saved>(storageKeys.interrupts(assistantId), {});
      set({ interruptBefore: saved.before ?? [], interruptAfter: saved.after ?? [] });
    },
  };
};
