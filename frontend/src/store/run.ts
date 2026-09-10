import { create } from "zustand";
import type { GraphSchema } from "@langchain/langgraph-sdk";
import { useStudio } from "./studio";
import { defaultValue, inputFields, parseText, toText, type Lang } from "@/features/input/format";

/**
 * Состояние экрана прогона: форма ввода, лог треда и подсветка узлов.
 *
 * Сам поток событий ведёт официальный хук `useStream` из `@langchain/langgraph-sdk/react`
 * (см. features/run/StreamProvider.tsx). Он же держит значения состояния, историю
 * контрольных точек и ветки; сюда из его колбэков попадает то, что нужно нарисовать:
 * записи лога и имя работающего узла.
 */

export interface CheckpointEntry {
  kind: "checkpoint";
  key: string;
  ts: number;
  checkpointId?: string;
  values?: unknown;
  /** Первая точка запуска: с неё начинается очередной ход (`TURN N`). */
  turnStart?: boolean;
  /** Самая первая точка треда: с неё нельзя перезапуститься. */
  root?: boolean;
  /** Узлы, которые выполнятся из этой точки, её задачи и метаданные — для вкладки JSON. */
  next?: string[];
  tasks?: unknown[];
  metadata?: Record<string, unknown>;
}

export interface NodeEntry {
  kind: "node";
  key: string;
  node: string;
  taskId?: string;
  /** Точка сохранения, из которой узел запускался: нужна для правки состояния. */
  checkpointId?: string;
  ts: number;
  /** Что узел записал в состояние. */
  updates?: Record<string, unknown>;
  error?: string;
  /** Динамические прерывания `interrupt()`, на которых узел остановился. */
  interrupts?: Array<{ id?: string; value: unknown }>;
  /**
   * Пространство имён подграфа (`<узел>:<id задачи>`), если за узлом стоит подграф.
   * По нему запрашивается история подграфа — вложенный лог внутри записи.
   */
  subgraphNs?: string;
  done: boolean;
}

export type LogEntry = CheckpointEntry | NodeEntry;

export interface TaskEventData {
  id: string;
  name: string;
  input?: unknown;
  result?: Record<string, unknown> | Array<[string, unknown]>;
  /** В истории треда ошибка приходит строкой, в событии потока — парой тип/сообщение. */
  error?: string | { error?: string; message?: string } | null;
  interrupts?: unknown[];
}

/** Приводит ошибку к строке: показывать объект в логе нельзя, да и незачем. */
export function errorText(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const { error, message } = value as { error?: string; message?: string };
    if (error && message) return `${error}: ${message}`;
    if (message) return message;
    if (error) return error;
  }
  return String(value);
}

interface RunState {
  /** Текст полей ввода и выбранный язык на каждое поле. */
  inputText: Record<string, string>;
  inputLang: Record<string, Lang>;
  /** Отправленные вводы, для кнопок ↑ / ↓ рядом с заголовком `Input`. */
  history: Record<string, string>[];
  historyIndex: number;

  entries: LogEntry[];
  running: boolean;
  /**
   * Слайдер детализации лога: 0 — сводка хода, 1 — записи узлов, 2 — их содержимое,
   * 3 — раскрытые значения целиком. Уровень запоминается между сеансами.
   */
  detail: Detail;
  /** Узлы, перед которыми и после которых прогон должен вставать на паузу. */
  interruptBefore: string[];
  interruptAfter: string[];
  pendingStart?: Record<string, unknown>;
  /** Узел, который выполняется прямо сейчас: он остаётся ярким, остальные гаснут. */
  activeNode?: string;
  /** Узел, на котором прогон оборвался (бейдж `Error` справа от узла). */
  errorNode?: string;
  /**
   * Узел под курсором: наведение на запись лога подсвечивает его на холсте,
   * а остальные узлы гасит до 30 % — так делает эталон.
   */
  hoverNode?: string;
  /** Ошибка прогона: показывается плашкой у сорвавшегося узла в логе. */
  error?: string;
  /** Ошибка разбора формы ввода: показывается в подвале карточки `Input`. */
  inputError?: string;

  setInput: (key: string, text: string) => void;
  setLang: (key: string, lang: Lang) => void;
  /** Заполняет форму значениями по умолчанию из input_schema. */
  initInput: (schemas?: GraphSchema) => void;
  /** Очищает поля после отправки, сохраняя историю ввода (так делает эталон). */
  resetInput: () => void;
  stepHistory: (delta: number) => void;
  rememberInput: () => void;
  /** Собирает объект ввода; при ошибке разбора возвращает сообщение. */
  buildInput: () => { input?: Record<string, unknown>; error?: string };

  addCheckpoint: (cp: { checkpointId?: string; values?: unknown; source?: string }) => void;
  /** Ввод текущего запуска: показывается записью `__start__` после первой точки сохранения. */
  setPendingStart: (input?: Record<string, unknown>) => void;
  addTask: (task: TaskEventData) => void;
  setRunning: (running: boolean) => void;
  setDetail: (detail: Detail) => void;
  toggleInterrupt: (node: string, when: "before" | "after") => void;
  interruptAll: (nodes: string[]) => void;
  setError: (message?: string) => void;
  setInputError: (message?: string) => void;
  /** Узел, на котором остановился тред: подсвечивается бейджем `Error`. */
  setErrorNode: (node?: string, message?: string) => void;
  setHoverNode: (node?: string) => void;
  clearLog: () => void;
}

export type Detail = 0 | 1 | 2 | 3;

/** Уровень детализации лога живёт между сеансами — как в эталоне. */
const DETAIL_KEY = "ls:studio:traceLogInfoLevel";

function readDetail(): Detail {
  try {
    const saved = Number(localStorage.getItem(DETAIL_KEY));
    if (saved === 0 || saved === 1 || saved === 2 || saved === 3) return saved;
  } catch {
    /* приватный режим — просто без запоминания */
  }
  return 1;
}

let seq = 0;
const nextKey = () => `e${++seq}`;

/** Прерывания привязаны к ассистенту и переживают перезагрузку — как в эталоне. */
const interruptsKey = (assistantId?: string) => `ls:studio:${assistantId ?? "unknown"}:interrupts`;

function readInterrupts(assistantId?: string): { before: string[]; after: string[] } {
  try {
    const raw = JSON.parse(localStorage.getItem(interruptsKey(assistantId)) ?? "{}") as {
      before?: string[];
      after?: string[];
    };
    return { before: raw.before ?? [], after: raw.after ?? [] };
  } catch {
    return { before: [], after: [] };
  }
}

function writeInterrupts(assistantId: string | undefined, before: string[], after: string[]) {
  try {
    localStorage.setItem(interruptsKey(assistantId), JSON.stringify({ before, after }));
  } catch {
    /* приватный режим — настройка не переживёт перезагрузку */
  }
}

export const useRun = create<RunState>((set, get) => ({
  inputText: {},
  inputLang: {},
  history: [],
  historyIndex: -1,
  entries: [],
  running: false,
  detail: readDetail(),
  interruptBefore: [],
  interruptAfter: [],

  setInput: (key, text) => set((s) => ({ inputText: { ...s.inputText, [key]: text } })),
  setLang: (key, lang) =>
    set((s) => {
      // Переключение языка сохраняет значение: разбираем старым, печатаем новым
      const prev = s.inputLang[key] ?? "yaml";
      if (prev === lang) return s;
      const parsed = parseText(s.inputText[key] ?? "", prev);
      const text = parsed.error ? (s.inputText[key] ?? "") : toText(parsed.value, lang);
      return { inputLang: { ...s.inputLang, [key]: lang }, inputText: { ...s.inputText, [key]: text } };
    }),

  initInput: (schemas) => {
    const inputText: Record<string, string> = {};
    const inputLang: Record<string, Lang> = {};
    for (const f of inputFields(schemas?.input_schema)) {
      inputText[f.key] = toText(defaultValue(f.schema), "yaml");
      inputLang[f.key] = "yaml";
    }
    set({ inputText, inputLang, history: [], historyIndex: -1 });
  },

  resetInput: () => {
    const { schemas } = useStudio.getState();
    const inputText: Record<string, string> = {};
    for (const f of inputFields(schemas?.input_schema)) {
      inputText[f.key] = toText(defaultValue(f.schema), get().inputLang[f.key] ?? "yaml");
    }
    set({ inputText });
  },

  stepHistory: (delta) => {
    const { history, historyIndex } = get();
    if (!history.length) return;
    const i = Math.min(history.length - 1, Math.max(0, historyIndex + delta));
    set({ historyIndex: i, inputText: { ...history[i] } });
  },

  rememberInput: () =>
    set((s) => ({ history: [...s.history, { ...s.inputText }], historyIndex: s.history.length })),

  buildInput: () => {
    const { schemas } = useStudio.getState();
    const { inputText, inputLang } = get();
    const input: Record<string, unknown> = {};
    for (const f of inputFields(schemas?.input_schema)) {
      const parsed = parseText(inputText[f.key] ?? "", inputLang[f.key] ?? "yaml");
      if (parsed.error) return { error: `${f.title}: ${parsed.error}` };
      if (parsed.value !== undefined) input[f.key] = parsed.value;
    }
    return { input };
  },

  addCheckpoint: ({ checkpointId, values, source }) =>
    set((s) => {
      const ts = Date.now();
      const entries: LogEntry[] = [
        ...s.entries,
        { kind: "checkpoint", key: nextKey(), ts, checkpointId, values, turnStart: source === "input" },
      ];
      // Первая точка сохранения открывает ход: сразу за ней эталон показывает
      // запись `__start__` с тем, что отправил пользователь.
      if (source === "input" && s.pendingStart) {
        entries.push({
          kind: "node",
          key: nextKey(),
          node: "__start__",
          ts,
          updates: s.pendingStart,
          done: true,
        });
      }
      return { entries, pendingStart: source === "input" ? undefined : s.pendingStart };
    }),

  setPendingStart: (pendingStart) => set({ pendingStart }),

  /**
   * Событие задачи приходит дважды: при постановке (есть `input`) и по завершении
   * (есть `result` или `error`). Первое создаёт запись лога, второе её дополняет.
   */
  addTask: (task) => {
    const failure = errorText(task.error);
    const finished = "result" in task || failure !== undefined;
    if (!finished) {
      set((s) => ({
        entries: [
          ...s.entries,
          { kind: "node", key: nextKey(), node: task.name, taskId: task.id, ts: Date.now(), done: false },
        ],
        activeNode: task.name,
      }));
      return;
    }
    const updates = Array.isArray(task.result)
      ? Object.fromEntries(task.result)
      : (task.result as Record<string, unknown> | undefined);
    set((s) => ({
      entries: s.entries.map((e) =>
        e.kind === "node" && e.taskId === task.id ? { ...e, updates, done: true, error: failure } : e,
      ),
      activeNode: s.activeNode === task.name ? undefined : s.activeNode,
      errorNode: failure ? task.name : s.errorNode,
      error: failure ?? s.error,
    }));
  },

  setRunning: (running) =>
    set((s) => ({ running, activeNode: running ? s.activeNode : undefined })),

  setDetail: (detail) => {
    try {
      localStorage.setItem(DETAIL_KEY, String(detail));
    } catch {
      /* см. readDetail */
    }
    set({ detail });
  },

  toggleInterrupt: (node, when) =>
    set((s) => {
      const key = when === "before" ? "interruptBefore" : "interruptAfter";
      const list = s[key];
      const next = list.includes(node) ? list.filter((n) => n !== node) : [...list, node];
      const before = when === "before" ? next : s.interruptBefore;
      const after = when === "after" ? next : s.interruptAfter;
      writeInterrupts(useStudio.getState().assistantId, before, after);
      return { interruptBefore: before, interruptAfter: after };
    }),

  /**
   * Нижний пункт меню `Interrupts`: пока пауз нет — «Interrupt on all» ставит паузу
   * перед каждым узлом; как только хоть одна включена, пункт становится «Clear all»
   * и снимает разом все — и `before`, и `after`.
   */
  interruptAll: (nodes) =>
    set((s) => {
      const clear = s.interruptBefore.length > 0 || s.interruptAfter.length > 0;
      const before = clear ? [] : [...nodes];
      const after = clear ? [] : [...nodes];
      writeInterrupts(useStudio.getState().assistantId, before, after);
      return { interruptBefore: before, interruptAfter: after };
    }),

  setError: (message) => set((s) => ({ error: message, errorNode: message ? s.activeNode : undefined })),

  setErrorNode: (errorNode, error) => set({ errorNode, error }),

  setHoverNode: (hoverNode) => set({ hoverNode }),

  setInputError: (inputError) => set({ inputError }),

  clearLog: () =>
    set({ entries: [], activeNode: undefined, errorNode: undefined, error: undefined, pendingStart: undefined }),
}));

/** Ввод принадлежит графу: при смене ассистента форма и лог начинаются заново. */
useStudio.subscribe((s, prev) => {
  if (s.assistantId !== prev.assistantId) {
    // Прерывания названы узлами этого графа: у каждого ассистента свой набор
    const saved = readInterrupts(s.assistantId);
    useRun.setState({ interruptBefore: saved.before, interruptAfter: saved.after });
    useRun.getState().clearLog();
  }
  if (s.schemas !== prev.schemas && s.schemas) useRun.getState().initInput(s.schemas);
});
