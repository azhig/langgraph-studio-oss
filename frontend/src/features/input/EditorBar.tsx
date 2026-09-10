import { useState, type ReactNode } from "react";
import { ChevronDown, Copy } from "lucide-react";
import type { Lang } from "./format";

const LANGS: Lang[] = ["json", "yaml"];

/**
 * Bar under the editor: language picker, `RAW` and copy. In the interrupt response
 * form the reference puts a `Resume` button on its right; `action` is for that.
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
              {LANGS.map((l) => (
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
        {/* Next to an action (interrupt response form) `RAW` moves left,
            otherwise it sits at the editor's right edge, as in the reference */}
        {action && side}
      </div>
      {action ? <div className="m-3 flex items-center gap-2">{action}</div> : side}
    </div>
  );
}
