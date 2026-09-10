import { parse, stringify } from "yaml";
import { refersToMessages, schemaType, type JsonSchema } from "@/lib/schema";

/** Value editor language. The reference offers YAML and JSON, YAML by default. */
export type Lang = "yaml" | "json";

export interface Parsed {
  value?: unknown;
  /** Parse error message; on error Submit is blocked. */
  error?: string;
}

/** Value -> text in the selected language. An empty string means "field not set". */
export function toText(value: unknown, lang: Lang): string {
  if (value === undefined) return "";
  if (lang === "json") return JSON.stringify(value, null, 2);
  // lineWidth 0: do not wrap long strings; in a narrow panel wrapping hurts readability
  return stringify(value, { lineWidth: 0 }).replace(/\n$/, "");
}

/** Text -> value. Empty text is not an error, just an absent value. */
export function parseText(text: string, lang: Lang): Parsed {
  if (!text.trim()) return {};
  try {
    return { value: lang === "json" ? JSON.parse(text) : parse(text) };
  } catch (e) {
    return { error: cleanMessage(e) };
  }
}

/**
 * Language switch preserving the value: parse with the old one, print with the new.
 * Text that does not parse is left as is; otherwise the edit would be lost.
 */
export function convertText(text: string, from: Lang, to: Lang): string {
  const parsed = parseText(text, from);
  return parsed.error ? text : toText(parsed.value, to);
}

/** Parser messages are verbose: keep the first line without the technical coordinates. */
function cleanMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const first = raw.split("\n")[0].trim();
  return first.replace(/^YAMLParseError:\s*/, "").replace(/\s+at position \d+.*$/, "");
}

/**
 * Initial field value. The reference substitutes an empty container by schema type:
 * for `messages` (an array) the editor initially holds `[]`.
 */
export function defaultValue(schema?: JsonSchema): unknown {
  if (schema && "default" in schema && schema.default !== undefined) return schema.default;
  switch (schemaType(schema)) {
    case "array":
      return [];
    case "object":
      return {};
    case "string":
      return "";
    default:
      return undefined;
  }
}

export interface Field {
  key: string;
  title: string;
  required: boolean;
  schema?: JsonSchema;
}

/** A `messages` field whose items are typed as LangChain messages: the reference edits it with the builder. */
export function isMessagesField(field: Field): boolean {
  return field.key === "messages" && refersToMessages(field.schema);
}

/** Input form fields in input_schema order. */
export function inputFields(inputSchema?: unknown): Field[] {
  const s = inputSchema as JsonSchema | undefined;
  const required = new Set(s?.required ?? []);
  return Object.entries(s?.properties ?? {}).map(([key, schema]) => ({
    key,
    title: schema?.title ?? key,
    required: required.has(key),
    schema,
  }));
}
