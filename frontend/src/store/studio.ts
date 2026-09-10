import { create } from "zustand";
import type { Assistant, AssistantGraph, GraphSchema } from "@langchain/langgraph-sdk";
import { fetchInfo, getClient, type ServerInfo } from "@/api/client";
import { readString, storageKeys, writeString } from "@/lib/storage";
import { readParam, writeParams } from "@/lib/url";
import { defaultConfig } from "@/features/assistants/config";

export type Theme = "dark" | "light";
export type ViewMode = "graph" | "chat";
export type ConnectionState = "connecting" | "connected" | "error";

function readTheme(): Theme {
  const saved = readString(storageKeys.theme);
  if (saved === "dark" || saved === "light") return saved;
  // In the VS Code webview the editor theme arrives as a class on `body`
  if (document.body.classList.contains("vscode-light")) return "light";
  if (document.body.classList.contains("vscode-dark")) return "dark";
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  writeString(storageKeys.theme, theme);
}

const readMode = (): ViewMode => (readParam("mode") === "chat" ? "chat" : "graph");

/**
 * Application state: server connection, assistants and the selected one's graph,
 * run configuration and UI modes.
 */
export interface StudioState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;

  connection: ConnectionState;
  connectionError?: string;
  info?: ServerInfo;

  assistants: Assistant[];
  assistantId?: string;
  graph?: AssistantGraph;
  /** The same graph with subgraphs expanded (`xray`): nested nodes are taken from it. */
  xrayGraph?: AssistantGraph;
  /** Nodes backed by a subgraph: they can be expanded on the canvas. */
  subgraphs: string[];
  /** Which subgraphs are currently expanded. */
  expandedSubgraphs: string[];
  toggleSubgraph: (node: string) => void;
  /** Collapse all subgraphs — this is what `Reset layout to default` does. */
  collapseSubgraphs: () => void;
  schemas?: GraphSchema;

  /**
   * `configurable` values for runs. Taken from the selected assistant,
   * or, if it set nothing, from the `config_schema` defaults (in the reference this is
   * `Default Configuration`). Edited in the `Manage Assistants` modal.
   */
  config: Record<string, unknown>;
  /** Run `recursion_limit`: in the reference this field sits in the same form. */
  recursionLimit: number;
  /** Run tags (`tags`) — go into the run metadata. */
  tags: string[];
  setConfig: (config: Record<string, unknown>) => void;
  setRecursionLimit: (limit: number) => void;
  setTags: (tags: string[]) => void;
  /** Whether the `Manage Assistants` modal is open (also opened from node settings). */
  assistantsOpen: boolean;
  setAssistantsOpen: (open: boolean) => void;
  /**
   * `messages` stream mode: messages arrive in chunks even if the model
   * is called via `invoke()`. Toggled in the panel next to `Submit`.
   */
  messagesStream: boolean;
  setMessagesStream: (on: boolean) => void;

  mode: ViewMode;
  setMode: (m: ViewMode) => void;

  /** Initial load: /info, assistant list, graph and schemas of the active one. */
  bootstrap: () => Promise<void>;
  selectAssistant: (id: string) => Promise<void>;
  /** Re-read the assistant list (after create, edit or delete). */
  reloadAssistants: () => Promise<void>;
  createAssistant: (name: string, config: Record<string, unknown>) => Promise<Assistant | undefined>;
  /** Roll the assistant back to the selected version (every edit creates a new one). */
  setAssistantVersion: (id: string, version: number) => Promise<void>;
  saveAssistant: (id: string, name: string, config: Record<string, unknown>) => Promise<void>;
  deleteAssistant: (id: string) => Promise<void>;
}

/** The selected assistant; `undefined` until the list is loaded. */
export const selectCurrentAssistant = (s: Pick<StudioState, "assistants" | "assistantId">) =>
  s.assistants.find((a) => a.assistant_id === s.assistantId);

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
  setRecursionLimit: (recursionLimit) => set({ recursionLimit }),
  setTags: (tags) => set({ tags }),
  assistantsOpen: false,
  setAssistantsOpen: (assistantsOpen) => set({ assistantsOpen }),
  messagesStream: true,
  setMessagesStream: (messagesStream) => set({ messagesStream }),
  // The mode lives in the address bar, as in the reference: a chat link can be shared
  mode: readMode(),
  setMode: (mode) => {
    set({ mode });
    writeParams({ mode });
  },

  bootstrap: async () => {
    applyTheme(get().theme);
    try {
      const client = getClient();
      const [info, assistants] = await Promise.all([fetchInfo(), client.assistants.search({ limit: 100 })]);
      set({ info, assistants, connection: "connected", connectionError: undefined });
      const wanted = readParam("assistantId");
      const first = assistants.find((a) => a.assistant_id === wanted || a.graph_id === wanted) ?? assistants[0];
      if (first) await get().selectAssistant(first.assistant_id);
    } catch (e) {
      set({ connection: "error", connectionError: e instanceof Error ? e.message : String(e) });
    }
  },

  selectAssistant: async (assistantId) => {
    const client = getClient();
    set({
      assistantId,
      graph: undefined,
      xrayGraph: undefined,
      schemas: undefined,
      subgraphs: [],
      expandedSubgraphs: [],
    });
    // The reference keeps subgraphs collapsed: the plain graph is for the canvas, `xray` is kept in reserve,
    // nested nodes are taken from it when a subgraph is expanded.
    const [graph, xrayGraph, schemas, subgraphs] = await Promise.all([
      client.assistants.getGraph(assistantId),
      client.assistants.getGraph(assistantId, { xray: true }),
      client.assistants.getSchemas(assistantId),
      client.assistants.getSubgraphs(assistantId, { recurse: true }).catch(() => ({})),
    ]);
    // Race guard: the user may have switched assistants while the graph was loading
    if (get().assistantId !== assistantId) return;
    // Run configuration: what the assistant set, on top of the schema defaults
    const saved = (selectCurrentAssistant(get())?.config?.configurable ?? {}) as Record<string, unknown>;
    set({
      graph,
      xrayGraph,
      subgraphs: Object.keys(subgraphs ?? {}),
      schemas,
      config: { ...defaultConfig(schemas), ...saved },
    });
    writeParams({ assistantId, mode: get().mode });
  },

  reloadAssistants: async () => {
    const assistants = await getClient().assistants.search({ limit: 100 });
    set({ assistants });
  },

  createAssistant: async (name, configurable) => {
    const graphId = selectCurrentAssistant(get())?.graph_id;
    if (!graphId) return undefined;
    const created = await getClient().assistants.create({ graphId, name, config: { configurable } });
    await get().reloadAssistants();
    await get().selectAssistant(created.assistant_id);
    return created;
  },

  /** Editing an assistant creates a new version — that is how the server works. */
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

/** The selected assistant as a hook: the component re-renders only when it changes. */
export const useCurrentAssistant = () => useStudio(selectCurrentAssistant);
