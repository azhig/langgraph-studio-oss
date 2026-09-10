import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

/**
 * Дерево значений состояния. Структура снята с эталона (поповер `View state` и
 * раскрытые записи лога): строка `[шеврон] ключ`, значение — ниже или рядом,
 * ключи моноширинным шрифтом, примитивы — цветом `--text-tertiary`.
 */
export function ValueTree({
  name,
  value,
  depth = 0,
  foreign = false,
  leafBelow = false,
  defaultOpen,
}: {
  name?: string;
  value: unknown;
  depth?: number;
  /**
   * Дерево внешних данных (значение `interrupt()`): у эталона там даже строка
   * раскрывается шевроном, текст стоит под ключом, а ключи идут по алфавиту.
   */
  foreign?: boolean;
  /** Только вид «ключ с шевроном, значение под ним» — так устроен лог треда. */
  leafBelow?: boolean;
  /** Начальное состояние ветки; по умолчанию раскрыт только корень. */
  defaultOpen?: boolean;
}) {
  const branch = isBranch(value);
  const [open, setOpen] = useState(defaultOpen ?? depth < 1);
  // Уровень детализации меняет раскрытие на лету, а не только при первом показе
  useEffect(() => {
    if (defaultOpen !== undefined) setOpen(defaultOpen);
  }, [defaultOpen]);

  if (!branch && (foreign || leafBelow) && name !== undefined) {
    return (
      <div
        className="relative flex w-full flex-col items-stretch justify-center gap-y-1"
        data-testid={`foreign-data-tree-leaf-${name}`}
      >
        <button
          type="button"
          className="grid w-full min-w-0 select-none grid-cols-[auto_1fr] items-center gap-2 text-left outline-none"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="flex size-5 shrink-0 items-center justify-center">
              {open ? <ChevronDown size={16} strokeWidth={1.5} /> : <ChevronRight size={16} strokeWidth={1.5} />}
            </span>
            <span className="min-w-[30px] truncate whitespace-nowrap text-sm font-medium leading-[1.15] tracking-tighter">
              <span className="font-mono">{name}</span>
            </span>
          </span>
          {/* Свёрнутый скаляр эталон подписывает значением справа от ключа */}
          <span className="flex min-w-[30px] items-center gap-2">
            {/* Значение эталон держит абзацем: в тексте лога оно отделено переводом строки */}
            {!open && (
              <p className="min-w-0 truncate text-sm leading-normal tracking-normal text-text-tertiary">
                {format(value)}
              </p>
            )}
          </span>
        </button>
        {open && (
          <span className="flex min-w-0 flex-col gap-2 text-sm">
            <span className="w-full whitespace-pre-wrap text-sm leading-[1.65] tracking-tight text-text-primary">
              {format(value)}
            </span>
          </span>
        )}
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="grid grid-cols-[auto_1fr] items-start gap-2" data-testid={`value-leaf-${name ?? ""}`}>
        {name !== undefined && <Key name={name} />}
        <span className="min-w-0 whitespace-pre-wrap break-words text-sm text-text-tertiary">{format(value)}</span>
      </div>
    );
  }

  // Список сообщений эталон подписывает ролями (Human, AI, Tool), а не индексами
  const messages = asMessages(value);
  const entries: Array<[string, unknown]> = Array.isArray(value)
    ? value.map((v, i) => [messages ? roleTitle(messages[i]) : String(i), v])
    : // Эталон показывает ключи внешних данных по алфавиту, а не в порядке ответа
      sortKeys(Object.entries(value as Record<string, unknown>), foreign);

  return (
    <div className="relative flex w-full flex-col items-stretch justify-center gap-y-1">
      <button
        type="button"
        className="grid w-full min-w-0 select-none grid-cols-[auto_1fr] items-center gap-2 text-left outline-none"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="flex size-5 shrink-0 items-center justify-center text-text-secondary">
            {open ? <ChevronDown size={16} strokeWidth={1.5} /> : <ChevronRight size={16} strokeWidth={1.5} />}
          </span>
          {name !== undefined ? (
            <span className="min-w-[30px] truncate whitespace-nowrap text-sm font-medium leading-[1.15] tracking-tighter">
              <span className="font-mono">{name}</span>
            </span>
          ) : (
            <span className="text-sm text-text-tertiary">{Array.isArray(value) ? "list" : "object"}</span>
          )}
        </span>
        {!open && <span className="truncate text-sm text-text-quaternary">{preview(value)}</span>}
      </button>
      {open && (
        <div className="flex min-w-0 flex-col gap-2">
          {entries.length ? (
            entries.map(([key, v], i) =>
              messages ? (
                <MessageNode key={i} title={key} message={messages[i]} defaultOpen={defaultOpen} />
              ) : (
                <div key={key} className="pl-6">
                  <ValueTree name={key} value={v} depth={depth + 1} foreign={foreign} leafBelow={leafBelow} />
                </div>
              ),
            )
          ) : (
            <span className="text-sm text-text-tertiary">{Array.isArray(value) ? "[]" : "{}"}</span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Сообщение в дереве значений: строка «роль — превью текста», а внутри —
 * тот же бабл, что в логе. Снято с эталона: роль полужирная, превью справа
 * серым с обрезкой, чип `ID` появляется при наведении.
 */
function MessageNode({
  title,
  message,
  defaultOpen,
}: {
  title: string;
  message: MessageLike;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  useEffect(() => {
    if (defaultOpen !== undefined) setOpen(defaultOpen);
  }, [defaultOpen]);
  const text = messageText(message.content);
  const id = typeof message.id === "string" ? message.id : undefined;

  return (
    <div className="relative flex w-full flex-col items-stretch justify-center gap-y-1">
      <div className="group/message bg-inherit">
        <button
          type="button"
          className="grid w-full min-w-0 select-none grid-cols-[auto_1fr] items-center gap-2 text-left outline-none"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex size-5 shrink-0 items-center justify-center text-text-secondary">
              {open ? <ChevronDown size={16} strokeWidth={1.5} /> : <ChevronRight size={16} strokeWidth={1.5} />}
            </span>
            <span className="min-w-[30px] truncate whitespace-nowrap text-sm font-semibold leading-[1.15] tracking-tighter">
              {title}
            </span>
          </span>
          <span className="flex min-w-[30px] items-center gap-2">
            {id && (
              <span
                className="ml-auto shrink-0 rounded-full border border-border-secondary px-1 font-sans text-xs text-text-tertiary opacity-0 transition-opacity group-hover/message:opacity-100"
                title={id}
              >
                ID
              </span>
            )}
          </span>
        </button>
      </div>
      {open && (
        // Внутри дерева значений эталон рисует сообщение без пузыря: роль и текст подряд
        <span className="flex min-w-0 flex-col gap-2 pl-0 text-sm">
          <span className="flex flex-col gap-2 overflow-auto whitespace-pre-wrap">
            <span className="text-xs font-semibold uppercase text-text-tertiary">{roleOf(message)}</span>
            <span className="text-sm leading-[1.65] tracking-tight text-text-primary">{text}</span>
          </span>
        </span>
      )}
    </div>
  );
}

export interface MessageLike {
  id?: unknown;
  type?: string;
  role?: string;
  content?: unknown;
  name?: string;
}

const ROLE_TITLES: Record<string, string> = {
  human: "Human",
  user: "Human",
  ai: "AI",
  assistant: "AI",
  tool: "Tool",
  system: "System",
};

/** Роль сообщения в верхнем регистре — так подписан бабл в логе. */
export function roleOf(m: MessageLike): string {
  const raw = String(m.type ?? m.role ?? "message").toLowerCase().replace(/message$/, "");
  return (ROLE_TITLES[raw] ?? raw).toUpperCase();
}

/** Заголовок узла сообщения: `Human`, `AI`, `Tool` — как в эталоне. */
function roleTitle(m: MessageLike): string {
  const raw = String(m.type ?? m.role ?? "message").toLowerCase().replace(/message$/, "");
  return ROLE_TITLES[raw] ?? raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** Содержимое бывает строкой или списком блоков — показываем текст. */
export function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content))
    return content
      .map((part) => (typeof part === "string" ? part : ((part as { text?: string })?.text ?? JSON.stringify(part))))
      .join("");
  if (content === undefined || content === null) return "";
  return JSON.stringify(content);
}

/** Массив сообщений LangChain: у каждого элемента есть содержимое и роль. */
export function asMessages(value: unknown): MessageLike[] | null {
  if (!Array.isArray(value) || !value.length) return null;
  const ok = value.every(
    (v) => v && typeof v === "object" && "content" in v && ("type" in v || "role" in v),
  );
  return ok ? (value as MessageLike[]) : null;
}

function Key({ name }: { name: string }) {
  return (
    <span className="min-w-[30px] truncate whitespace-nowrap pl-5 text-sm font-medium leading-[1.15] tracking-tighter">
      <span className="font-mono">{name}</span>
    </span>
  );
}

const isBranch = (v: unknown) => v !== null && typeof v === "object";

const sortKeys = (entries: Array<[string, unknown]>, on: boolean) =>
  on ? [...entries].sort(([a], [b]) => a.localeCompare(b)) : entries;

const format = (v: unknown) => {
  if (typeof v === "string") return v;
  if (v === null) return "null";
  if (v === undefined) return "";
  return JSON.stringify(v);
};

/** Свёрнутая ветка показывает краткое содержимое, чтобы не разворачивать всё подряд. */
function preview(value: unknown): string {
  if (Array.isArray(value)) return value.length ? "[...]" : "[]";
  const keys = Object.keys(value as Record<string, unknown>);
  return keys.length ? "{...}" : "{}";
}
