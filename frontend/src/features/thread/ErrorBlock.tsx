import { useState } from "react";
import { ChevronRight, Copy, CircleAlert } from "lucide-react";

/**
 * Плашка ошибки под записью узла.
 *
 * Снята с эталона: полоса `bg-error` с радиусом 4 px и отступами `2px 4px 2px 6px`,
 * круглая иконка 16 px на `--bg-error-subtle`, метка `Error` и текст ошибки — 12px/16px.
 * Свёрнутая показывает одну строку с многоточием; кнопки справа — копирование
 * и раскрытие полного сообщения.
 */
export function ErrorBlock({ message }: { message: string }) {
  const [open, setOpen] = useState(false);
  const full = formatError(message);
  return (
    <div className="w-full rounded-sm bg-bg-error py-0.5 pl-1.5 pr-1">
      <div className="flex w-full items-start gap-2">
        <span className="shrink-0 pt-px">
          <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-bg-error-subtle p-[2px] text-text-error-tertiary">
            <CircleAlert size={12} strokeWidth={1.5} />
          </span>
        </span>
        <div className="flex min-w-0 flex-1 flex-row gap-1">
          <span className="flex shrink-0 items-center whitespace-nowrap text-xxs font-medium leading-4 text-text-error-secondary dark:text-text-error-tertiary">
            Error
          </span>
          <span
            aria-hidden={open}
            className={`min-w-0 truncate whitespace-nowrap text-xxs leading-4 text-text-error-secondary dark:text-text-error-primary ${
              open ? "pointer-events-none h-0" : ""
            }`}
          >
            {message}
          </span>
        </div>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            title="Copy error"
            className="btn btn-ghost !rounded-xs !p-0.5 text-text-secondary"
            onClick={() => void navigator.clipboard?.writeText(message)}
          >
            <Copy size={14} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            aria-label={open ? "Collapse" : "Show full error message"}
            aria-expanded={open}
            title={open ? "Collapse" : "Show full error message"}
            className="btn btn-ghost !rounded-xs !p-0.5 text-text-secondary"
            onClick={() => setOpen((v) => !v)}
          >
            <ChevronRight
              size={14}
              strokeWidth={1.5}
              className={`transition-transform ${open ? "rotate-90" : ""}`}
            />
          </button>
        </div>
      </div>
      {/* Раскрытая ошибка — отдельный блок под шапкой плашки, как в эталоне */}
      {open && (
        <div className="flex flex-col gap-1 pb-1 pl-5 pr-1">
          <span className="whitespace-pre-wrap break-words text-xxs leading-4 text-text-error-secondary dark:text-text-error-primary">
            {full}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Сообщение приходит одной строкой (`RuntimeError('…')`), а эталон разбивает его
 * на имя, аргументы с отступом и закрывающую скобку.
 */
function formatError(message: string): string {
  const m = /^([A-Za-z_][\w.]*)\((.*)\)$/s.exec(message.trim());
  if (!m) return message;
  return `${m[1]}(\n  ${m[2]}\n)`;
}
