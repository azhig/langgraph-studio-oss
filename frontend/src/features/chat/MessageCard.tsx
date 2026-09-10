import { Copy, Pencil, RefreshCw } from "lucide-react";

/**
 * Карточка сообщения. Снято с эталона: шапка с ролью (`px-4 py-3`, метка 12px
 * капителью), под ней текст на `border-t`. Реплика человека — рамка 2 px
 * брендового цвета и заливка 10 %, прижата вправо и растянута по содержимому;
 * остальные — обычная рамка на всю ширину ленты.
 */
export interface ChatMessage {
  id?: string;
  type?: string;
  role?: string;
  content?: unknown;
  tool_calls?: Array<{ name: string; args?: unknown; id?: string }>;
  name?: string;
}

export function MessageCard({ message, onEdit, onRegenerate }: {
  message: ChatMessage;
  /** Правка реплики человека: эталон открывает её в поле ввода. */
  onEdit?: (message: ChatMessage) => void;
  /** Перезапуск ответа модели с этого места. */
  onRegenerate?: (message: ChatMessage) => void;
}) {
  const role = message.type ?? message.role ?? "ai";
  const human = role === "human" || role === "user";
  const calls = message.tool_calls ?? [];
  const body = text(message.content);

  return (
    <div className={`group flex flex-col gap-1 ${human ? "ml-auto w-fit" : "w-full max-w-[800px]"}`}>
      <div
        data-testid="message-component"
        className={`max-w-full rounded-lg ${
          human ? "border-2 border-border-brand bg-bg-brand/10" : "w-full border border-border-muted bg-bg-primary"
        }`}
      >
        <div className="flex w-full cursor-default items-center justify-between gap-3 px-4 py-3">
          <span className="flex items-center gap-1">
            <span
              className="text-xs font-semibold uppercase leading-[18px] text-text-tertiary"
              style={{ fontVariant: "small-caps" }}
            >
              {role}
            </span>
            {message.name && <span className="text-xs text-text-quaternary">{message.name}</span>}
          </span>
        </div>
        <div className="overflow-auto border-t border-border-muted">
          <div className="whitespace-pre-wrap px-4 pb-3 pt-3">
            <span className="text-sm leading-[1.65] tracking-tight text-text-primary">{body}</span>
          </div>
          {calls.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-border-muted px-4 py-3">
              {calls.map((call, i) => (
                <div key={call.id ?? i} className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase text-text-tertiary">{call.name}</span>
                  <span className="whitespace-pre-wrap text-sm text-text-tertiary">
                    {JSON.stringify(call.args ?? {}, null, 2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Под карточкой эталон держит действия: у реплики человека — Copy и Edit,
          у ответа модели — Copy и Regenerate; появляются при наведении */}
      <div
        className={`flex flex-row items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 ${
          human ? "justify-end" : "justify-start"
        }`}
      >
        <button
          type="button"
          aria-label="Copy"
          className="btn btn-ghost btn-icon !p-1"
          onClick={() => void navigator.clipboard?.writeText(body)}
        >
          <Copy size={16} strokeWidth={1.5} />
        </button>
        {human ? (
          <button
            type="button"
            aria-label="Edit"
            className="btn btn-ghost btn-icon !p-1"
            onClick={() => onEdit?.(message)}
          >
            <Pencil size={16} strokeWidth={1.5} />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Regenerate"
            className="btn btn-ghost btn-icon !p-1"
            onClick={() => onRegenerate?.(message)}
          >
            <RefreshCw size={16} strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
}

/** Содержимое сообщения бывает строкой или списком блоков — показываем текст. */
export function messageText(content: unknown): string {
  return text(content);
}

function text(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content))
    return content
      .map((part) =>
        typeof part === "string" ? part : ((part as { text?: string })?.text ?? JSON.stringify(part)),
      )
      .join("");
  if (content === undefined || content === null) return "";
  return JSON.stringify(content);
}
