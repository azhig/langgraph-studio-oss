import { useState } from "react";
import { messageKind, messageText, type MessageLike } from "@/lib/messages";
import { useCurrentAssistant } from "@/store/studio";
import { useStudioStream } from "@/features/run/StreamProvider";
import { StudioLogo } from "@/components/icons/StudioLogo";
import { assistantTitle } from "@/features/assistants/model";
import { MessageCard } from "./MessageCard";
import { ChatThreads } from "./ChatThreads";
import { Composer } from "./Composer";

/**
 * Chat mode: a column with the message feed and the input at the bottom, threads panel on the right.
 * Sizes taken from the reference: column up to 1000 px, input — `rounded-xl border p-4`
 * with the `Show tool calls` toggle and a round send button.
 */
export function ChatView() {
  const assistant = useCurrentAssistant();
  const { values, sendMessage, isLoading } = useStudioStream();
  const [threadsOpen, setThreadsOpen] = useState(true);
  const [showTools, setShowTools] = useState(false);
  const [draft, setDraft] = useState("");
  const messages = (values.messages as MessageLike[] | undefined) ?? [];
  const title = assistant ? assistantTitle(assistant) : "assistant";
  // The reference hides tool messages while the toggle is off
  const shown = showTools ? messages : messages.filter((m) => messageKind(m, "ai") !== "tool");

  return (
    <div className="flex h-full min-h-0 w-full bg-bg-secondary">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="scroll-thin flex min-h-0 flex-1 flex-col overflow-y-auto">
          {/* Feed: a column up to 1000 px with 48 px padding and a 48 px gap between
              messages; a message itself is no wider than 800 px — measured on the reference */}
          <div className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col gap-12 px-12">
            {shown.length === 0 ? (
              <Empty title={title} />
            ) : (
              shown.map((m, i) => (
                <MessageCard
                  key={String(m.id ?? i)}
                  message={m}
                  onEdit={(msg) => setDraft(messageText(msg.content))}
                  onRegenerate={() => {
                    // Repeat the last human message before this reply
                    const prior = shown
                      .slice(0, i)
                      .reverse()
                      .find((x) => messageKind(x, "ai") === "human");
                    if (prior) void sendMessage(messageText(prior.content));
                  }}
                />
              ))
            )}
          </div>
        </div>
        <div className="px-12 pb-6">
          <div className="mx-auto w-full max-w-[1000px]">
            <Composer
              disabled={isLoading}
              showTools={showTools}
              text={draft}
              onText={setDraft}
              onToggleTools={() => setShowTools((v) => !v)}
              onSend={sendMessage}
            />
          </div>
        </div>
      </div>
      {threadsOpen ? (
        <ChatThreads onClose={() => setThreadsOpen(false)} />
      ) : (
        <button
          type="button"
          title="Show threads"
          className="btn btn-ghost m-2 h-fit self-start !px-2"
          onClick={() => setThreadsOpen(true)}
        >
          Threads
        </button>
      )}
    </div>
  );
}

/** Empty thread: logo and prompt — as in the reference. */
function Empty({ title }: { title: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
      <span className="flex items-center gap-3 text-3xl font-medium tracking-tighter">
        <StudioLogo className="size-7" />
        LangGraph Studio
      </span>
      <span className="text-2xl font-semibold tracking-tight text-text-tertiary">Send a message to {title}</span>
    </div>
  );
}
