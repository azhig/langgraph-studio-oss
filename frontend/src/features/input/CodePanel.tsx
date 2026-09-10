import { cx } from "@/lib/cx";
import { copyText } from "@/lib/clipboard";
import { CodeEditor } from "./CodeEditor";
import { EditorBar } from "./EditorBar";
import { convertText, type Lang } from "./format";

/**
 * Framed value editor: a gray shell with CodeMirror and the `YAML v ... RAW` bar
 * below it. This is how every form field, `View Raw`, node state editing and
 * a Store record look; in the reference it is one and the same element.
 */
export function CodePanel({
  value,
  lang,
  onChange,
  onLang,
  bar = true,
  autoFocus,
}: {
  value: string;
  lang: Lang;
  onChange: (value: string) => void;
  /**
   * Language switch. Without a handler the panel converts the text to the new language
   * itself and returns it via `onChange` together with the new `lang` value.
   */
  onLang?: (lang: Lang, text: string) => void;
  /** Without the format bar: this is how `View Raw` opens when editing node state. */
  bar?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border-secondary">
      <div className={cx("cm-shell", bar && "rounded-b-none")}>
        <CodeEditor value={value} lang={lang} onChange={onChange} autoFocus={autoFocus} />
      </div>
      {bar && (
        <EditorBar
          lang={lang}
          onLang={(next) => onLang?.(next, convertText(value, lang, next))}
          onCopy={() => copyText(value)}
        />
      )}
    </div>
  );
}
