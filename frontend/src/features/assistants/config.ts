import type { GraphSchema } from "@langchain/langgraph-sdk";
import { schemaType, type JsonSchema } from "@/lib/schema";

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
