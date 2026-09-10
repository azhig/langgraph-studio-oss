import { describe, expect, it } from "vitest";
import { baseTone, hashName, nodePalette, paletteFromTone, toneFromHash } from "./colors";

describe("hashName", () => {
  it("is deterministic and sensitive to the name", () => {
    expect(hashName("agent")).toBe(hashName("agent"));
    expect(hashName("agent")).not.toBe(hashName("tools"));
    expect(hashName("")).toBe(2166136261);
  });
});

describe("toneFromHash", () => {
  it("keeps hue, saturation and lightness within the ranges measured on the reference", () => {
    for (const name of ["agent", "tools", "worker", "call_model", "a-very-long-node-name-with-many-chars"]) {
      const [h, s, l, a] = toneFromHash(hashName(name));
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
      expect(s).toBeGreaterThanOrEqual(50);
      expect(s).toBeLessThanOrEqual(70);
      expect(l).toBeGreaterThanOrEqual(40);
      expect(l).toBeLessThanOrEqual(90);
      expect(a).toBe(1);
    }
  });
});

describe("baseTone", () => {
  it("system nodes are white in the dark theme and black in the light one", () => {
    expect(baseTone("__start__", "dark")).toEqual([0, 0, 100, 1]);
    expect(baseTone("__end__", "light")).toEqual([0, 0, 0, 1]);
  });
});

describe("paletteFromTone", () => {
  it("derives colors by the reference rules", () => {
    const p = paletteFromTone([200, 60, 70, 1], "dark");
    expect(p.background).toBe("hsla(200, 60%, 70%, 0.1)");
    expect(p.avatarBackground).toBe("hsla(200, 60%, 70%, 0.2)");
    expect(p.chipBackground).toBe("hsla(200, 60%, 70%, 0.15)");
    expect(p.border).toBe("hsla(200, 60%, 60%, 1)");
    expect(p.text).toBe("hsla(200, 60%, 80%, 1)");
    expect(p.edge).toBe("hsla(200, 60%, 60%, 0.8)");
    expect(p.minimap).toBe("hsla(200, 60%, 40%, 1)");
  });

  it("in the light theme the text is darker and the minimap lighter", () => {
    const p = paletteFromTone([200, 60, 70, 1], "light");
    expect(p.text).toBe("hsla(200, 60%, 40%, 1)");
    expect(p.minimap).toBe("hsla(200, 60%, 60%, 1)");
  });
});

describe("nodePalette", () => {
  it("caches by name and theme", () => {
    expect(nodePalette("agent", "dark")).toBe(nodePalette("agent", "dark"));
    expect(nodePalette("agent", "dark")).not.toBe(nodePalette("agent", "light"));
  });
});
