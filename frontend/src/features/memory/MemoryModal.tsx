import { useCallback, useEffect, useState } from "react";
import type { Item } from "@langchain/langgraph-sdk";
import { ChevronDown, ChevronRight, Copy, Filter, Plus, Search, Trash2, X } from "lucide-react";
import { Modal } from "@/components/Modal";
import { getClient } from "@/api/client";
import { CodeEditor } from "@/features/input/CodeEditor";
import { EditorBar } from "@/features/input/ValueField";
import { parseText, toText, type Lang } from "@/features/input/format";
import { relativeTime } from "@/features/thread/time";

/**
 * `Memory` — записи Store сервера. Окно во весь экран с отступом (эталон:
 * `w-[calc(100vw-32px)] max-w-screen-xl`, высота от 65 % экрана), слева список
 * записей и кнопка `Add new item`, справа форма: `Key`, `Namespace`, `Value`.
 *
 * Пространство имён вводится путём через `/`; пустое поле означает корень.
 */
export function MemoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [namespaces, setNamespaces] = useState<string[][]>([]);
  const [selected, setSelected] = useState<Item | null>(null);
  const [creating, setCreating] = useState(true);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const found = await getClient().store.listNamespaces({ limit: 200 });
      setNamespaces(found.namespaces ?? []);
    } catch {
      setNamespaces([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const tree = buildTree(namespaces);

  return (
    <Modal open={open} onClose={onClose} width={Math.min(window.innerWidth - 32, 1280)} height={Math.round(window.innerHeight * 0.75)}>
      <div className="flex h-full min-h-0">
        <div className="flex w-[35%] min-w-[300px] flex-col rounded-l-xl bg-bg-secondary">
          <h2 className="p-4 pb-2 text-xl font-semibold tracking-tighter">Memory</h2>
          <div className="relative flex-grow">
            <div className="scroll-thin absolute inset-0 overflow-auto">
              {tree.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 py-4">
                  <span className="inline-flex items-center justify-center rounded-full bg-bg-tertiary p-3 text-text-secondary">
                    <Search size={20} strokeWidth={1.5} />
                  </span>
                  <div className="flex max-w-xs flex-col gap-2 text-center">
                    <h3 className="text-base font-semibold leading-tight tracking-tight">
                      {loading ? "Loading…" : "No items found"}
                    </h3>
                    <p className="text-sm text-text-tertiary">Create a new item to get started</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1 px-2 pb-3">
                  {tree.map((node) => (
                    <NamespaceNode
                      key={node.name}
                      node={node}
                      selected={selected}
                      onSelect={(item) => {
                        setSelected(item);
                        setCreating(false);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col p-4">
            <button
              type="button"
              className="btn btn-brand-outline w-full !rounded-sm"
              onClick={() => {
                setSelected(null);
                setCreating(true);
              }}
            >
              <Plus size={14} strokeWidth={1.8} />
              Add new item
            </button>
          </div>
        </div>

        <ItemForm
          key={selected ? `${selected.namespace.join("/")}:${selected.key}` : "new"}
          item={creating ? null : selected}
          onClose={onClose}
          onSaved={async () => {
            await load();
          }}
        />
      </div>
    </Modal>
  );
}

interface TreeNode {
  /** Сегмент пространства имён. */
  name: string;
  /** Полный путь до этого сегмента. */
  path: string[];
  children: TreeNode[];
}

/** Пространства имён приходят списком путей — собираем из них дерево, как в эталоне. */
function buildTree(namespaces: string[][]): TreeNode[] {
  const roots: TreeNode[] = [];
  for (const path of namespaces) {
    let level = roots;
    path.forEach((name, i) => {
      let node = level.find((n) => n.name === name);
      if (!node) {
        node = { name, path: path.slice(0, i + 1), children: [] };
        level.push(node);
      }
      level = node.children;
    });
  }
  return roots;
}

/**
 * Узел дерева памяти: строка с шевроном и именем сегмента, вложенные сегменты
 * с отступом 16 px, а на своём уровне — записи этого пространства имён
 * (ключ и относительное время), которые подгружаются при раскрытии.
 */
function NamespaceNode({
  node,
  selected,
  onSelect,
}: {
  node: TreeNode;
  selected: Item | null;
  onSelect: (item: Item) => void;
}) {
  const [open, setOpen] = useState(true);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    if (!open) return;
    let stale = false;
    void getClient()
      .store.searchItems(node.path, { limit: 100 })
      .then((found) => {
        // берём только записи этого уровня: вложенные лежат в своих узлах
        if (!stale)
          setItems((found.items ?? []).filter((it) => it.namespace.length === node.path.length));
      })
      .catch(() => setItems([]));
    return () => {
      stale = true;
    };
  }, [open, node.path]);

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        className="group/trigger flex w-full flex-row items-center gap-2 rounded-md p-2 text-sm transition-colors hover:bg-bg-tertiary"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown size={16} strokeWidth={1.5} /> : <ChevronRight size={16} strokeWidth={1.5} />}
        <span className="flex flex-grow items-center gap-1 text-left">
          <span>{node.name}</span>
          {/* Число записей в этом пространстве имён — бейдж справа от имени */}
          {items.length > 0 && (
            <span className="rounded bg-bg-secondary px-1 text-xs text-text-tertiary">{items.length}</span>
          )}
        </span>
        <span
          className="cursor-pointer opacity-0 transition-opacity group-hover/trigger:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            void navigator.clipboard?.writeText(node.path.join("/"));
          }}
        >
          <Copy size={16} strokeWidth={1.5} />
        </span>
        <span className="btn btn-ghost btn-icon self-center !p-1" aria-label="Filter">
          <Filter size={16} strokeWidth={1.5} />
        </span>
      </button>
      {open && (
        <div className="ml-4 mt-1 flex flex-col gap-1">
          {node.children.map((child) => (
            <NamespaceNode key={child.name} node={child} selected={selected} onSelect={onSelect} />
          ))}
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`flex w-full flex-row items-center gap-2 rounded-md p-2 text-left text-sm transition-colors hover:bg-bg-tertiary ${
                selected?.key === item.key && selected.namespace.join("/") === item.namespace.join("/")
                  ? "bg-bg-tertiary"
                  : ""
              }`}
              onClick={() => onSelect(item)}
            >
              <span className="min-w-0 flex-grow truncate">{item.key}</span>
              <span className="shrink-0 text-xs text-text-tertiary">
                {relativeTime(Date.parse(item.updatedAt ?? item.createdAt ?? ""), "en")}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ItemForm({
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
      const path = namespace.split("/").map((p) => p.trim()).filter(Boolean);
      await getClient().store.putItem(path, key.trim(), (parsed.value ?? {}) as Record<string, unknown>);
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
          <input
            className="w-full rounded-lg border border-border-secondary bg-transparent p-2 px-2.5 text-sm outline-none transition-colors focus:border-border-brand"
            value={key}
            disabled={Boolean(item)}
            onChange={(e) => setKey(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm">Namespace</span>
          <input
            className="w-full rounded-lg border border-border-secondary bg-transparent p-2 px-2.5 text-sm outline-none transition-colors placeholder:text-text-placeholder focus:border-border-brand"
            placeholder="Root..."
            value={namespace}
            disabled={Boolean(item)}
            onChange={(e) => setNamespace(e.target.value)}
          />
        </label>
        <div className="flex flex-col gap-2">
          <span className="text-sm">Value</span>
          <div className="overflow-hidden rounded-md border border-border-secondary">
            <div className="cm-shell rounded-b-none">
              <CodeEditor value={text} lang={lang} onChange={setText} />
            </div>
            <EditorBar
              lang={lang}
              onLang={(next) => {
                const parsed = parseText(text, lang);
                setLang(next);
                if (!parsed.error) setText(toText(parsed.value, next));
              }}
              onCopy={() => void navigator.clipboard?.writeText(text)}
            />
          </div>
          {error && <span className="text-[13px] text-text-error-secondary">{error}</span>}
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 p-4">
        {item ? (
          <button type="button" className="btn btn-outline !rounded-sm text-text-error-secondary" onClick={() => void remove()}>
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
