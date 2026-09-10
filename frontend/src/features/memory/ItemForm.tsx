import { useState } from "react";
import type { Item } from "@langchain/langgraph-sdk";
import { Trash2, X } from "lucide-react";
import { getClient } from "@/api/client";
import { CodePanel } from "@/features/input/CodePanel";
import { parseText, toText, type Lang } from "@/features/input/format";
import { parseNamespace } from "./tree";

const INPUT =
  "w-full rounded-lg border border-border-secondary bg-transparent p-2 px-2.5 text-sm outline-none transition-colors placeholder:text-text-placeholder focus:border-border-brand";

/** Store item form: `Key`, `Namespace`, `Value`; an existing item's key and path cannot be changed. */
export function ItemForm({
  item,
  onClose,
  onSaved,
}: {
  item: Item | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [key, setKey] = useState(item?.key ?? "");
  const [namespace, setNamespace] = useState(item ? item.namespace.join("/") : "");
  const [lang, setLang] = useState<Lang>("yaml");
  const [text, setText] = useState(() => toText(item?.value ?? {}, "yaml"));
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setKey(item?.key ?? "");
    setNamespace(item ? item.namespace.join("/") : "");
    setText(toText(item?.value ?? {}, lang));
    setError(undefined);
  };

  const save = async () => {
    const parsed = parseText(text, lang);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    if (!key.trim()) {
      setError("Key is required");
      return;
    }
    setBusy(true);
    try {
      await getClient().store.putItem(
        parseNamespace(namespace),
        key.trim(),
        (parsed.value ?? {}) as Record<string, unknown>,
      );
      setError(undefined);
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!item) return;
    setBusy(true);
    try {
      await getClient().store.deleteItem(item.namespace, item.key);
      await onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex items-start justify-between gap-4 p-4">
        <h3 className="text-xl font-semibold tracking-tighter">{item ? item.key : "Add new item"}</h3>
        <button type="button" title="Close" className="btn btn-ghost btn-icon !p-1" onClick={onClose}>
          <X size={16} strokeWidth={1.8} />
        </button>
      </div>
      <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm">Key</span>
          <input className={INPUT} value={key} disabled={Boolean(item)} onChange={(e) => setKey(e.target.value)} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm">Namespace</span>
          <input
            className={INPUT}
            placeholder="Root..."
            value={namespace}
            disabled={Boolean(item)}
            onChange={(e) => setNamespace(e.target.value)}
          />
        </label>
        <div className="flex flex-col gap-2">
          <span className="text-sm">Value</span>
          <CodePanel
            value={text}
            lang={lang}
            onChange={setText}
            onLang={(next, converted) => {
              setLang(next);
              setText(converted);
            }}
          />
          {error && <span className="text-[13px] text-text-error-secondary">{error}</span>}
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 p-4">
        {item ? (
          <button
            type="button"
            className="btn btn-outline !rounded-sm text-text-error-secondary"
            onClick={() => void remove()}
          >
            <Trash2 size={14} strokeWidth={1.8} />
            Delete
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-outline !rounded-sm" onClick={reset}>
            Reset
          </button>
          <button type="button" className="btn btn-primary !rounded-sm" disabled={busy} onClick={() => void save()}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
