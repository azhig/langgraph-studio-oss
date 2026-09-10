import * as vscode from "vscode";
import { readFileSync } from "node:fs";
import { Relay } from "./relay";
import type { ToHost } from "./protocol";

/**
 * The extension opens the same UI the Python package serves, in a webview panel.
 * The frontend build lives in `media/`; the webview has no network access, so requests
 * to the Agent Server go through `Relay` in the host, and the server address and custom
 * headers live in VS Code settings.
 */
const SECTION = "langgraphStudio";
const VIEW_TYPE = "langgraphStudio.panel";

let panel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("langgraphStudio.open", () => {
      if (panel) {
        panel.reveal();
        return;
      }
      panel = createPanel(context);
      panel.onDidDispose(() => {
        panel = undefined;
      });
    }),
  );
}

export function deactivate(): void {
  panel?.dispose();
}

const config = () => vscode.workspace.getConfiguration(SECTION);
const target = () => String(config().get("target") ?? "http://127.0.0.1:2024").replace(/\/+$/, "");
const headers = () => (config().get("customHeaders") as Record<string, string> | undefined) ?? {};

function createPanel(context: vscode.ExtensionContext): vscode.WebviewPanel {
  const media = vscode.Uri.joinPath(context.extensionUri, "media");
  const created = vscode.window.createWebviewPanel(VIEW_TYPE, "LangGraph Studio", vscode.ViewColumn.One, {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [media],
  });
  const relay = new Relay({ target, headers, send: (m) => void created.webview.postMessage(m) });
  created.webview.html = renderHtml(created.webview, media);
  created.webview.onDidReceiveMessage((message: ToHost) => void handleMessage(message, relay, created));
  created.onDidDispose(() => relay.dispose());
  return created;
}

async function handleMessage(message: ToHost, relay: Relay, host: vscode.WebviewPanel): Promise<void> {
  switch (message.type) {
    case "fetch":
    case "abort":
      relay.handle(message);
      return;
    case "connection:get":
      await host.webview.postMessage({ type: "connection", id: message.id, target: target(), headers: Object.entries(headers()) });
      return;
    case "connection:set": {
      const next = message.target.trim().replace(/\/+$/, "");
      if (!/^https?:\/\/[^/\s]+/.test(next)) {
        await host.webview.postMessage({ type: "error", id: message.id, message: "target must be an http(s) URL" });
        return;
      }
      const scope = vscode.ConfigurationTarget.Global;
      await config().update("target", next, scope);
      await config().update("customHeaders", Object.fromEntries(message.headers), scope);
      await host.webview.postMessage({ type: "connection", id: message.id, target: target(), headers: Object.entries(headers()) });
      return;
    }
    case "open":
      await vscode.env.openExternal(vscode.Uri.parse(message.url));
      return;
    default:
      return;
  }
}

/**
 * The built page with rewritten asset links and the webview CSP. Network is closed
 * (`connect-src 'none'`): all requests go through `postMessage`.
 */
function renderHtml(webview: vscode.Webview, media: vscode.Uri): string {
  const nonce = Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join("");
  const assets = webview.asWebviewUri(vscode.Uri.joinPath(media, "assets")).toString();
  const csp = [
    "default-src 'none'",
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src ${webview.cspSource} 'nonce-${nonce}'`,
    `font-src ${webview.cspSource}`,
    `img-src ${webview.cspSource} data: https:`,
    "connect-src 'none'",
  ].join("; ");
  const html = readFileSync(vscode.Uri.joinPath(media, "index.html").fsPath, "utf8");
  return html
    .replace(/\.\/assets\//g, `${assets}/`)
    .replace(/<script /g, `<script nonce="${nonce}" `)
    .replace("<head>", `<head><meta http-equiv="Content-Security-Policy" content="${csp}">`);
}
