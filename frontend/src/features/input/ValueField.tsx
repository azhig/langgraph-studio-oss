import { useState, type ReactNode } from "react";
import { Binary, Braces, ChevronDown, ChevronRight, Copy, MessageSquare } from "lucide-react";
import { MessagesField } from "./MessagesField";
import { CodeEditor } from "./CodeEditor";
import { parseText, type Lang } from "./format";

/**
 * Поле со значением: заголовок с бейджем, редактор и полоса `YAML ▾ … RAW ⧉`.
 * Используется и в карточке `Input`, и при правке состояния узла в логе —
 * в эталоне это один и тот же элемент.
 */
export function ValueField({
  name,
  badge,
  text,
  lang,
  onText,
  onLang,
  numeric = false,
  messages = false,
}: {
  name: string;
  badge?: string;
  text: string;
  lang: Lang;
  onText: (value: string) => void;
  onLang: (lang: Lang) => void;
  /** Скалярное число эталон показывает обычным полем, а не редактором кода. */
  numeric?: boolean;
  /** Список сообщений эталон правит конструктором, а не текстом. */
  messages?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const parsed = parseText(text, lang);

  return (
    <div className="flex flex-col items-stretch rounded-lg">
      <div className="-mx-2 grid grid-cols-[1fr_auto] gap-4 rounded p-2 transition-colors hover:bg-bg-tertiary">
        <button type="button" className="flex items-center gap-2 text-left" onClick={() => setOpen((v) => !v)}>
          <span className="flex items-center gap-2 font-medium capitalize">
            {messages ? (
              <MessageSquare size={20} strokeWidth={2} className="text-text-tertiary" />
            ) : numeric ? (
              <Binary size={20} strokeWidth={2} className="text-text-tertiary" />
            ) : (
              <Braces size={20} strokeWidth={2} className="text-text-tertiary" />
            )}
            <span>{name}</span>
          </span>
        </button>
        <span className="flex items-center gap-2">
          {badge && (
            <span className="rounded-md border border-border-secondary px-1 py-0.5 text-sm text-text-tertiary">
              {badge}
            </span>
          )}
          <button
            type="button"
            title={open ? "Collapse" : "Expand"}
            className="flex size-4 items-center justify-center rounded-xs text-text-secondary"
            onClick={() => setOpen((v) => !v)}
          >
            <ChevronRight
              size={12}
              strokeWidth={2}
              className={`text-text-primary transition-transform ${open ? "rotate-90" : ""}`}
            />
          </button>
        </span>
      </div>
      {open && messages && <MessagesField text={text} lang={lang} onText={onText} />}
      {open && numeric && (
        <input
          type="number"
          placeholder="Input"
          className="w-full rounded-lg border border-border-secondary bg-transparent p-3 text-sm outline-none transition-colors focus-within:border-border-brand"
          value={text}
          onChange={(e) => onText(e.target.value)}
        />
      )}
      {open && !numeric && !messages && (
        <div className="flex flex-col gap-2">
          <div className="overflow-hidden rounded-md border border-border-secondary">
            <div className="cm-shell rounded-b-none">
              <CodeEditor value={text} lang={lang} onChange={onText} />
            </div>
            <EditorBar lang={lang} onLang={onLang} onCopy={() => void navigator.clipboard?.writeText(text)} />
          </div>
          {parsed.error && (
            <div className="px-1 text-[13px] leading-tight text-text-error-secondary">{parsed.error}</div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Полоса под редактором: выбор языка, `RAW` и копирование. В форме ответа на
 * прерывание эталон ставит в неё справа кнопку `Resume` — для этого `action`.
 */
export function EditorBar({
  lang,
  onLang,
  onCopy,
  action,
}: {
  lang: Lang;
  onLang: (l: Lang) => void;
  onCopy: () => void;
  action?: ReactNode;
}) {
  const [menu, setMenu] = useState(false);
  const side = (
    <div className="flex items-center py-0.5 pr-3 text-sm font-medium text-text-tertiary">
      <button type="button" className="btn btn-ghost h-[26px] !px-2 font-medium" title="Raw editor">
        RAW
      </button>
      <button
        type="button"
        title="Copy"
        onClick={onCopy}
        className="cursor-pointer rounded-lg p-1.5 hover:bg-bg-tertiary"
      >
        <Copy size={16} strokeWidth={1.5} />
      </button>
    </div>
  );

  return (
    <div className="relative flex justify-between border-t border-border-secondary bg-bg-secondary">
      <div className="flex items-center gap-2">
        <div className="relative">
        <button type="button" className="btn btn-outline m-1 h-[26px]" onClick={() => setMenu((v) => !v)}>
          {lang.toUpperCase()}
          <ChevronDown size={16} strokeWidth={1.5} />
        </button>
        {menu && (
          <div className="absolute bottom-full left-1 z-20 mb-1 min-w-[92px] overflow-hidden rounded-md border border-border-secondary bg-bg-elevated py-1 shadow-[var(--shadow-lg)]">
            {(["json", "yaml"] as Lang[]).map((l) => (
              <button
                key={l}
                type="button"
                className="flex w-full items-center px-2 py-1 text-left text-[13px] hover:bg-bg-tertiary"
                onClick={() => {
                  onLang(l);
                  setMenu(false);
                }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        )}
        </div>
        {/* Рядом с действием (форма ответа на прерывание) `RAW` уходит влево,
            иначе он стоит у правого края редактора — как в эталоне */}
        {action && side}
      </div>
      {action ? <div className="m-3 flex items-center gap-2">{action}</div> : side}
    </div>
  );
}
