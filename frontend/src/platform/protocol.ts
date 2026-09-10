/**
 * Protocol between the webview and the VS Code extension host. A copy of this file lives in
 * `vscode/src/protocol.ts`: the packages are built independently, but the types must match.
 *
 * A request to the Agent Server is sent whole (method, path, headers, body); the response
 * arrives as headers plus a stream of body chunks — this is how run SSE events are streamed.
 */

export type ToHost =
  | { type: "fetch"; id: number; method: string; path: string; headers: [string, string][]; body?: string }
  | { type: "abort"; id: number }
  | { type: "connection:get"; id: number }
  | { type: "connection:set"; id: number; target: string; headers: [string, string][] }
  | { type: "open"; url: string };

export type ToWebview =
  | { type: "response"; id: number; status: number; statusText: string; headers: [string, string][] }
  /** Response body chunk in base64: SSE is text, but the body may also be binary. */
  | { type: "chunk"; id: number; data: string }
  | { type: "end"; id: number }
  | { type: "error"; id: number; message: string }
  | { type: "connection"; id: number; target: string; headers: [string, string][] };
