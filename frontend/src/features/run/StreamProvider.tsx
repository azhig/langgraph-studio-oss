import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import type { ThreadState } from "@langchain/langgraph-sdk";
import { getClient } from "@/api/client";
import { useStudio } from "@/store/studio";
import { errorText, useRun, type TaskEventData } from "@/store/run";
import {
  branchesByCheckpoint,
  branchPathOf,
  type BranchInfo,
  type TreeSequence,
} from "@/features/thread/branches";

/**
 * Поток выполнения графа.
 *
 * Всё взаимодействие с сервером ведёт официальный хук `useStream` из
 * `@langchain/langgraph-sdk/react`: он создаёт тред, отправляет запуск, разбирает SSE,
 * держит значения состояния, историю контрольных точек, ветки и прерывания, умеет
 * переподключаться к незавершённому прогону при перезагрузке страницы.
 * Здесь мы только подписываемся на его события и складываем в стор то, что рисуем:
 * записи лога (`tasks`, `checkpoints`) и имя работающего узла.
 */

// `messages` нужен ради Chat mode: ответ модели печатается по мере генерации,
// а `useStream` сам склеивает куски в готовые сообщения состояния. Режим
// выключается в панели рядом с `Submit` — как в эталоне.
const STREAM_MODE = ["values", "tasks", "checkpoints"] as const;

/**
 * Общие поля запуска. Сняты с эталона: он подписывается и на события подграфов,
 * а новый запуск в занятом треде откатывает незаконченный (`rollback`).
 * `streamResumable` позволяет вернуться к прогону после перезагрузки страницы.
 */
/**
 * Сбой прогона приходит колбэком `onError` — этого хватает, чтобы показать ошибку.
 * Отказ промиса `submit` тут же гасим: он ничего не добавляет, а необработанное
 * отклонение попадает в консоль. (Само сообщение SDK всё равно пишет от себя.)
 */
async function runQuietly(run: Promise<unknown>): Promise<void> {
  try {
    await run;
  } catch {
    /* см. onError */
  }
}

const runOptions = () => {
  // Конфигурация ассистента уходит в запуск так же, как в эталоне:
  // `config.configurable` со значениями формы и `recursion_limit`.
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
  /** Контрольные точки треда, от новых к старым: из них строится лог. */
  history: ThreadState<Record<string, unknown>>[];
  submit: () => Promise<void>;
  /** Записать введённое от имени узла (`As Node`) и продолжить прогон. */
  submitAsNode: (node: string) => Promise<void>;
  /** Отправить сообщение в Chat mode: тот же запуск, но ввод — одно сообщение. */
  sendMessage: (text: string) => Promise<void>;
  /** Повторить прерванный шаг: запуск без ввода продолжает тред с текущей точки. */
  continueRun: () => Promise<void>;
  /** Ответить на динамическое прерывание `interrupt()` и продолжить выполнение. */
  resume: (value: unknown) => Promise<void>;
  /** Узлы, которые сервер выполнит следующими (для кнопки `Continue`). */
  nextNodes: string[];
  /** Последняя точка сохранения треда: только её прерывание ещё ждёт ответа. */
  headCheckpointId?: string;
  /** Развилки треда: контрольная точка → её ветка и соседние. */
  branches: Record<string, BranchInfo>;
  /** Переключить показанную ветку (путь из `branches`). */
  setBranch: (branch: string) => void;
  /** Запустить заново с контрольной точки — создаёт новую ветку. */
  rerunFrom: (checkpointId: string) => Promise<void>;
  /** Записать значения от имени узла в точке — тоже создаёт ветку. */
  forkState: (checkpointId: string, asNode: string, values: Record<string, unknown>) => Promise<void>;
  stop: () => Promise<void>;
  newThread: () => void;
  openThread: (threadId: string) => void;
}

const Ctx = createContext<StudioStream | null>(null);

/** Идентификатор треда живёт в адресной строке — как в эталоне. */
function threadFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get("threadId");
}

function writeThreadToUrl(threadId: string | null) {
  const url = new URL(window.location.href);
  if (threadId) url.searchParams.set("threadId", threadId);
  else url.searchParams.delete("threadId");
  window.history.replaceState(null, "", url);
}

export function StreamProvider({ children }: { children: ReactNode }) {
  const assistantId = useStudio((s) => s.assistantId);
  const [threadId, setThreadId] = useState<string | null>(threadFromUrl);
  // Точка новой ветки, на которую нужно переключиться, когда история перечитается
  const [pendingBranch, setPendingBranch] = useState<string | null>(null);
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
    // По умолчанию SDK берёт 10 последних точек; для лога нужен весь ход целиком
    fetchStateHistory: { limit: 200 },
    onCheckpointEvent: (data) =>
      useRun.getState().addCheckpoint({
        checkpointId: (data.config as { configurable?: { checkpoint_id?: string } } | undefined)?.configurable
          ?.checkpoint_id,
        values: data.values,
        source: (data.metadata as { source?: string } | undefined)?.source,
      }),
    onTaskEvent: (data) => useRun.getState().addTask(data as unknown as TaskEventData),
    onError: (error) =>
      useRun.getState().setError(error instanceof Error ? error.message : errorText(error)),
  });

  // Подсветка узлов на холсте и вид кнопки Submit зависят от того, идёт ли прогон
  useEffect(() => {
    useRun.getState().setRunning(stream.isLoading);
  }, [stream.isLoading]);

  // Пока идёт прогон, лог рисуется по событиям потока; когда сервер отдал историю
  // треда, те же шаги приходят из неё — временные записи убираем, чтобы не двоились.
  // Оттуда же берём сорвавшийся узел: он остаётся подсвеченным с бейджем `Error`.
  useEffect(() => {
    if (stream.isLoading || !stream.history.length) return;
    const run = useRun.getState();
    run.clearLog();
    const head = stream.history.at(-1);
    const failed = head?.tasks?.find((t) => t.error);
    if (failed) run.setErrorNode(failed.name, errorText(failed.error));
  }, [stream.history, stream.isLoading]);

  // Смена ассистента начинает всё заново: другой граф — другой тред и другой лог
  useEffect(() => {
    if (prevAssistant.current && assistantId && prevAssistant.current !== assistantId) {
      setThreadId(null);
      writeThreadToUrl(null);
      useRun.getState().clearLog();
    }
    prevAssistant.current = assistantId;
  }, [assistantId]);

  // Правка состояния создаёт ветку — показываем её, как только история перечитана
  useEffect(() => {
    if (!pendingBranch) return;
    const path = branchPathOf(stream.experimental_branchTree as TreeSequence, pendingBranch);
    if (path === undefined) return;
    stream.setBranch(path);
    setPendingBranch(null);
  }, [pendingBranch, stream]);

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
   * `As Node` рядом с `Submit`: тред стоит, и ввод нужно записать не как новый запуск,
   * а как результат выбранного узла. Эталон делает ровно это — `updateState` от имени
   * узла в текущей точке, а следом обычное продолжение прогона.
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
      // Эталон отправляет содержимое блоками, а не строкой
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
          // Сервер не принимает null в checkpoint_map, поэтому пустая карта
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
      setPendingBranch(created);
      // Эталон не оставляет ветку ждать: сразу продолжает прогон с новой точки.
      // Историю после этого перечитает сам `useStream` — трогать threadId не нужно,
      // иначе поток пересоздастся и запуск оборвётся.
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
