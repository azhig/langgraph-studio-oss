import type { Theme } from "@/store/studio";

/**
 * Graph node colors.
 *
 * The scheme was captured from live Studio (docs/DESIGN-TOKENS.md, "Graph nodes") and reproduced
 * so that the same node name yields the same color as in the original:
 *
 *  1. name -> 32-bit FNV-1a hash;
 *  2. hash -> one step of a linear congruential generator; from it the hue
 *     (fractional part of the product with the golden ratio x 360 deg), saturation 50...70 %
 *     and lightness 40...90 %;
 *  3. all other colors derive from the base tone (HSLA): text is lightness 80 %
 *     in the dark theme and 40 % in the light one, fill is alpha 0.1, border is lightness capped
 *     at 60 %, minimap capped at 40 % (dark) / 60 % (light), edges are the border with alpha 0.8.
 *
 * The system `__start__` / `__end__` nodes get white (dark theme) or black (light) instead
 * of a base tone, after which the same rules apply to them.
 */

export type Hsla = [h: number, s: number, l: number, a: number];

export interface NodePalette {
  /** Base tone (for derived colors: edge labels, hatching). */
  tone: Hsla;
  /** Node border (opaque). */
  border: string;
  /** Node fill: tone with alpha 0.1. */
  background: string;
  /** Node avatar fill (the lettered circle in the log and settings): tone with alpha 0.2. */
  avatarBackground: string;
  /** Chip fill in the node card: tone with alpha 0.15. */
  chipBackground: string;
  /** Label text. */
  text: string;
  /** Outgoing edges: border color with alpha 0.8. */
  edge: string;
  /** Edge arrow: border color, opaque. */
  arrow: string;
  /** Rectangle on the minimap. */
  minimap: string;
  /** Gear dot (background and glyph), normal and hovered states. */
  dotBackground: string;
  dotBackgroundHover: string;
  dotForeground: string;
  dotForegroundHover: string;
  /** Hatching of a paused node: text with alpha 0.15. */
  stripes: string;
}

export const isSystemNode = (id: string) => id === "__start__" || id === "__end__";

/**
 * FNV-1a-style hash of the name, 32 bits. The multiplication is deliberately done in plain
 * double arithmetic rather than Math.imul: that is exactly how the reference computes it, and
 * with long names the high bits are lost. Replacing it with exact multiplication would change the colors.
 */
export function hashName(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

const SATURATION: [number, number] = [50, 70];
const LIGHTNESS: [number, number] = [40, 90];
const GOLDEN = 0.618033988749895;

/** Base tone from the hash. */
export function toneFromHash(hash: number): Hsla {
  const r = (1664525 * hash + 1013904223) % 2 ** 32;
  const hue = ((r * GOLDEN) % 1) * 360;
  const s = SATURATION[0] + (r % (SATURATION[1] - SATURATION[0] + 1));
  const l = LIGHTNESS[0] + (r % (LIGHTNESS[1] - LIGHTNESS[0] + 1));
  return [hue, s, l, 1];
}

export const hsla = ([h, s, l, a]: Hsla) => `hsla(${h}, ${s}%, ${l}%, ${a})`;
const withLightness = ([h, s, , a]: Hsla, l: number): Hsla => [h, s, l, a];
const capLightness = ([h, s, l, a]: Hsla, max: number): Hsla => [h, s, Math.min(max, l), a];
const withAlpha = ([h, s, l]: Hsla, a: number): Hsla => [h, s, l, a];

export function baseTone(id: string, theme: Theme): Hsla {
  if (isSystemNode(id)) return theme === "dark" ? [0, 0, 100, 1] : [0, 0, 0, 1];
  return toneFromHash(hashName(id));
}

export function paletteFromTone(tone: Hsla, theme: Theme, system = false): NodePalette {
  const dark = theme === "dark";
  const border = capLightness(tone, 60);
  const text = system ? tone : withLightness(tone, dark ? 80 : 40);
  // For system nodes edges and arrows take the original white/black, not the border (#999)
  const edgeTone = system ? tone : border;
  return {
    tone,
    border: hsla(border),
    background: hsla(withAlpha(tone, 0.1)),
    avatarBackground: hsla(withAlpha(tone, 0.2)),
    chipBackground: hsla(withAlpha(tone, 0.15)),
    text: hsla(text),
    edge: hsla(withAlpha(edgeTone, 0.8)),
    arrow: hsla(edgeTone),
    minimap: hsla(capLightness(tone, dark ? 40 : 60)),
    dotBackground: hsla(capLightness(tone, 60)),
    dotBackgroundHover: hsla(capLightness(tone, 45)),
    dotForeground: hsla(capLightness(tone, 25)),
    dotForegroundHover: hsla(capLightness(tone, 20)),
    stripes: hsla(withAlpha(text, 0.15)),
  };
}

const cache = new Map<string, NodePalette>();

export function nodePalette(id: string, theme: Theme): NodePalette {
  const key = `${theme}:${id}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const p = paletteFromTone(baseTone(id, theme), theme, isSystemNode(id));
  cache.set(key, p);
  return p;
}
