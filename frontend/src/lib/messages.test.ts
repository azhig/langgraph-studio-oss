import { describe, expect, it } from "vitest";
import {
  asMessages,
  buildContent,
  contentImages,
  messageKind,
  messagePlainText,
  messageText,
  roleLabel,
  roleTitle,
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
