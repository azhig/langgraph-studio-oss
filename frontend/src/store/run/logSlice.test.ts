import { describe, expect, it } from "vitest";
import { detailFromStorage } from "./logSlice";

describe("detailFromStorage", () => {
  it("no key — level 1, as in the reference", () => {
    expect(detailFromStorage(null)).toBe(1);
  });

  it("accepts only 0…3, anything else falls back to the default", () => {
    expect(detailFromStorage("0")).toBe(0);
    expect(detailFromStorage("3")).toBe(3);
    expect(detailFromStorage("7")).toBe(1);
    expect(detailFromStorage("abc")).toBe(1);
  });
});
