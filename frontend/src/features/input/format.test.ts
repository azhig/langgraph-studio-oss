import { describe, expect, it } from "vitest";
import { buildInputValue, convertText, defaultValue, inputFields, isMessagesField, parseText, toText } from "./format";

describe("toText / parseText", () => {
  it("prints YAML without wrapping long strings and JSON with indent 2", () => {
    const long = "word ".repeat(40).trim();
    const yaml = toText({ messages: [{ type: "human", content: long }] }, "yaml");
    // A long string stays on one line instead of wrapping at 80 characters
    expect(yaml).toContain(`content: ${long}`);
    expect(yaml.endsWith("\n")).toBe(false);
    expect(toText({ a: 1 }, "json")).toBe('{\n  "a": 1\n}');
    expect(toText(undefined, "yaml")).toBe("");
  });

  it("parses both languages; empty text is not an error", () => {
    expect(parseText("a: 1", "yaml")).toEqual({ value: { a: 1 } });
    expect(parseText('{"a": 1}', "json")).toEqual({ value: { a: 1 } });
    expect(parseText("   ", "json")).toEqual({});
  });

  it("error message is a single line without coordinates", () => {
    const { error } = parseText("{", "json");
    expect(error).toBeDefined();
    expect(error).not.toMatch(/\n/);
    expect(error).not.toMatch(/at position/);
    expect(parseText("a: [", "yaml").error).not.toMatch(/^YAMLParseError/);
  });
});

describe("convertText", () => {
  it("converts the value between languages and leaves unparsable text alone", () => {
    expect(convertText("a: 1", "yaml", "json")).toBe('{\n  "a": 1\n}');
    expect(convertText('{"a": 1}', "json", "yaml")).toBe("a: 1");
    expect(convertText("{", "json", "yaml")).toBe("{");
    expect(convertText("", "yaml", "json")).toBe("");
  });
});

describe("defaultValue", () => {
  it("empty container by type; an explicit default takes precedence", () => {
    expect(defaultValue({ type: "array" })).toEqual([]);
    expect(defaultValue({ type: "object" })).toEqual({});
    expect(defaultValue({ type: "string" })).toBe("");
    expect(defaultValue({ type: "integer" })).toBeUndefined();
    expect(defaultValue({ type: "integer", default: 3 })).toBe(3);
    expect(defaultValue({ anyOf: [{ type: "null" }, { type: "array" }] })).toEqual([]);
  });
});

describe("inputFields", () => {
  const schema = {
    properties: {
      messages: { title: "Messages", items: { $ref: "#/$defs/HumanMessage" } },
      count: { type: "integer" },
    },
    required: ["messages"],
  };

  it("preserves order and requiredness", () => {
    const fields = inputFields(schema);
    expect(fields.map((f) => f.key)).toEqual(["messages", "count"]);
    expect(fields[0]).toMatchObject({ title: "Messages", required: true });
    expect(fields[1]).toMatchObject({ title: "count", required: false });
  });

  it("message builder only for typed `messages`", () => {
    const [messages, count] = inputFields(schema);
    expect(isMessagesField(messages)).toBe(true);
    expect(isMessagesField(count)).toBe(false);
    expect(isMessagesField({ key: "messages", title: "m", required: false, schema: { type: "array" } })).toBe(false);
  });
});

describe("buildInputValue", () => {
  const fields = inputFields({
    type: "object",
    required: ["messages", "tools"],
    properties: {
      messages: { type: "array", items: {} },
      tools: { type: "array" },
      note: { type: "string" },
      props: { type: "object" },
    },
  });
  const lang = { messages: "yaml", tools: "yaml", note: "yaml", props: "json" } as const;
  // What the form holds before the user touches it
  const blank = Object.fromEntries(
    fields.map((f) => [f.key, toText(defaultValue(f.schema), lang[f.key as keyof typeof lang])]),
  );

  it("sends only the fields the user filled in — measured on the reference with a 13-key state", () => {
    expect(buildInputValue(fields, blank, lang)).toEqual({ input: {} });
    const typed = { ...blank, messages: "- type: human\n  content: go" };
    expect(buildInputValue(fields, typed, lang)).toEqual({ input: { messages: [{ type: "human", content: "go" }] } });
    // A field typed back to its prefilled value counts as untouched, a required one included
    expect(buildInputValue(fields, { ...typed, tools: "[]" }, lang).input).toEqual({
      messages: [{ type: "human", content: "go" }],
    });
    // Something actually written goes through, whatever the type
    expect(buildInputValue(fields, { ...typed, note: "hi", props: '{"a": 1}' }, lang).input).toEqual({
      messages: [{ type: "human", content: "go" }],
      note: "hi",
      props: { a: 1 },
    });
  });

  it("a parse error names the field and blocks the input", () => {
    expect(buildInputValue(fields, { ...blank, props: "{" }, lang)).toEqual({
      error: expect.stringMatching(/^props: /),
    });
  });
});
