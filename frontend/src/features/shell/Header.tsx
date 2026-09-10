import { Check, ChevronDown, Moon, Plus, Rocket, Sun } from "lucide-react";
import { Popover } from "@/components/Popover";
import { Tooltip } from "@/components/Tooltip";
import { SegmentedControl } from "@/components/SegmentedControl";
import type { GraphSchema } from "@langchain/langgraph-sdk";
import { useStudio } from "@/store/studio";
import { useStudioStream } from "@/features/run/StreamProvider";
import { ThreadPicker } from "@/features/thread/ThreadPicker";
import { StudioLogo } from "./StudioLogo";

const CHAT_MODE_READY = true;
const MESSAGE_TYPES = ["AIMessage", "BaseMessage", "ChatMessage", "FunctionMessage", "HumanMessage", "SystemMessage", "ToolMessage"];

/**
 * Chat mode доступен, когда во входной схеме есть поле `messages`, элементы которого
 * типизированы сообщениями LangChain (ссылки на AIMessage, HumanMessage и т. д.).
 * Список `Annotated[list, add_messages]` без типов такой ссылки не даёт — как и в эталоне,
 * вкладка остаётся неактивной.
 */
function supportsChatMode(schemas?: GraphSchema): boolean {
  const input = schemas?.input_schema as { properties?: Record<string, unknown> } | undefined;
  const messages = input?.properties?.messages;
  if (!messages) return false;
  const text = JSON.stringify(messages);
  return MESSAGE_TYPES.some((t) => text.includes(`/${t}"`));
}

/** Шапка левой панели: `Studio / <граф> ▾  Graph│Chat … Deploy ● Connected`. Высота 55 px. */
export function LeftHeader() {
  const { connection, mode, setMode, schemas, theme, toggleTheme } = useStudio();
  // Вкладка активна только у графов с типизированными сообщениями — как в эталоне
  const chatAvailable = CHAT_MODE_READY && supportsChatMode(schemas);

  return (
    <div className="flex h-[55px] w-full shrink-0 items-center gap-2 overflow-x-hidden bg-bg-primary p-2">
      <div className="inline-flex flex-none items-center justify-start gap-1.5 p-2">
        <StudioLogo className="size-4 shrink-0" />
        <span className="whitespace-nowrap text-[13px] font-medium leading-4 tracking-[-0.26px] text-text-primary">
          Studio
        </span>
      </div>
      <span className="text-[13px] text-text-quaternary">/</span>
      <div className="flex min-w-0 items-center gap-2">
        <GraphPicker />
        <SegmentedControl
          value={mode}
          onChange={setMode}
          options={[
            { value: "graph", label: "Graph" },
            { value: "chat", label: "Chat", disabled: !chatAvailable },
          ]}
        />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button
          type="button"
          className="btn btn-ghost btn-icon size-[26px] !p-1 text-text-secondary"
          title={theme === "dark" ? "Light theme" : "Dark theme"}
          onClick={toggleTheme}
        >
          {theme === "dark" ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
        </button>
        <button type="button" className="btn btn-brand-outline h-[30px]" title="Deploy to LangGraph Platform (cloud only)">
          <Rocket size={14} strokeWidth={1.8} />
          Deploy
        </button>
        <ConnectionBadge state={connection} />
      </div>
    </div>
  );
}

/**
 * Выбор графа: список `graph_id` из ассистентов сервера. Панель 215 px,
 * заголовок `Select a graph` — как в эталоне. Переключение открывает
 * системного ассистента выбранного графа.
 */
function GraphPicker() {
  const { assistants, assistantId, selectAssistant, mode } = useStudio();
  const current = assistants.find((a) => a.assistant_id === assistantId);
  const graphs = [...new Set(assistants.map((a) => a.graph_id))];
  // В Chat mode эталон подписывает кнопку именем ассистента, а граф ставит
  // рядом мелким серым — двумя строками в одном абзаце
  const chat = mode === "chat" && current;
  const assistantName = current
    ? (current.metadata as { created_by?: string } | undefined)?.created_by === "system"
      ? "Default"
      : (current.name ?? "Assistant")
    : "…";

  return (
    <Popover
      width={215}
      trigger={({ toggle }) => (
        <Tooltip label={`Graph: ${current?.graph_id ?? ""}`}>
        <button
          type="button"
          data-testid="graph-assistant-select-trigger"
          className={`btn btn-ghost min-w-0 !justify-start truncate !py-1 !px-2 text-text-secondary ${
            chat ? "!min-h-[38px] !rounded-md" : ""
          }`}
          title={current?.assistant_id}
          onClick={toggle}
        >
          {chat ? (
            <p className="min-w-0 truncate text-sm font-medium tracking-normal">
              <span>{assistantName}</span> <span className="text-xxs text-text-tertiary">({current.graph_id})</span>
            </p>
          ) : (
            <span className="min-w-0 truncate">{current?.graph_id ?? "…"}</span>
          )}
          <ChevronDown size={16} strokeWidth={1.5} className="shrink-0" />
        </button>
        </Tooltip>
      )}
    >
      {({ close }) => (
        <div className="flex flex-col gap-2 p-2">
          <span className="px-2 text-sm font-medium text-text-quaternary">Select a graph</span>
          <div className="flex flex-col items-start gap-2">
            {graphs.map((graph) => (
              <button
                key={graph}
                type="button"
                className="w-full rounded-md p-2 text-start text-sm hover:bg-bg-secondary"
                onClick={() => {
                  const next =
                    assistants.find(
                      (a) =>
                        a.graph_id === graph &&
                        (a.metadata as { created_by?: string } | undefined)?.created_by === "system",
                    ) ?? assistants.find((a) => a.graph_id === graph);
                  if (next) void selectAssistant(next.assistant_id);
                  close();
                }}
              >
                <span className="flex flex-row items-center justify-between">
                  <span className="truncate text-sm font-medium">{graph}</span>
                  {graph === current?.graph_id && <Check size={16} strokeWidth={1.8} className="shrink-0" />}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Popover>
  );
}

function ConnectionBadge({ state }: { state: "connecting" | "connected" | "error" }) {
  const label = state === "connected" ? "Connected" : state === "error" ? "Disconnected" : "Connecting";
  const dot =
    state === "connected" ? "bg-bg-success-strong" : state === "error" ? "bg-[#f04438]" : "bg-text-quaternary";
  return (
    <Tooltip label="Server connection settings">
    <button type="button" className="btn btn-brand-outline h-[30px] !gap-2.5">
      <span className="flex items-center gap-2">
        <span className={`size-2 rounded-full ${dot}`} />
        <span>{label}</span>
      </span>
    </button>
    </Tooltip>
  );
}

/** Шапка правой панели: `Thread <id> ▾  +  … Interact│Trace  Run experiment`. */
export function RightHeader() {
  const { rightTab, setRightTab } = useStudio();
  const { threadId, newThread } = useStudioStream();
  return (
    <div className="flex h-[55px] w-full shrink-0 items-center justify-between gap-4 overflow-x-hidden p-2">
      <div className="flex min-w-0 items-center gap-2">
        <ThreadPicker />
        {threadId && (
          <button
            type="button"
            aria-label="New Thread" data-testid="new-thread-button"
            className="btn btn-outline btn-icon size-[26px] !p-1"
            onClick={newThread}
          >
            <Plus size={16} strokeWidth={1.5} />
          </button>
        )}
      </div>
      <div className="ml-auto flex shrink-0 grow items-center justify-end gap-2">
        <SegmentedControl
          value={rightTab}
          onChange={setRightTab}
          options={[
            { value: "interact", label: "Interact" },
            { value: "trace", label: "Trace" },
          ]}
        />
        <Tooltip label="Enable tracing via the LANGSMITH_API_KEY environment variable to run an experiment">
          <button
            type="button"
            disabled
            className="btn btn-sm h-[35px] cursor-not-allowed bg-bg-brand-tertiary text-text-brand-disabled"
          >
            Run experiment
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
