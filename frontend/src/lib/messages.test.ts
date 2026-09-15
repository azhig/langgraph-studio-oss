import { describe, expect, it } from "vitest";
import {
  asMessages,
  buildContent,
  contentImages,
  isToolCallOnly,
  messageKind,
  messagePlainText,
  messageText,
  parsedContent,
  roleLabel,
  roleTitle,
  toolCalls,
} from "./messages";

describe("messageKind", () => {
  it("normalizes LangChain types and OpenAI roles to one form", () => {
    expect(messageKind({ type: "human" })).toBe("human");
    expect(messageKind({ type: "HumanMessage" })).toBe("human");
    expect(messageKind({ role: "user" })).toBe("human");
    expect(messageKind({ type: "AIMessage" })).toBe("ai");
    expect(messageKind({ role: "assistant" })).toBe("ai");
    expect(messageKind({ type: "tool" })).toBe("tool");
  });

  it("falls back to the default when the type is missing", () => {
    expect(messageKind({})).toBe("");
    expect(messageKind({}, "ai")).toBe("ai");
  });
});

describe("role labels", () => {
  it("uppercase for the bubble and title case for the tree", () => {
    expect(roleLabel({ type: "human" })).toBe("HUMAN");
    expect(roleLabel({ type: "ai" })).toBe("AI");
    expect(roleTitle({ type: "tool" })).toBe("Tool");
    expect(roleTitle({ type: "chat" })).toBe("Chat");
    // The tree title keeps OpenAI-style roles verbatim, the bubble label aliases them
    expect(roleTitle({ role: "assistant" })).toBe("Assistant");
    expect(roleLabel({ role: "assistant" })).toBe("AI");
  });
});

describe("messageText", () => {
  it("string as is, blocks as concatenated text, anything else as JSON", () => {
    expect(messageText("hi")).toBe("hi");
    expect(messageText([{ type: "text", text: "a" }, "b", { type: "image_url", image_url: { url: "u" } }])).toBe(
      'ab{"type":"image_url","image_url":{"url":"u"}}',
    );
    expect(messageText(null)).toBe("");
    expect(messageText({ a: 1 })).toBe('{"a":1}');
  });

  it("messagePlainText skips non-text blocks", () => {
    expect(
      messagePlainText([
        { type: "text", text: "a" },
        { type: "image_url", image_url: { url: "u" } },
      ]),
    ).toBe("a");
  });
});

describe("content with attachments", () => {
  it("is assembled into blocks only when images are present", () => {
    expect(buildContent("t", [])).toBe("t");
    expect(buildContent("t", ["u"])).toEqual([
      { type: "text", text: "t" },
      { type: "image_url", image_url: { url: "u" } },
    ]);
    expect(contentImages(buildContent("t", ["u", "v"]))).toEqual(["u", "v"]);
    expect(contentImages("t")).toEqual([]);
  });
});

describe("asMessages", () => {
  it("accepts only an array of messages", () => {
    expect(asMessages([{ type: "human", content: "x" }])).toHaveLength(1);
    expect(asMessages([{ role: "user", content: "x" }])).toHaveLength(1);
    expect(asMessages([{ content: "x" }])).toBeNull();
    expect(asMessages([])).toBeNull();
    expect(asMessages("x")).toBeNull();
  });
});

describe("tool calls", () => {
  const call = { name: "get_team", args: { unit: "sales" }, id: "call_1" };

  it("a model message with calls and no text is the one the chat hides", () => {
    expect(isToolCallOnly({ type: "ai", content: "", tool_calls: [call] })).toBe(true);
    expect(isToolCallOnly({ type: "ai", content: "Looking it up", tool_calls: [call] })).toBe(false);
    expect(isToolCallOnly({ type: "ai", content: "" })).toBe(false);
    expect(isToolCallOnly({ type: "tool", content: "", tool_calls: [call] })).toBe(false);
    expect(toolCalls({ type: "ai", content: "", tool_calls: [call, { args: {} } as never] })).toEqual([call]);
  });

  it("a tool result in JSON becomes data, anything else stays text", () => {
    expect(parsedContent('{"members": ["Anna"]}')).toEqual({ members: ["Anna"] });
    expect(parsedContent(" [1, 2]")).toEqual([1, 2]);
    expect(parsedContent("plain text")).toBe("plain text");
    expect(parsedContent("{not json")).toBe("{not json");
    expect(parsedContent([{ type: "text", text: '{"a": 1}' }])).toEqual({ a: 1 });
  });
});
