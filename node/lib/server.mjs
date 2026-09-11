// Studio UI plus a streaming reverse proxy to the Agent Server, in Node. Mirrors the
// Python `proxy.py`: same routes, same connection endpoint, same state file.
import http from "node:http";
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";

export const DEFAULT_TARGET = "http://127.0.0.1:2024";
export const DEFAULT_PATH = "/studio";

/** Headers that describe a single hop and must not be forwarded verbatim. */
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "content-encoding",
  "host",
]);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
};

export const statePath = () =>
  path.join(process.env.XDG_CONFIG_HOME || path.join(homedir(), ".config"), "langgraph-studio-oss", "connection.json");

/** Target chosen in the Connected dialog last time; `null` if absent or unreadable. */
export function readSavedTarget(file = statePath()) {
  try {
    const target = JSON.parse(readFileSync(file, "utf8")).target;
    return target ? String(target).replace(/\/+$/, "") : null;
  } catch {
    return null;
  }
}

export function writeSavedTarget(target, file = statePath()) {
  try {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ target }));
  } catch {
    /* the switch still works for this process */
  }
}

const isHttpUrl = (s) => /^https?:\/\/[^/\s]+/.test(s);

/**
 * Create the HTTP server. `media` is the directory with the UI build; `stateFile`
 * receives the target chosen in the UI (`null` to keep it in memory only).
 */
export function createServer({ target = DEFAULT_TARGET, mountPath = DEFAULT_PATH, media, stateFile = null, fetchImpl = fetch }) {
  const mount = "/" + mountPath.replace(/^\/+|\/+$/g, "");
  const mediaDir = media ?? fileURLToPath(new URL("../media", import.meta.url));
  const state = { target: target.replace(/\/+$/, "") };

  const json = (res, status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  const redirectToRoot = (req, res) => {
    const q = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    res.writeHead(307, { location: `${mount}/${q}` });
    res.end();
  };

  const serveIndex = (res) => {
    const index = path.join(mediaDir, "index.html");
    if (!existsSync(index)) {
      res.writeHead(501, { "content-type": "text/html; charset=utf-8" });
      res.end("<h1>Frontend build is missing</h1><p>This package was built without the UI.</p>");
      return;
    }
    // no-store: a fresh build must be picked up without a hard reload
    res.writeHead(200, { "content-type": TYPES[".html"], "cache-control": "no-store" });
    createReadStream(index).pipe(res);
  };

  const serveAsset = (res, rel) => {
    const file = path.normalize(path.join(mediaDir, "assets", rel));
    if (!file.startsWith(path.join(mediaDir, "assets")) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, {
      "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
    });
    createReadStream(file).pipe(res);
  };

  const connection = async (req, res) => {
    if (req.method === "GET") return json(res, 200, { mode: "proxy", target: state.target });
    let body = "";
    for await (const chunk of req) body += chunk;
    let next = "";
    try {
      next = String(JSON.parse(body).target ?? "").trim().replace(/\/+$/, "");
    } catch {
      /* handled below */
    }
    if (!isHttpUrl(next)) return json(res, 400, { error: "target must be an http(s) URL" });
    state.target = next;
    if (stateFile) writeSavedTarget(next, stateFile);
    json(res, 200, { mode: "proxy", target: next });
  };

  const proxy = async (req, res) => {
    const ac = new AbortController();
    // `res` closing before it finished means the client went away: drop the upstream request
    // (`req` "close" fires as soon as the request body is consumed, so it is the wrong signal)
    res.on("close", () => {
      if (!res.writableFinished) ac.abort();
    });
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (!HOP_BY_HOP.has(k) && v !== undefined) headers.set(k, String(v));
    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    let upstream;
    try {
      upstream = await fetchImpl(state.target + req.url, {
        method: req.method,
        headers,
        body: hasBody ? Readable.toWeb(req) : undefined,
        duplex: hasBody ? "half" : undefined,
        signal: ac.signal,
        redirect: "manual",
      });
    } catch (e) {
      if (ac.signal.aborted) return;
      return json(res, 502, { error: `Agent Server unreachable: ${e instanceof Error ? e.message : e}` });
    }
    const out = {};
    for (const [k, v] of upstream.headers) if (!HOP_BY_HOP.has(k)) out[k] = v;
    res.writeHead(upstream.status, out);
    if (!upstream.body) return res.end();
    try {
      // Chunks go out as they arrive: this is what keeps SSE unbuffered
      for await (const chunk of upstream.body) {
        if (!res.write(chunk)) await new Promise((r) => res.once("drain", r));
      }
    } catch {
      /* client went away or upstream closed */
    }
    res.end();
  };

  return http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    if (url === mount) return redirectToRoot(req, res);
    if (url === `${mount}/`) return serveIndex(res);
    if (url === `${mount}/api/connection` && (req.method === "GET" || req.method === "PUT")) return void connection(req, res);
    if (url.startsWith(`${mount}/assets/`)) return serveAsset(res, url.slice(`${mount}/assets/`.length));
    if (url.startsWith(`${mount}/`)) return redirectToRoot(req, res);
    void proxy(req, res);
  });
}
