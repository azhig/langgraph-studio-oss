/**
 * LangChain messages as they arrive from the graph state: an object with `type`
 * (or `role`) and `content` — a string or a list of blocks (`text`, `image_url`).
 * Every place that displays or edits a message reads it from here.
 */

export interface ToolCall {
  name: string;
  args?: unknown;
  id?: string;
}

export interface MessageLike {
  id?: unknown;
  type?: string;
  role?: string;
  content?: unknown;
  name?: string;
  tool_calls?: ToolCall[];
}

/** Content block: the reference stores attachments next to the text as a list of blocks. */
export interface ContentBlock {
  type: string;
  text?: string;
  image_url?: { url: string };
}

/** Normalized message type: `HumanMessage` / `user` → `human`, `AIMessage` / `assistant` → `ai`. */
export type MessageKind = "human" | "ai" | "system" | "tool" | "function" | (string & {});

const KIND_ALIASES: Record<string, MessageKind> = { user: "human", assistant: "ai" };

const ROLE_TITLES: Record<string, string> = {
  human: "Human",
  ai: "AI",
  tool: "Tool",
  system: "System",
  function: "Function",
};

const rawKind = (m: MessageLike, fallback: string) =>
  String(m.type ?? m.role ?? fallback)
    .toLowerCase()
    .replace(/message$/, "");

export function messageKind(m: MessageLike, fallback = ""): MessageKind {
  const raw = rawKind(m, fallback);
  return KIND_ALIASES[raw] ?? raw;
}

/** Uppercase role — this is how a message bubble is labeled in the log. */
export function roleLabel(m: MessageLike): string {
  const kind = messageKind(m);
  return (ROLE_TITLES[kind] ?? kind).toUpperCase();
}

/**
 * Role as a tree node title: `Human`, `AI`, `Tool` — as in the reference. Unlike the
 * bubble label, the title does not alias OpenAI roles: a `role: "assistant"` message
 * is titled `Assistant` (measured on the reference), while its bubble still says `AI`.
 */
export function roleTitle(m: MessageLike): string {
  const kind = rawKind(m, "");
  return ROLE_TITLES[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);
}

/** Message text: a string as is, a block list as its text parts concatenated, anything else as JSON. */
export function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content))
    return content
      .map((part) => (typeof part === "string" ? part : ((part as ContentBlock)?.text ?? JSON.stringify(part))))
      .join("");
  if (content === undefined || content === null) return "";
  return JSON.stringify(content);
}

/** Text blocks only — for inputs and labels where attachments are shown separately. */
export function messagePlainText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content))
    return content.map((part) => (typeof part === "string" ? part : ((part as ContentBlock)?.text ?? ""))).join("");
  return content === undefined || content === null ? "" : JSON.stringify(content);
}

/** Attachment links: in the reference these are `image_url` blocks. */
export function contentImages(content: unknown): string[] {
  if (!Array.isArray(content)) return [];
  return (content as ContentBlock[]).flatMap((p) =>
    p && p.type === "image_url" && p.image_url?.url ? [p.image_url.url] : [],
  );
}

/**
 * Reassembles `content`: without attachments the reference keeps a plain string,
 * with attachments — a list of blocks where the text comes first.
 */
export function buildContent(text: string, images: string[]): unknown {
  return images.length
    ? [{ type: "text", text }, ...images.map((url) => ({ type: "image_url", image_url: { url } }))]
    : text;
}

/** Array of LangChain messages: every element has content and a role. */
export function asMessages(value: unknown): MessageLike[] | null {
  if (!Array.isArray(value) || !value.length) return null;
  const ok = value.every((v) => v && typeof v === "object" && "content" in v && ("type" in v || "role" in v));
  return ok ? (value as MessageLike[]) : null;
}
