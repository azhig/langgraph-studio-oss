import { useEffect, useRef, useState } from "react";
import { ArrowUp, Plus } from "lucide-react";
import { useStudio } from "@/store/studio";
import { useStudioStream } from "@/features/run/StreamProvider";
import { StudioLogo } from "@/features/shell/StudioLogo";
import { MessageCard, messageText, type ChatMessage } from "./MessageCard";
import { ChatThreads } from "./ChatThreads";

/**
 * Chat mode: колонка с лентой сообщений и полем ввода внизу, справа — панель тредов.
 * Размеры сняты с эталона: колонка до 1000 px, поле ввода — `rounded-xl border p-4`
 * с переключателем `Show tool calls` и круглой кнопкой отправки.
 */
export function ChatView() {
  const { assistants, assistantId } = useStudio();
  const { values, sendMessage, isLoading } = useStudioStream();
  const [threadsOpen, setThreadsOpen] = useState(true);
  const [showTools, setShowTools] = useState(false);
  const [draft, setDraft] = useState("");
  const messages = (values.messages as ChatMessage[] | undefined) ?? [];
  const assistant = assistants.find((a) => a.assistant_id === assistantId);
  const title =
    (assistant?.metadata as { created_by?: string } | undefined)?.created_by === "system"
      ? "Default Configuration"
      : (assistant?.name ?? "assistant");
  // Служебные сообщения инструментов эталон прячет, пока переключатель выключен
  const shown = showTools ? messages : messages.filter((m) => roleOf(m) !== "tool");

  return (
    <div className="flex h-full min-h-0 w-full bg-bg-secondary">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="scroll-thin flex min-h-0 flex-1 flex-col overflow-y-auto">
          {/* Лента: колонка до 1000 px с отступами 48 px и промежутком 48 px между
              сообщениями; сама реплика не шире 800 px — измерено на эталоне */}
          <div className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col gap-12 px-12">
            {shown.length === 0 ? (
              <Empty title={title} />
            ) : (
              shown.map((m, i) => (
                <MessageCard
                  key={m.id ?? i}
                  message={m}
                  onEdit={(msg) => setDraft(messageText(msg.content))}
                  onRegenerate={() => {
                    // Повторяем последнюю реплику человека перед этим ответом
                    const prior = shown.slice(0, i).reverse().find((x) => roleOf(x) === "human");
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

const roleOf = (m: ChatMessage) => m.type ?? (m.role as string | undefined) ?? "ai";

/** Пустой тред: логотип и приглашение — как в эталоне. */
function Empty({ title }: { title: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
      <span className="flex items-center gap-3 text-3xl font-medium tracking-tighter">
        <StudioLogo className="size-7" />
        LangGraph Studio
      </span>
      <span className="text-2xl font-semibold tracking-tight text-text-tertiary">Start chatting with {title}</span>
    </div>
  );
}

function Composer({
  disabled,
  showTools,
  text,
  onText,
  onToggleTools,
  onSend,
}: {
  disabled: boolean;
  showTools: boolean;
  text: string;
  onText: (value: string) => void;
  onToggleTools: () => void;
  onSend: (text: string) => Promise<void>;
}) {
  const setText = onText;
  const area = useRef<HTMLTextAreaElement>(null);

  // Поле растёт под текст, но не выше 20 % экрана — как в эталоне
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "40px";
    el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.2)}px`;
  }, [text]);

  const send = async () => {
    const message = text.trim();
    if (!message || disabled) return;
    setText("");
    await onSend(message);
  };

  return (
    <div className="mt-auto flex w-full flex-col gap-4 rounded-xl border border-border-default bg-bg-primary p-4">
      <textarea
        ref={area}
        rows={1}
        placeholder="Enter message"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void send();
          }
        }}
        className="max-h-[20vh] min-h-[2.5rem] w-full resize-none border-none bg-transparent p-0 text-sm outline-none placeholder:text-text-placeholder"
      />
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={showTools}
            onClick={onToggleTools}
            className={`inline-flex h-5 w-10 items-center rounded-full transition ${
              showTools ? "bg-bg-control-active" : "bg-bg-quaternary"
            }`}
          >
            <span
              className={`size-4 rounded-full bg-white transition ${showTools ? "translate-x-[22px]" : "translate-x-[2px]"}`}
            />
          </button>
          <span className="text-xs tracking-tighter">Show tool calls</span>
          <button type="button" aria-label="Upload files or images" className="btn btn-ghost !px-2">
            <Plus size={14} strokeWidth={1.8} />
            Upload files or images
          </button>
        </div>
        <button
          type="submit"
          aria-label="Send message"
          disabled={disabled || !text.trim()}
          onClick={() => void send()}
          className="flex size-[34px] items-center justify-center rounded-full border border-transparent bg-bg-elevated-hover text-text-secondary disabled:opacity-50"
        >
          <ArrowUp size={16} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}
