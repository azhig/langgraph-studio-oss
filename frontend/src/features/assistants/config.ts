import type { GraphSchema } from "@langchain/langgraph-sdk";
import { schemaType, type JsonSchema } from "@/lib/schema";
import { parseText, type Lang } from "@/features/input/format";

/**
 * Graph config fields (`config_schema`). The reference shows them in the
 * `Manage Assistants` modal and in the node panel: label is `title`, description below,
 * avatars of the `langgraph_nodes` the field belongs to on the right.
 */
export interface ConfigField {
  key: string;
  title: string;
  description?: string;
  /** Nodes the field belongs to: the reference shows them as circles on the right. */
  nodes: string[];
  /** `prompt` — multi-line prompt editor. */
  prompt: boolean;
  type?: string;
  default?: unknown;
  /** Enumeration of values: shown as a dropdown. */
  options?: string[];
}

/** Config fields in schema order; field nodes come from `langgraph_nodes`. */
export function configFields(schemas?: GraphSchema): ConfigField[] {
  const schema = schemas?.config_schema as JsonSchema | undefined;
  return Object.entries(schema?.properties ?? {}).map(([key, s]) => ({
    key,
    title: s.title ?? key,
    description: s.description,
    nodes: s.langgraph_nodes ?? [],
    prompt: s.langgraph_type === "prompt",
    type: schemaType(s),
    default: s.default,
    options: s.enum?.map(String),
  }));
}

/** Default values from the schema: `Default Configuration` starts with them. */
export function defaultConfig(schemas?: GraphSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of configFields(schemas)) if (f.default !== undefined) out[f.key] = f.default;
  return out;
}

/** Whether the graph has fields bound to a node: the gear icon on the node depends on it. */
export const nodeHasConfig = (fields: ConfigField[], node: string) => fields.some((f) => f.nodes.includes(node));

/** Result of reading the raw `configurable` editor: either a set of values or a message. */
export interface RawConfig {
  values?: Record<string, unknown>;
  error?: string;
}

/**
 * Editor text -> `configurable`. A graph without a `config_schema` has no fields to
 * generate, so the reference edits the whole object as text. Empty text means an empty
 * config; anything that is not a mapping cannot be sent as `config.configurable`.
 */
export function readConfigText(text: string, lang: Lang): RawConfig {
  const parsed = parseText(text, lang);
  if (parsed.error) return { error: parsed.error };
  if (parsed.value === undefined || parsed.value === null) return { values: {} };
  if (typeof parsed.value !== "object" || Array.isArray(parsed.value))
    return { error: "Configuration must be a set of keys and values." };
  return { values: parsed.value as Record<string, unknown> };
}
