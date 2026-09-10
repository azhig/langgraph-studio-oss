import { create } from "zustand";
import type { Assistant, AssistantGraph, GraphSchema } from "@langchain/langgraph-sdk";
import { fetchInfo, getClient, type ServerInfo } from "@/api/client";
import { defaultConfig } from "@/features/assistants/config";

export type Theme = "dark" | "light";
export type ViewMode = "graph" | "chat";
export type RightTab = "interact" | "trace";

const THEME_KEY = "studio.theme";

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    /* приватный режим — просто без запоминания */
  }
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* см. выше */
  }
}

function readMode(): ViewMode {
  return new URLSearchParams(window.location.search).get("mode") === "chat" ? "chat" : "graph";
}

export type ConnectionState = "connecting" | "connected" | "error";

interface StudioState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;

  connection: ConnectionState;
  connectionError?: string;
  info?: ServerInfo;

  assistants: Assistant[];
  assistantId?: string;
  graph?: AssistantGraph;
  /** Тот же граф с раскрытыми подграфами (`xray`): из него берутся вложенные узлы. */
  xrayGraph?: AssistantGraph;
  /** Узлы, за которыми стоит подграф: их можно раскрыть на холсте. */
  subgraphs: string[];
  /** Какие подграфы сейчас раскрыты. */
  expandedSubgraphs: string[];
  toggleSubgraph: (node: string) => void;
  /** Свернуть все подграфы — так делает `Reset layout to default`. */
  collapseSubgraphs: () => void;
  schemas?: GraphSchema;

  /**
   * Значения `configurable` для запусков. Берутся из выбранного ассистента,
   * а если тот ничего не задал — из умолчаний `config_schema` (в эталоне это
   * `Default Configuration`). Правятся в модалке `Manage Assistants`.
   */
  config: Record<string, unknown>;
  /** `recursion_limit` запуска: в эталоне это поле стоит в той же форме. */
  recursionLimit: number;
  /** Метки прогона (`tags`) — попадают в metadata запуска. */
  tags: string[];
  setConfig: (config: Record<string, unknown>) => void;
  /** Открыта ли модалка `Manage Assistants` (её зовут и из настроек узла). */
  assistantsOpen: boolean;
  setAssistantsOpen: (open: boolean) => void;
  /**
   * Режим потока `messages`: сообщения приходят кусками, даже если модель
   * вызвана через `invoke()`. Переключается в панели рядом с `Submit`.
   */
  messagesStream: boolean;
  setMessagesStream: (on: boolean) => void;
  setRecursionLimit: (limit: number) => void;
  setTags: (tags: string[]) => void;

  mode: ViewMode;
  setMode: (m: ViewMode) => void;
  rightTab: RightTab;
  setRightTab: (t: RightTab) => void;

  /** Первичная загрузка: /info, список ассистентов, граф и схемы активного. */
  bootstrap: () => Promise<void>;
  selectAssistant: (id: string) => Promise<void>;
  /** Перечитать список ассистентов (после создания, правки или удаления). */
  reloadAssistants: () => Promise<void>;
  createAssistant: (name: string, config: Record<string, unknown>) => Promise<Assistant | undefined>;
  /** Откатить ассистента на выбранную версию (правка каждый раз создаёт новую). */
  setAssistantVersion: (id: string, version: number) => Promise<void>;
  saveAssistant: (id: string, name: string, config: Record<string, unknown>) => Promise<void>;
  deleteAssistant: (id: string) => Promise<void>;
}

export const useStudio = create<StudioState>((set, get) => ({
  theme: readTheme(),
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),

  connection: "connecting",
  assistants: [],
  subgraphs: [],
  expandedSubgraphs: [],
  toggleSubgraph: (node) =>
    set((s) => ({
      expandedSubgraphs: s.expandedSubgraphs.includes(node)
        ? s.expandedSubgraphs.filter((n) => n !== node)
        : [...s.expandedSubgraphs, node],
    })),
  collapseSubgraphs: () => set({ expandedSubgraphs: [] }),
  config: {},
  recursionLimit: 25,
  tags: [],
  setConfig: (config) => set({ config }),
  assistantsOpen: false,
  setAssistantsOpen: (assistantsOpen) => set({ assistantsOpen }),
  messagesStream: true,
  setMessagesStream: (messagesStream) => set({ messagesStream }),
  setRecursionLimit: (recursionLimit) => set({ recursionLimit }),
  setTags: (tags) => set({ tags }),
  // Режим живёт в адресной строке, как в эталоне: ссылку на чат можно передать
  mode: readMode(),
  setMode: (mode) => {
    set({ mode });
    const url = new URL(window.location.href);
    url.searchParams.set("mode", mode);
    window.history.replaceState(null, "", url);
  },
  rightTab: "interact",
  setRightTab: (rightTab) => set({ rightTab }),

  bootstrap: async () => {
    applyTheme(get().theme);
    try {
      const client = getClient();
      const [info, assistants] = await Promise.all([
        fetchInfo(),
        client.assistants.search({ limit: 100 }),
      ]);
      set({ info, assistants, connection: "connected", connectionError: undefined });
      const params = new URLSearchParams(window.location.search);
      const wanted = params.get("assistantId");
      const first =
        assistants.find((a) => a.assistant_id === wanted || a.graph_id === wanted) ?? assistants[0];
      if (first) await get().selectAssistant(first.assistant_id);
    } catch (e) {
      set({ connection: "error", connectionError: e instanceof Error ? e.message : String(e) });
    }
  },

  selectAssistant: async (assistantId) => {
    const client = getClient();
    set({ assistantId, graph: undefined, xrayGraph: undefined, schemas: undefined, subgraphs: [], expandedSubgraphs: [] });
    // Эталон держит подграфы свёрнутыми: обычный граф — для холста, `xray` — про запас,
    // из него берутся вложенные узлы, когда подграф раскрывают.
    const [graph, xrayGraph, schemas, subgraphs] = await Promise.all([
      client.assistants.getGraph(assistantId),
      client.assistants.getGraph(assistantId, { xray: true }),
      client.assistants.getSchemas(assistantId),
      client.assistants.getSubgraphs(assistantId, { recurse: true }).catch(() => ({})),
    ]);
    // защита от гонки: пользователь мог переключить ассистента, пока грузился граф
    if (get().assistantId !== assistantId) return;
    // Конфигурация запуска: что задал ассистент, поверх умолчаний схемы
    const saved = (get().assistants.find((a) => a.assistant_id === assistantId)?.config?.configurable ??
      {}) as Record<string, unknown>;
    set({
      graph,
      xrayGraph,
      subgraphs: Object.keys(subgraphs ?? {}),
      schemas,
      config: { ...defaultConfig(schemas), ...saved },
    });
    const url = new URL(window.location.href);
    url.searchParams.set("assistantId", assistantId);
    url.searchParams.set("mode", get().mode);
    window.history.replaceState(null, "", url);
  },

  reloadAssistants: async () => {
    const assistants = await getClient().assistants.search({ limit: 100 });
    set({ assistants });
  },

  createAssistant: async (name, configurable) => {
    const { assistants, assistantId } = get();
    const graphId = assistants.find((a) => a.assistant_id === assistantId)?.graph_id;
    if (!graphId) return undefined;
    const created = await getClient().assistants.create({ graphId, name, config: { configurable } });
    await get().reloadAssistants();
    await get().selectAssistant(created.assistant_id);
    return created;
  },

  /** Правка ассистента создаёт новую версию — так устроен сервер. */
  saveAssistant: async (assistantId, name, configurable) => {
    await getClient().assistants.update(assistantId, { name, config: { configurable } });
    await get().reloadAssistants();
    set({ config: configurable });
  },

  setAssistantVersion: async (assistantId, version) => {
    await getClient().assistants.setLatest(assistantId, version);
    await get().reloadAssistants();
    await get().selectAssistant(assistantId);
  },

  deleteAssistant: async (assistantId) => {
    await getClient().assistants.delete(assistantId);
    await get().reloadAssistants();
    if (get().assistantId === assistantId) {
      const next = get().assistants[0];
      if (next) await get().selectAssistant(next.assistant_id);
    }
  },
}));
