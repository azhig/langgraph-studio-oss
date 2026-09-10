import { describe, expect, it } from "vitest";
import { isNumericType, refersToMessages, schemaType } from "./schema";

describe("schemaType", () => {
  it("takes the first non-null type from anyOf and lists", () => {
    expect(schemaType({ type: "string" })).toBe("string");
    expect(schemaType({ type: ["null", "integer"] })).toBe("integer");
    expect(schemaType({ anyOf: [{ type: "null" }, { type: "number" }] })).toBe("number");
    expect(schemaType(undefined)).toBeUndefined();
  });
});

describe("isNumericType", () => {
  it("number and integer", () => {
    expect(isNumericType("number")).toBe(true);
    expect(isNumericType("integer")).toBe(true);
    expect(isNumericType("string")).toBe(false);
    expect(isNumericType(undefined)).toBe(false);
  });
});

describe("refersToMessages", () => {
  it("finds references to LangChain message types", () => {
    expect(refersToMessages({ items: { anyOf: [{ $ref: "#/$defs/HumanMessage" }] } })).toBe(true);
    expect(refersToMessages({ items: { $ref: "#/$defs/BaseMessage" } })).toBe(true);
    expect(refersToMessages({ type: "array", items: {} })).toBe(false);
    expect(refersToMessages(undefined)).toBe(false);
  });
});
