import { useEffect, useState } from "react";
import { Eye, EyeOff, FileText, Plus, Trash2, X } from "lucide-react";
import {
  apiRoot,
  fetchConnection,
  readCustomHeaders,
  saveCustomHeaders,
  updateConnectionTarget,
  type Connection,
  type CustomHeader,
} from "@/api/client";
import { FieldError } from "@/components/FieldError";
import { Modal } from "@/components/Modal";
import { useStudio } from "@/store/studio";

const DOCS = "https://docs.langchain.com/langgraph-platform/quick-start-studio#local-development-server";

const LABEL = "text-xs leading-tight font-medium tracking-snug";
const FIELD =
  "flex w-full items-center gap-2 rounded-md border border-border-secondary bg-transparent px-3 py-2 transition-colors focus-within:border-border-brand";
const INPUT =
  "min-w-0 max-w-full flex-1 border-none bg-transparent p-0 text-sm leading-normal outline-none placeholder:text-text-placeholder";

/**
 * `Configure Studio connection` — the dialog behind the `Connected` button. Taken from the reference:
 * 600 px sheet, header with title and subtitle, form with a 20 px gap,
 * footer `Docs … Cancel Connect`.
 *
 * `Base URL` is editable only in proxy mode: the new address is sent to the server
 * (`PUT api/connection`), and the proxy switches to it — the browser still
 * talks to its own origin. In mounted mode the address is fixed: the page is served
 * by the Agent Server itself. The `Advanced Settings` section (trusted LangSmith
 * tunnel domains) is not needed. Custom headers are stored in the browser and sent with every
 * request — this is how servers behind authentication are connected.
 */
export function ConnectionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} width={600} autoHeight>
      <ConnectionForm onClose={onClose} />
    </Modal>
  );
}

function ConnectionForm({ onClose }: { onClose: () => void }) {
  const bootstrap = useStudio((s) => s.bootstrap);
  const [connection, setConnection] = useState<Connection>();
  const [target, setTarget] = useState("");
  const [headers, setHeaders] = useState<CustomHeader[]>(readCustomHeaders);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const edit = (i: number, patch: Partial<CustomHeader>) =>
    setHeaders((prev) => prev.map((h, j) => (j === i ? { ...h, ...patch } : h)));

  useEffect(() => {
    let stale = false;
    fetchConnection()
      .then((c) => {
        if (stale) return;
        setConnection(c);
        setTarget(c.target ?? apiRoot());
      })
      .catch(() => {
        if (!stale) setConnection({ mode: "mounted", target: null });
      });
    return () => {
      stale = true;
    };
  }, []);

  // The address is changed by the host: the `langgraph-studio-oss` proxy or the VS Code extension
  const proxy = connection?.mode === "proxy" || connection?.mode === "vscode";

  const connect = async () => {
    setBusy(true);
    setError(undefined);
    try {
      if (proxy && target.trim() !== connection?.target) await updateConnectionTarget(target.trim());
      saveCustomHeaders(headers);
      onClose();
      // New address or headers mean a new client: re-read the server, assistants and graph
      void bootstrap();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="m-0 min-h-14 shrink-0 p-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="flex min-w-0 flex-col gap-1 text-base leading-tight font-semibold tracking-tight">
            <span className="text-sm leading-normal tracking-normal">Configure Studio connection</span>
            <span className="text-xs leading-tight font-normal tracking-snug text-text-tertiary">
              Where this Studio finds your Agent Server
            </span>
          </h3>
          <button
            type="button"
            aria-label="Close"
            className="btn btn-ghost btn-icon shrink-0 self-start !p-1 text-text-secondary"
            onClick={onClose}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>
      <form
        className="flex min-h-0 flex-col gap-5 overflow-y-auto p-4 pt-0"
        onSubmit={(e) => {
          e.preventDefault();
          void connect();
        }}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="connection-base-url" className={`${LABEL} text-text-secondary`}>
            Base URL
          </label>
          <div className={FIELD}>
            <input
              id="connection-base-url"
              className={INPUT}
              type="text"
              placeholder="http://localhost:2024"
              readOnly={!proxy}
              value={connection ? (proxy ? target : (connection.target ?? apiRoot())) : ""}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
          {connection && !proxy && (
            <span className="text-xs leading-tight tracking-snug text-text-secondary">
              Served by the Agent Server itself, so the address is fixed. Run{" "}
              <span className="font-mono">langgraph-studio-oss --target …</span> to point Studio at another server.
            </span>
          )}
          {error && <FieldError text={error} className="px-0" />}
        </div>
        <div className="flex flex-col gap-2">
          <span className={LABEL}>Custom Headers</span>
          <span className="text-xs leading-tight tracking-snug text-text-secondary">
            Kept on this machine only and sent with every request to the server.
          </span>
          <div className="flex flex-col gap-2">
            {headers.map((h, i) => (
              <HeaderRow
                key={i}
                header={h}
                onChange={(patch) => edit(i, patch)}
                onDelete={() => setHeaders((prev) => prev.filter((_, j) => j !== i))}
              />
            ))}
            <button
              type="button"
              aria-label="Custom Header"
              className="btn btn-outline self-start"
              onClick={() => setHeaders((prev) => [...prev, { name: "", value: "" }])}
            >
              <Plus size={16} strokeWidth={1.5} />
              Custom Header
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <a href={DOCS} target="_blank" rel="noreferrer">
            <button type="button" aria-label="Docs" className="btn btn-sm btn-outline h-[35px]">
              <FileText size={16} strokeWidth={1.5} />
              Docs
            </button>
          </a>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Cancel" className="btn btn-sm btn-outline h-[35px]" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" aria-label="Connect" className="btn btn-sm btn-primary h-[35px]" disabled={busy}>
              Connect
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

/** Header row: name, value (hidden like a password, with an eye toggle) and removal. */
function HeaderRow({
  header,
  onChange,
  onDelete,
}: {
  header: CustomHeader;
  onChange: (patch: Partial<CustomHeader>) => void;
  onDelete: () => void;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="flex w-full items-start gap-2">
      <div className={FIELD}>
        <input
          className={INPUT}
          type="text"
          placeholder="Header name"
          value={header.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>
      <div className="relative grid min-w-[50%] grid-cols-[1fr_auto] rounded-md border border-border-secondary focus-within:border-border-brand">
        <input
          className="min-w-0 border-none bg-transparent py-2 pr-0 pl-2.5 font-mono text-sm outline-none placeholder:text-text-secondary"
          type={shown ? "text" : "password"}
          autoComplete="off"
          spellCheck={false}
          placeholder="Header value"
          value={header.value}
          onChange={(e) => onChange({ value: e.target.value })}
        />
        <button
          type="button"
          aria-label="toggle password visibility"
          className="px-2 py-1.5"
          onClick={() => setShown((v) => !v)}
        >
          {shown ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
        </button>
      </div>
      <button
        type="button"
        aria-label="Delete custom header"
        className="btn btn-sm btn-outline size-[34px] shrink-0 !p-2"
        onClick={onDelete}
      >
        <Trash2 size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
}
