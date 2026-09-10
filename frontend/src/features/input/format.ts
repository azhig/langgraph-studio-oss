import { parse, stringify } from "yaml";

/** Язык редактора значения. Эталон предлагает YAML и JSON, по умолчанию YAML. */
export type Lang = "yaml" | "json";

export interface Parsed {
  value?: unknown;
  /** Сообщение об ошибке разбора; при ошибке Submit блокируется. */
  error?: string;
}

/** Значение → текст в выбранном языке. Пустая строка означает «поле не задано». */
export function toText(value: unknown, lang: Lang): string {
  if (value === undefined) return "";
  if (lang === "json") return JSON.stringify(value, null, 2);
  // lineWidth 0 — не переносить длинные строки: в узкой панели перенос мешает читать
  return stringify(value, { lineWidth: 0 }).replace(/\n$/, "");
}

/** Текст → значение. Пустой текст — не ошибка, просто отсутствие значения. */
export function parseText(text: string, lang: Lang): Parsed {
  if (!text.trim()) return {};
  try {
    return { value: lang === "json" ? JSON.parse(text) : parse(text) };
  } catch (e) {
    return { error: cleanMessage(e) };
  }
}

/** Сообщения парсеров многословны: оставляем первую строку без служебных координат. */
function cleanMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const first = raw.split("\n")[0].trim();
  return first.replace(/^YAMLParseError:\s*/, "").replace(/\s+at position \d+.*$/, "");
}

type Schema = {
  type?: string | string[];
  default?: unknown;
  properties?: Record<string, Schema>;
  items?: Schema;
  anyOf?: Schema[];
  title?: string;
  description?: string;
};

const typeOf = (s?: Schema): string | undefined => {
  const t = s?.type ?? s?.anyOf?.find((v) => v.type && v.type !== "null")?.type;
  return Array.isArray(t) ? t.find((v) => v !== "null") : t;
};

/**
 * Начальное значение поля. Эталон подставляет пустой контейнер по типу схемы:
 * для `messages` (массив) в редакторе изначально стоит `[]`.
 */
export function defaultValue(schema?: Schema): unknown {
  if (schema && "default" in schema && schema.default !== undefined) return schema.default;
  switch (typeOf(schema)) {
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

/** Сообщения LangChain: схема ссылается на их типы (`AIMessage`, `HumanMessage`…). */
const MESSAGE_TYPES = ["AIMessage", "HumanMessage", "SystemMessage", "ToolMessage", "ChatMessage"];

export function isMessagesField(field: Field): boolean {
  if (field.key !== "messages") return false;
  const text = JSON.stringify(field.schema ?? {});
  return MESSAGE_TYPES.some((t) => text.includes(`/${t}"`));
}

export interface Field {
  key: string;
  title: string;
  required: boolean;
  schema?: Schema;
}

/** Поля формы ввода в порядке из input_schema. */
export function inputFields(inputSchema?: unknown): Field[] {
  const s = inputSchema as { properties?: Record<string, Schema>; required?: string[] } | undefined;
  const required = new Set(s?.required ?? []);
  return Object.entries(s?.properties ?? {}).map(([key, schema]) => ({
    key,
    title: schema?.title ?? key,
    required: required.has(key),
    schema,
  }));
}
