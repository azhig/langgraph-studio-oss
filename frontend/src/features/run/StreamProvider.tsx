import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import type { ThreadState } from "@langchain/langgraph-sdk";
import { getClient } from "@/api/client";
import { readParam, writeParams } from "@/lib/url";
import { useStudio } from "@/store/studio";
import { errorText, useRun, type TaskEventData } from "@/store/run";
import { branchesByCheckpoint, branchPathOf, type BranchInfo, type TreeSequence } from "@/features/thread/branches";

/**
 * Graph execution stream.
 *
 * All interaction with the server goes through the official `useStream` hook from
 * `@langchain/langgraph-sdk/react`: it creates the thread, submits the run, parses SSE,
 * holds state values, checkpoint history, branches and interrupts, and can
 * reconnect to an unfinished run after a page reload.
 * Here we only subscribe to its events and put into the store what we render:
 * log entries (`tasks`, `checkpoints`) and the name of the running node.
 */

// `messages` is needed for Chat mode: the model's reply is typed out as it is generated,
// and `useStream` itself stitches the chunks into complete state messages. The mode
// is turned off in the panel next to `Submit` — as in the reference.
const STREAM_MODE = ["values", "tasks", "checkpoints"] as const;

/**
 * Common run fields. Taken from the reference: it also subscribes to subgraph events,
 * and a new run in a busy thread rolls back the unfinished one (`rollback`).
 * `streamResumable` allows returning to the run after a page reload.
 */
/**
 * A run failure arrives via the `onError` callback — enough to show the error.
 * The `submit` promise rejection is swallowed right away: it adds nothing, and an unhandled
 * rejection ends up in the console. (The SDK logs the message itself anyway.)
 */
async function runQuietly(run: Promise<unknown>): Promise<void> {
  try {
    await run;
  } catch {
    /* see onError */
  }
}

const runOptions = () => {
  // The assistant configuration goes into the run the same way as in the reference:
  // `config.configurable` with the form values and `recursion_limit`.
  const { config, recursionLimit, tags, messagesStream } = useStudio.getState();
  return {
    streamMode: messagesStream ? [...STREAM_MODE, "messages" as const] : [...STREAM_MODE],
    streamResumable: true,
    streamSubgraphs: true,
    multitaskStrategy: "rollback" as const,
    config: { configurable: { ...config }, recursion_limit: recursionLimit },
    metadata: tags.length ? { tags } : undefined,
  };
};

export interface StudioStream {
  threadId: string | null;
  isLoading: boolean;
  values: Record<string, unknown>;
  /** Thread checkpoints, newest first: the log is built from them. */
  history: ThreadState<Record<string, unknown>>[];
  submit: () => Promise<void>;
  /** Write the input on behalf of a node (`As Node`) and continue the run. */
  submitAsNode: (node: string) => Promise<void>;
  /** Send a message in Chat mode: the same run, but the input is a single message. */
  sendMessage: (text: string) => Promise<void>;
  /** Retry the interrupted step: a run without input continues the thread from the current checkpoint. */
  continueRun: () => Promise<void>;
  /** Answer a dynamic `interrupt()` and continue execution. */
  resume: (value: unknown) => Promise<void>;
  /** Nodes the server will execute next (for the `Continue` button). */
  nextNodes: string[];
  /** The thread's latest checkpoint: only its interrupt is still awaiting a reply. */
  headCheckpointId?: string;
  /** Thread forks: checkpoint → its branch and the sibling ones. */
  branches: Record<string, BranchInfo>;
  /** Switch the displayed branch (a path from `branches`). */
  setBranch: (branch: string) => void;
  /** Re-run from a checkpoint — creates a new branch. */
  rerunFrom: (checkpointId: string) => Promise<void>;
  /** Write values on behalf of a node at a checkpoint — also creates a branch. */
  forkState: (checkpointId: string, asNode: string, values: Record<string, unknown>) => Promise<void>;
  stop: () => Promise<void>;
  newThread: () => void;
  openThread: (threadId: string) => void;
}

const Ctx = createContext<StudioStream | null>(null);

/** The thread id lives in the URL — as in the reference. */
const threadFromUrl = () => readParam("threadId");
const writeThreadToUrl = (threadId: string | null) => writeParams({ threadId });

export function StreamProvider({ children }: { children: ReactNode }) {
  const assistantId = useStudio((s) => s.assistantId);
  const [threadId, setThreadId] = useState<string | null>(threadFromUrl);
  // The new branch's checkpoint to switch to once the history is re-read
  const pendingBranch = useRef<string | null>(null);
  const prevAssistant = useRef(assistantId);

  const stream = useStream({
    client: getClient(),
    assistantId: assistantId ?? "",
    threadId,
    onThreadId: (id) => {
      setThreadId(id);
      writeThreadToUrl(id);
    },
    reconnectOnMount: true,
    // By default the SDK takes the last 10 checkpoints; the log needs the whole run
    fetchStateHistory: { limit: 200 },
    onCheckpointEvent: (data) =>
      useRun.getState().addCheckpoint({
        checkpointId: (data.config as { configurable?: { checkpoint_id?: string } } | undefined)?.configurable
          ?.checkpoint_id,
        values: data.values,
        source: (data.metadata as { source?: string } | undefined)?.source,
      }),
    onTaskEvent: (data) => useRun.getState().addTask(data as unknown as TaskEventData),
    onError: (error) => useRun.getState().setError(error instanceof Error ? error.message : errorText(error)),
  });

  // Node highlighting on the canvas and the Submit button's look depend on whether a run is in progress
  useEffect(() => {
    useRun.getState().setRunning(stream.isLoading);
  }, [stream.isLoading]);

  // While a run is in progress, the log is drawn from stream events; once the server has returned
  // the thread history, the same steps come from it — temporary entries are removed to avoid duplicates.
  // The failed node comes from there too: it stays highlighted with an `Error` badge.
  useEffect(() => {
    if (stream.isLoading || !stream.history.length) return;
    const run = useRun.getState();
    run.clearLog();
    const head = stream.history.at(-1);
    const failed = head?.tasks?.find((t) => t.error);
    if (failed) run.setErrorNode(failed.name, errorText(failed.error));
  }, [stream.history, stream.isLoading]);

  // Switching the assistant starts everything over: another graph means another thread and another log
  useEffect(() => {
    if (prevAssistant.current && assistantId && prevAssistant.current !== assistantId) {
      setThreadId(null);
      writeThreadToUrl(null);
      useRun.getState().clearLog();
    }
    prevAssistant.current = assistantId;
  }, [assistantId]);

  // Editing the state creates a branch — show it as soon as the history is re-read
  useEffect(() => {
    const wanted = pendingBranch.current;
    if (!wanted) return;
    const path = branchPathOf(stream.experimental_branchTree as TreeSequence, wanted);
    if (path === undefined) return;
    stream.setBranch(path);
    pendingBranch.current = null;
  }, [stream]);

  const submit = useCallback(async () => {
    const run = useRun.getState();
    const { input, error } = run.buildInput();
    if (error || !input) {
      run.setInputError(error);
      return;
    }
    run.setInputError(undefined);
    run.setError(undefined);
    run.rememberInput();
    run.setPendingStart(input);
    run.resetInput();
    await runQuietly(
      stream.submit(input, {
        ...runOptions(),
        interruptBefore: run.interruptBefore.length ? run.interruptBefore : undefined,
        interruptAfter: run.interruptAfter.length ? run.interruptAfter : undefined,
      }),
    );
  }, [stream]);

  /**
   * `As Node` next to `Submit`: the thread is idle, and the input must be written not as a new run
   * but as the result of the selected node. The reference does exactly this — `updateState` on behalf
   * of the node at the current checkpoint, followed by a regular run continuation.
   */
  const submitAsNode = useCallback(
    async (asNode: string) => {
      const run = useRun.getState();
      const { input, error } = run.buildInput();
      if (error || !input) {
        run.setInputError(error);
        return;
      }
      const checkpointId = stream.history.at(-1)?.checkpoint?.checkpoint_id;
      if (!threadId || !checkpointId) return;
      run.setInputError(undefined);
      run.setError(undefined);
      run.rememberInput();
      run.resetInput();
      await getClient().threads.updateState(threadId, { values: input, asNode, checkpointId });
      await runQuietly(stream.submit(null, { ...runOptions() }));
    },
    [stream, threadId],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      useRun.getState().setError(undefined);
      // The reference sends the content as blocks, not as a string
      await runQuietly(
        stream.submit({ messages: [{ type: "human", content: [{ type: "text", text }] }] }, runOptions()),
      );
    },
    [stream],
  );

  const continueRun = useCallback(async () => {
    const run = useRun.getState();
    run.setError(undefined);
    await runQuietly(
      stream.submit(null, {
        ...runOptions(),
        interruptBefore: run.interruptBefore.length ? run.interruptBefore : undefined,
        interruptAfter: run.interruptAfter.length ? run.interruptAfter : undefined,
      }),
    );
  }, [stream]);

  const resume = useCallback(
    async (value: unknown) => {
      useRun.getState().setError(undefined);
      await runQuietly(stream.submit(undefined, { ...runOptions(), command: { resume: value } }));
    },
    [stream],
  );

  const rerunFrom = useCallback(
    async (checkpointId: string) => {
      useRun.getState().setError(undefined);
      await runQuietly(
        stream.submit(null, {
          ...runOptions(),
          // The server does not accept null in checkpoint_map, so an empty map
          checkpoint: { checkpoint_id: checkpointId, checkpoint_ns: "", checkpoint_map: {} },
        }),
      );
    },
    [stream],
  );

  const forkState = useCallback(
    async (checkpointId: string, asNode: string, values: Record<string, unknown>) => {
      if (!threadId) return;
      const config = await getClient().threads.updateState(threadId, { values, checkpointId, asNode });
      const created = (config.configurable as { checkpoint_id?: string } | undefined)?.checkpoint_id;
      if (!created) return;
      pendingBranch.current = created;
      // The reference does not leave the branch waiting: it continues the run from the new checkpoint right away.
      // `useStream` re-reads the history afterwards itself — threadId must not be touched,
      // otherwise the stream is recreated and the run is cut off.
      await runQuietly(
        stream.submit(null, {
          ...runOptions(),
          checkpoint: { checkpoint_id: created, checkpoint_ns: "", checkpoint_map: {} },
        }),
      );
    },
    [stream, threadId],
  );

  const stop = useCallback(async () => {
    useRun.getState().setError("Run cancelled");
    await stream.stop();
  }, [stream]);

  const newThread = useCallback(() => {
    setThreadId(null);
    writeThreadToUrl(null);
    useRun.getState().clearLog();
  }, []);

  const openThread = useCallback((id: string) => {
    setThreadId(id);
    writeThreadToUrl(id);
    useRun.getState().clearLog();
  }, []);

  const value = useMemo<StudioStream>(
    () => ({
      threadId,
      isLoading: stream.isLoading,
      values: stream.values as Record<string, unknown>,
      history: stream.history as ThreadState<Record<string, unknown>>[],
      nextNodes: stream.history.at(-1)?.next ?? [],
      headCheckpointId: stream.history.at(-1)?.checkpoint?.checkpoint_id ?? undefined,
      branches: branchesByCheckpoint(stream.experimental_branchTree as TreeSequence),
      setBranch: stream.setBranch,
      rerunFrom,
      forkState,
      submit,
      submitAsNode,
      sendMessage,
      continueRun,
      resume,
      stop,
      newThread,
      openThread,
    }),
    [
      threadId,
      stream.isLoading,
      stream.values,
      stream.history,
      stream.experimental_branchTree,
      stream.setBranch,
      rerunFrom,
      forkState,
      submit,
      submitAsNode,
      sendMessage,
      continueRun,
      resume,
      stop,
      newThread,
      openThread,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStudioStream(): StudioStream {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStudioStream must be used inside <StreamProvider>");
  return ctx;
}
