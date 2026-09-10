import { useEffect, useState } from "react";
import type { Item } from "@langchain/langgraph-sdk";
import { ChevronDown, ChevronRight, Copy, Filter } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import { cx } from "@/lib/cx";
import { relativeTime } from "@/lib/time";
import { getClient } from "@/api/client";
import type { NamespaceTree } from "./tree";

const sameItem = (a: Item | null, b: Item) => a?.key === b.key && a.namespace.join("/") === b.namespace.join("/");

/**
 * Memory tree node: a row with a chevron and the segment name, nested segments
 * indented by 16 px, and at its own level the items of this namespace
 * (key and relative time), which are loaded on expand.
 */
export function NamespaceNode({
  node,
  selected,
  onSelect,
}: {
  node: NamespaceTree;
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
        // Take only this level's items: nested ones live in their own nodes
        if (!stale) setItems((found.items ?? []).filter((it) => it.namespace.length === node.path.length));
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
          {/* Item count in this namespace — badge to the right of the name */}
          {items.length > 0 && (
            <span className="rounded bg-bg-secondary px-1 text-xs text-text-tertiary">{items.length}</span>
          )}
        </span>
        <span
          className="cursor-pointer opacity-0 transition-opacity group-hover/trigger:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            copyText(node.path.join("/"));
          }}
        >
          <Copy size={16} strokeWidth={1.5} />
        </span>
        <span className="btn btn-ghost btn-icon self-center !p-1" aria-label="Filter">
          <Filter size={16} strokeWidth={1.5} />
        </span>
      </button>
      {open && (
        <div className="mt-1 ml-4 flex flex-col gap-1">
          {node.children.map((child) => (
            <NamespaceNode key={child.name} node={child} selected={selected} onSelect={onSelect} />
          ))}
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              className={cx(
                "flex w-full flex-row items-center gap-2 rounded-md p-2 text-left text-sm transition-colors hover:bg-bg-tertiary",
                sameItem(selected, item) && "bg-bg-tertiary",
              )}
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
