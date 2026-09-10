/**
 * JSON Schema as returned by Agent Server (`input_schema`, `config_schema`):
 * exactly the fields the UI needs, plus the LangGraph extensions
 * (`langgraph_nodes`, `langgraph_type`).
 */
export interface JsonSchema {
  type?: string | string[];
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  langgraph_nodes?: string[];
  langgraph_type?: string;
}

/** Primary schema type: the first non-`null` entry of `anyOf` and type lists. */
export function schemaType(s?: JsonSchema): string | undefined {
  const t = s?.type ?? s?.anyOf?.find((v) => v.type && v.type !== "null")?.type;
  return Array.isArray(t) ? t.find((v) => v !== "null") : t;
}

export const isNumericType = (type?: string): boolean => type === "number" || type === "integer";

/** LangChain message types the schema references via `$defs`. */
const MESSAGE_TYPES = [
  "AIMessage",
  "BaseMessage",
  "ChatMessage",
  "FunctionMessage",
  "HumanMessage",
  "SystemMessage",
  "ToolMessage",
];

/**
 * Whether the schema describes LangChain messages. An `Annotated[list, add_messages]` list
 * without types yields no such reference — and in that case the reference enables neither
 * Chat mode nor the message builder.
 */
export function refersToMessages(schema: unknown): boolean {
  if (!schema) return false;
  const text = JSON.stringify(schema);
  return MESSAGE_TYPES.some((t) => text.includes(`/${t}"`));
}
