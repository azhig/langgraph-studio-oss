import type { GraphSchema } from "@langchain/langgraph-sdk";

/**
 * Поля конфигурации графа (`config_schema`). Эталон показывает их в модалке
 * `Manage Assistants` и в панели узла: подпись — `title`, под ней описание,
 * справа — аватары узлов из `langgraph_nodes`, к которым поле относится.
 */
export interface ConfigField {
  key: string;
  title: string;
  description?: string;
  /** Узлы, которым принадлежит поле: у эталона они показаны кружками справа. */
  nodes: string[];
  /** `prompt` — многострочный редактор промпта. */
  prompt: boolean;
  type?: string;
  default?: unknown;
  /** Перечисление значений: показывается выпадающим списком. */
  options?: string[];
}

type Schema = {
  type?: string | string[];
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  langgraph_nodes?: string[];
  langgraph_type?: string;
  anyOf?: Schema[];
};

const typeOf = (s?: Schema): string | undefined => {
  const t = s?.type ?? s?.anyOf?.find((v) => v.type && v.type !== "null")?.type;
  return Array.isArray(t) ? t.find((v) => v !== "null") : t;
};

/** Поля конфигурации в порядке из схемы; узлы поля — из `langgraph_nodes`. */
export function configFields(schemas?: GraphSchema): ConfigField[] {
  const schema = schemas?.config_schema as { properties?: Record<string, Schema> } | undefined;
  return Object.entries(schema?.properties ?? {}).map(([key, s]) => ({
    key,
    title: s.title ?? key,
    description: s.description,
    nodes: s.langgraph_nodes ?? [],
    prompt: s.langgraph_type === "prompt",
    type: typeOf(s),
    default: s.default,
    options: s.enum?.map(String),
  }));
}

/** Значения по умолчанию из схемы: с них начинается `Default Configuration`. */
export function defaultConfig(schemas?: GraphSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of configFields(schemas)) if (f.default !== undefined) out[f.key] = f.default;
  return out;
}

/** Есть ли у графа поля, привязанные к узлу: от этого зависит шестерёнка на узле. */
export const nodeHasConfig = (fields: ConfigField[], node: string) =>
  fields.some((f) => f.nodes.includes(node));
