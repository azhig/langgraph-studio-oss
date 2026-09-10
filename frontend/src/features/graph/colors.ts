import type { Theme } from "@/store/studio";

/**
 * Цвета узлов графа.
 *
 * Схема снята с живого Studio (docs/DESIGN-TOKENS.md, «Узлы графа») и воспроизведена
 * так, чтобы одно и то же имя узла давало тот же цвет, что и в оригинале:
 *
 *  1. имя → 32-битный хэш FNV-1a;
 *  2. хэш → один шаг линейного конгруэнтного генератора; из него — оттенок
 *     (дробная часть произведения на золотое сечение × 360°), насыщенность 50…70 %
 *     и светлота 40…90 %;
 *  3. из базового тона (HSLA) выводятся все остальные цвета: текст — светлота 80 %
 *     в тёмной теме и 40 % в светлой, заливка — alpha 0.1, рамка — светлота не выше
 *     60 %, минимапа — не выше 40 % (тёмная) / 60 % (светлая), рёбра — рамка с alpha 0.8.
 *
 * Служебные `__start__` / `__end__` вместо базового тона получают белый (тёмная тема)
 * или чёрный (светлая), после чего к ним применяются те же правила.
 */

export type Hsla = [h: number, s: number, l: number, a: number];

export interface NodePalette {
  /** Базовый тон (для производных: подписи рёбер, штриховка). */
  tone: Hsla;
  /** Рамка узла (непрозрачная). */
  border: string;
  /** Заливка узла: тон с alpha 0.1. */
  background: string;
  /** Текст подписи. */
  text: string;
  /** Исходящие рёбра: цвет рамки с alpha 0.8. */
  edge: string;
  /** Стрелка ребра: цвет рамки, непрозрачный. */
  arrow: string;
  /** Прямоугольник на минимапе. */
  minimap: string;
  /** Точка-шестерёнка (фон и глиф), обычное состояние и при наведении. */
  dotBackground: string;
  dotBackgroundHover: string;
  dotForeground: string;
  dotForegroundHover: string;
  /** Штриховка узла на паузе: текст с alpha 0.15. */
  stripes: string;
}

export const isSystemNode = (id: string) => id === "__start__" || id === "__end__";

/**
 * Хэш имени в духе FNV-1a, 32 бита. Умножение намеренно выполняется в обычной
 * арифметике double, а не через Math.imul: именно так считает эталон, и при
 * длинных именах старшие биты теряются. Замена на точное умножение даст другие цвета.
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

/** Базовый тон из хэша. */
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
  // У служебных узлов рёбра и стрелки берут исходный белый/чёрный, а не рамку (#999)
  const edgeTone = system ? tone : border;
  return {
    tone,
    border: hsla(border),
    background: hsla(withAlpha(tone, 0.1)),
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
