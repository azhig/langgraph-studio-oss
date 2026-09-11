import { describe, expect, it } from "vitest";
import { configFields, defaultConfig, nodeHasConfig, readConfigText } from "./config";

const schemas = {
  config_schema: {
    type: "object",
    properties: {
      system_prompt: {
        type: "string",
        title: "System Prompt",
        description: "System prompt",
        default: "You are a helpful AI assistant.",
        langgraph_nodes: ["agent"],
        langgraph_type: "prompt",
      },
      temperature: { type: "number", default: 0.7 },
    },
  },
} as never;

describe("configFields", () => {
  it("keeps schema order and reads titles, nodes and the prompt type", () => {
    const fields = configFields(schemas);
    expect(fields.map((f) => f.key)).toEqual(["system_prompt", "temperature"]);
    expect(fields[0]).toMatchObject({ title: "System Prompt", nodes: ["agent"], prompt: true, type: "string" });
    // A field without a title falls back to its key, and only `langgraph_type` makes it a prompt
    expect(fields[1]).toMatchObject({ title: "temperature", nodes: [], prompt: false, type: "number" });
    expect(defaultConfig(schemas)).toEqual({ system_prompt: "You are a helpful AI assistant.", temperature: 0.7 });
    expect(nodeHasConfig(fields, "agent")).toBe(true);
    expect(nodeHasConfig(fields, "tools")).toBe(false);
    // A graph without `config_schema` has no fields: the values are edited as text
    expect(configFields(undefined)).toEqual([]);
    expect(defaultConfig({} as never)).toEqual({});
  });
});

describe("readConfigText", () => {
  it("reads a mapping in both languages and treats empty text as an empty config", () => {
    expect(readConfigText("foo: bar\nn: 7", "yaml")).toEqual({ values: { foo: "bar", n: 7 } });
    expect(readConfigText('{"foo": "bar"}', "json")).toEqual({ values: { foo: "bar" } });
    expect(readConfigText("{}", "yaml")).toEqual({ values: {} });
    expect(readConfigText("   ", "yaml")).toEqual({ values: {} });
  });

  it("refuses anything that is not a mapping and passes the parse error through", () => {
    expect(readConfigText("42", "yaml").error).toBeDefined();
    expect(readConfigText("- a\n- b", "yaml").error).toBeDefined();
    expect(readConfigText("{", "json").error).toBeDefined();
    expect(readConfigText("42", "yaml").values).toBeUndefined();
  });
});
