import { useCallback, useEffect, useMemo, useState } from "react";
import type { Item } from "@langchain/langgraph-sdk";
import { Plus, Search } from "lucide-react";
import { Modal } from "@/components/Modal";
import { getClient } from "@/api/client";
import { ItemForm } from "./ItemForm";
import { NamespaceNode } from "./NamespaceTree";
import { buildNamespaceTree } from "./tree";

/**
 * `Memory` — the server's Store items. Full-screen window with a margin (the reference:
 * `w-[calc(100vw-32px)] max-w-screen-xl`, height from 65% of the screen), namespace tree
 * and the `Add new item` button on the left, the form on the right: `Key`, `Namespace`, `Value`.
 */
export function MemoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  // The selected item survives closing the window; the list is reloaded on every open
  const [selected, setSelected] = useState<Item | null>(null);
  const [creating, setCreating] = useState(true);

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={Math.min(window.innerWidth - 32, 1280)}
      height={Math.round(window.innerHeight * 0.75)}
    >
      <MemoryPanel
        selected={selected}
        creating={creating}
        onSelect={(item) => {
          setSelected(item);
          setCreating(false);
        }}
        onCreate={() => {
          setSelected(null);
          setCreating(true);
        }}
        onClose={onClose}
      />
    </Modal>
  );
}

async function fetchNamespaces(): Promise<string[][]> {
  try {
    const found = await getClient().store.listNamespaces({ limit: 200 });
    return found.namespaces ?? [];
  } catch {
    return [];
  }
}

function MemoryPanel({
  selected,
  creating,
  onSelect,
  onCreate,
  onClose,
}: {
  selected: Item | null;
  creating: boolean;
  onSelect: (item: Item) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  const [state, setState] = useState<{ loading: boolean; namespaces: string[][] }>({ loading: true, namespaces: [] });
  const { loading, namespaces } = state;

  // The panel mounts together with the window, so loading on mount is loading on open
  useEffect(() => {
    let stale = false;
    void fetchNamespaces().then((found) => {
      if (!stale) setState({ loading: false, namespaces: found });
    });
    return () => {
      stale = true;
    };
  }, []);

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    setState({ loading: false, namespaces: await fetchNamespaces() });
  }, []);

  const tree = useMemo(() => buildNamespaceTree(namespaces), [namespaces]);

  return (
    <div className="flex h-full min-h-0">
      <div className="flex w-[35%] min-w-[300px] flex-col rounded-l-xl bg-bg-secondary">
        <h2 className="p-4 pb-2 text-xl font-semibold tracking-tighter">Memory</h2>
        <div className="relative flex-grow">
          <div className="scroll-thin absolute inset-0 overflow-auto">
            {tree.length === 0 ? (
              <EmptyTree loading={loading} />
            ) : (
              <div className="flex flex-col gap-1 px-2 pb-3">
                {tree.map((node) => (
                  <NamespaceNode key={node.name} node={node} selected={selected} onSelect={onSelect} />
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col p-4">
          <button type="button" className="btn btn-brand-outline w-full !rounded-sm" onClick={onCreate}>
            <Plus size={14} strokeWidth={1.8} />
            Add new item
          </button>
        </div>
      </div>

      <ItemForm
        key={selected ? `${selected.namespace.join("/")}:${selected.key}` : "new"}
        item={creating ? null : selected}
        onClose={onClose}
        onSaved={reload}
      />
    </div>
  );
}

function EmptyTree({ loading }: { loading: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 py-4">
      <span className="inline-flex items-center justify-center rounded-full bg-bg-tertiary p-3 text-text-secondary">
        <Search size={20} strokeWidth={1.5} />
      </span>
      <div className="flex max-w-xs flex-col gap-2 text-center">
        <h3 className="text-base leading-tight font-semibold tracking-tight">
          {loading ? "Loading…" : "No items found"}
        </h3>
        <p className="text-sm text-text-tertiary">Create a new item to get started</p>
      </div>
    </div>
  );
}
