import { useState } from "react";
import { RefreshCw, Settings } from "lucide-react";
import { currentHost } from "@/platform";
import { apiRoot, readCustomHeaders } from "@/api/client";
import { useStudio } from "@/store/studio";
import { ConnectionModal } from "./ConnectionModal";

/**
 * Shown in place of the graph when the Agent Server does not answer. Explains how
 * to get a server running and offers a retry and the connection settings, so a fresh
 * install never ends on a bare error string.
 */
export function ConnectionHelp({ error }: { error?: string }) {
  const bootstrap = useStudio((s) => s.bootstrap);
  const [settings, setSettings] = useState(false);
  const vscode = currentHost() === "vscode";
  const headers = readCustomHeaders().length;

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-y-auto p-6">
      <div className="flex w-full max-w-[560px] flex-col gap-4 rounded-lg border border-border-secondary bg-bg-elevated p-5 text-sm">
        <div className="flex flex-col gap-1">
          <span className="text-base font-semibold tracking-tight text-text-primary">No Agent Server found</span>
          <span className="text-text-tertiary">
            Studio could not reach <span className="font-mono text-text-secondary">{apiRoot()}</span>
            {error ? <span className="text-text-quaternary"> ({error})</span> : null}. A running LangGraph Agent Server
            is required.
          </span>
        </div>

        <ol className="flex list-decimal flex-col gap-3 pl-5 text-text-secondary">
          <li>
            Install the LangGraph CLI with the in-memory server:
            <Code>pip install "langgraph-cli[inmem]"</Code>
          </li>
          <li>
            In a project that has a <span className="font-mono">langgraph.json</span>, start the server:
            <Code>langgraph dev --no-browser</Code>
            <span className="block text-xs text-text-tertiary">
              By default it listens on <span className="font-mono">http://127.0.0.1:2024</span>.
            </span>
          </li>
          <li>
            {vscode ? (
              <>
                Point the extension at it: open <span className="font-medium">Connected</span> in the header (or the{" "}
                <span className="font-mono">langgraphStudio.target</span> setting) and enter the server address.
              </>
            ) : (
              <>
                Make sure this page is served by that server (
                <span className="font-mono">
                  "http": {"{"}"app": "langgraph_studio_oss:app"{"}"}
                </span>{" "}
                in <span className="font-mono">langgraph.json</span>), or run the proxy:{" "}
                <Code>langgraph-studio-oss --target http://127.0.0.1:2024</Code>
              </>
            )}
          </li>
          {headers > 0 && (
            <li>Custom headers are configured ({headers}); check them if the server rejects requests.</li>
          )}
        </ol>

        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-sm btn-primary h-[35px]" onClick={() => void bootstrap()}>
            <RefreshCw size={16} strokeWidth={1.5} />
            Retry
          </button>
          <button type="button" className="btn btn-sm btn-outline h-[35px]" onClick={() => setSettings(true)}>
            <Settings size={16} strokeWidth={1.5} />
            Connection settings
          </button>
        </div>
      </div>
      <ConnectionModal open={settings} onClose={() => setSettings(false)} />
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-1 overflow-x-auto rounded-md border border-border-secondary bg-bg-secondary px-3 py-2 font-mono text-xs text-text-primary">
      {children}
    </pre>
  );
}
