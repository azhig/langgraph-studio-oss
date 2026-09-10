import type { Lang } from "./format";

/**
 * Value highlighting for viewing (not an editor). The reference shows state
 * exactly this way: monospace text with colored keys, strings and literals, and only
 * on the "Show full editor" button swaps it for an editor with line numbers.
 *
 * Palette and font measured on the reference (docs/DESIGN-TOKENS.md, "State values"):
 * `Fira Code` 14px/21px, key is blue, string is green, number/date/`null` are orange,
 * list dash is gray, empty `{}` and `[]` are the regular text color.
 */
export function HighlightedCode({ text, lang }: { text: string; lang: Lang }) {
  return (
    <pre className="hl px-[13px] py-3 break-words whitespace-pre-wrap">
      {lang === "json" ? highlightJson(text) : highlightYaml(text)}
    </pre>
  );
}

type Part = { text: string; cls?: string };

const LITERAL = /^(null|~|true|false|-?\d+(\.\d+)?([eE][+-]?\d+)?|\d{4}-\d{2}-\d{2}[T ][\d:.+Z-]*)$/;

/** Value of a YAML line: literals in a separate color, everything else as a string. */
function valueParts(value: string): Part[] {
  if (!value) return [];
  if (value === "{}" || value === "[]" || value === "|" || value === ">") return [{ text: value, cls: "hl-punct" }];
  return [{ text: value, cls: LITERAL.test(value) ? "hl-literal" : "hl-string" }];
}

function highlightYaml(text: string) {
  return text.split("\n").map((line, i) => {
    const parts: Part[] = [];
    const indent = /^\s*/.exec(line)?.[0] ?? "";
    let rest = line.slice(indent.length);
    if (indent) parts.push({ text: indent });
    // List item: the dash in a separate color, the rest is parsed as a regular line
    while (rest.startsWith("- ") || rest === "-") {
      const dash = rest === "-" ? "-" : "- ";
      parts.push({ text: "-", cls: "hl-dash" });
      if (dash.length > 1) parts.push({ text: " " });
      rest = rest.slice(dash.length);
    }
    const key = /^([^\s:#][^:]*):(\s|$)/.exec(rest);
    if (key) {
      parts.push({ text: `${key[1]}:`, cls: "hl-key" });
      const value = rest.slice(key[1].length + 1);
      const lead = /^\s*/.exec(value)?.[0] ?? "";
      if (lead) parts.push({ text: lead });
      parts.push(...valueParts(value.slice(lead.length)));
    } else if (rest.startsWith("#")) {
      parts.push({ text: rest, cls: "hl-comment" });
    } else {
      parts.push(...valueParts(rest));
    }
    return (
      <span key={i}>
        {parts.map((p, j) => (
          <span key={j} className={p.cls}>
            {p.text}
          </span>
        ))}
        {"\n"}
      </span>
    );
  });
}

const JSON_TOKEN =
  /("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|(\b(?:true|false|null)\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

function highlightJson(text: string) {
  const parts: Part[] = [];
  let last = 0;
  for (const m of text.matchAll(JSON_TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) parts.push({ text: text.slice(last, at) });
    if (m[1]) parts.push({ text: m[1], cls: "hl-key" });
    else if (m[2]) parts.push({ text: m[2], cls: "hl-string" });
    else parts.push({ text: m[0], cls: "hl-literal" });
    last = at + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts.map((p, i) => (
    <span key={i} className={p.cls}>
      {p.text}
    </span>
  ));
}
