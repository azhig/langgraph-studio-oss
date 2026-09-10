import { useState } from "react";
import { Check, ChevronDown, Moon, Plus, Sun } from "lucide-react";
import type { GraphSchema } from "@langchain/langgraph-sdk";
import { cx } from "@/lib/cx";
import { refersToMessages, type JsonSchema } from "@/lib/schema";
import { Popover } from "@/components/Popover";
import { Tooltip } from "@/components/Tooltip";
import { SegmentedControl } from "@/components/SegmentedControl";
import { StudioLogo } from "@/components/icons/StudioLogo";
import { useCurrentAssistant, useStudio, type ConnectionState } from "@/store/studio";
import { useStudioStream } from "@/features/run/StreamProvider";
import { ThreadPicker } from "@/features/thread/ThreadPicker";
import { assistantShortName, defaultAssistantFor } from "@/features/assistants/model";
import { ConnectionModal } from "./ConnectionModal";

/**
 * Chat mode is available when the input schema has a `messages` field whose items are
 * typed as LangChain messages. An untyped list gives no such reference — as in
 * the reference, the tab stays disabled.
 */
function supportsChatMode(schemas?: GraphSchema): boolean {
  const input = schemas?.input_schema as JsonSchema | undefined;
  return refersToMessages(input?.properties?.messages);
}

/**
 * Left pane header: `Studio / <graph> ▾  Graph│Chat … ● Connected`. Height 55 px.
 * The reference's `Deploy` button is absent: it leads to the cloud platform, which never exists here.
 */
export function LeftHeader() {
  const connection = useStudio((s) => s.connection);
  const mode = useStudio((s) => s.mode);
  const setMode = useStudio((s) => s.setMode);
  const schemas = useStudio((s) => s.schemas);
  const theme = useStudio((s) => s.theme);
  const toggleTheme = useStudio((s) => s.toggleTheme);
  // The tab is enabled only for graphs with typed messages — as in the reference
  const chatAvailable = supportsChatMode(schemas);

  return (
    <div className="flex h-[55px] w-full shrink-0 items-center gap-2 overflow-x-hidden bg-bg-primary p-2">
      <div className="inline-flex flex-none items-center justify-start gap-1.5 p-2">
        <StudioLogo className="size-4 shrink-0" />
        <span className="text-[13px] leading-4 font-medium tracking-[-0.26px] whitespace-nowrap text-text-primary">
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
        <ConnectionBadge state={connection} />
      </div>
    </div>
  );
}

/**
 * Graph picker: the list of `graph_id`s from the server's assistants. Panel 215 px,
 * heading `Select a graph` — as in the reference. Switching opens
 * the system assistant of the selected graph.
 */
function GraphPicker() {
  const assistants = useStudio((s) => s.assistants);
  const selectAssistant = useStudio((s) => s.selectAssistant);
  const mode = useStudio((s) => s.mode);
  const current = useCurrentAssistant();
  const graphs = [...new Set(assistants.map((a) => a.graph_id))];
  // In Chat mode the reference labels the button with the assistant name and puts the graph
  // next to it in small gray — two lines in one paragraph
  const chat = mode === "chat" && current;

  return (
    <Popover
      width={215}
      trigger={({ toggle }) => (
        <Tooltip label={`Graph: ${current?.graph_id ?? ""}`}>
          <button
            type="button"
            data-testid="graph-assistant-select-trigger"
            className={cx(
              "btn btn-ghost min-w-0 !justify-start truncate !px-2 !py-1 text-text-secondary",
              chat && "!min-h-[38px] !rounded-md",
            )}
            title={current?.assistant_id}
            onClick={toggle}
          >
            {chat ? (
              <p className="min-w-0 truncate text-sm font-medium tracking-normal">
                <span>{assistantShortName(current)}</span>{" "}
                <span className="text-xxs text-text-tertiary">({current.graph_id})</span>
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
                  const next = defaultAssistantFor(assistants, graph);
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

const CONNECTION_LOOK: Record<ConnectionState, { label: string; dot: string }> = {
  connected: { label: "Connected", dot: "bg-bg-success-strong" },
  error: { label: "Disconnected", dot: "bg-[#f04438]" },
  connecting: { label: "Connecting", dot: "bg-text-quaternary" },
};

/** Connection status; clicking opens the `Configure Studio connection` dialog, as in the reference. */
function ConnectionBadge({ state }: { state: ConnectionState }) {
  const { label, dot } = CONNECTION_LOOK[state];
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tooltip label="Server connection settings">
        <button type="button" className="btn btn-brand-outline h-[30px] !gap-2.5" onClick={() => setOpen(true)}>
          <span className="flex items-center gap-2">
            <span className={`size-2 rounded-full ${dot}`} />
            <span>{label}</span>
          </span>
        </button>
      </Tooltip>
      <ConnectionModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/**
 * Right pane header: `Thread <id> ▾  +`. The reference's `Interact│Trace` switch and
 * `Run experiment` button are absent: both work only through LangSmith.
 */
export function RightHeader() {
  const { threadId, newThread } = useStudioStream();
  return (
    <div className="flex h-[55px] w-full shrink-0 items-center justify-between gap-4 overflow-x-hidden p-2">
      <div className="flex min-w-0 items-center gap-2">
        <ThreadPicker />
        {threadId && (
          <button
            type="button"
            aria-label="New Thread"
            data-testid="new-thread-button"
            className="btn btn-outline btn-icon size-[26px] !p-1"
            onClick={newThread}
          >
            <Plus size={16} strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
}
