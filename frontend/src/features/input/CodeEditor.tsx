import { useEffect, useLayoutEffect, useRef } from "react";
import { EditorState, Compartment, type Extension } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, drawSelection } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { bracketMatching, foldGutter, indentUnit, syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { yaml } from "@codemirror/lang-yaml";
import { json } from "@codemirror/lang-json";
import { tags } from "@lezer/highlight";
import type { Lang } from "./format";
import { useStudio, type Theme } from "@/store/studio";

/**
 * Field value editor.
 *
 * Geometry captured from the reference (docs/DESIGN-TOKENS.md, "Editor"): a 52 px gutter with
 * right-aligned numbers, content with 12 px padding, font 13px/18.2px,
 * so one line yields exactly 42.2 px of height. The palette is measured too:
 * main text #3760bf (light) / #7982a9 (dark), literals are green.
 */

const PALETTE: Record<Theme, { text: string; literal: string }> = {
  light: { text: "#3760bf", literal: "#587539" },
  dark: { text: "#7982a9", literal: "#9ece6a" },
};

/**
 * In YAML unquoted values are tagged as `content`, quoted ones as `string`;
 * keys, brackets and separators keep the main color. The reference looks the same.
 */
function highlight(theme: Theme) {
  const p = PALETTE[theme];
  return HighlightStyle.define([
    { tag: [tags.content, tags.string, tags.number, tags.bool, tags.null, tags.literal], color: p.literal },
    {
      tag: [
        tags.definition(tags.propertyName),
        tags.propertyName,
        tags.separator,
        tags.punctuation,
        tags.squareBracket,
        tags.brace,
      ],
      color: p.text,
    },
    { tag: [tags.comment, tags.lineComment], color: "var(--text-quaternary)", fontStyle: "italic" },
  ]);
}

function baseTheme(theme: Theme) {
  const p = PALETTE[theme];
  return EditorView.theme({
    "&": { color: p.text, backgroundColor: "transparent", fontSize: "13px" },
    ".cm-scroller": { fontFamily: "monospace", lineHeight: "18.2px" },
    ".cm-content": { padding: "12px", caretColor: "transparent" },
    ".cm-gutters:empty": { display: "none" },
    ".cm-line": { padding: "0" },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "var(--text-quaternary)",
      border: "none",
      minWidth: "52px",
    },
    ".cm-lineNumbers .cm-gutterElement": { padding: "0 4px 0 8px", minWidth: "32px", textAlign: "right" },
    // Fold column: 20 px with a 16 px arrow, as in the reference
    ".cm-foldGutter": { minWidth: "20px" },
    ".cm-foldGutter .cm-gutterElement": { padding: "0 2px", color: "var(--text-quaternary)" },
    ".cm-foldGutter .cm-gutterElement span": { fontSize: "16px", lineHeight: "18.2px" },
    ".cm-gutters + .cm-content": { marginLeft: "0" },
    "&.cm-focused": { outline: "none" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--text-primary)" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "var(--bg-quaternary)",
    },
    // The matching bracket is highlighted only in focus and in the same green as the reference
    "&.cm-focused .cm-matchingBracket": {
      backgroundColor: "rgba(50, 140, 130, 0.32)",
      color: "inherit",
    },
  });
}

const langExt = (lang: Lang): Extension => (lang === "json" ? json() : yaml());

interface Props {
  value: string;
  lang: Lang;
  onChange: (value: string) => void;
  /** Focused after mounting (the reference focuses the first form field). */
  autoFocus?: boolean;
  /** Read-only: this is how the full editor is shown in `View state`. */
  readOnly?: boolean;
}

export function CodeEditor({ value, lang, onChange, autoFocus, readOnly = false }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  useLayoutEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const theme = useStudio((s) => s.theme);
  const langComp = useRef(new Compartment());
  const themeComp = useRef(new Compartment());

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          foldGutter(),
          history(),
          drawSelection(),
          bracketMatching(),
          closeBrackets(),
          indentUnit.of("  "),
          EditorState.readOnly.of(readOnly),
          keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
          langComp.current.of(langExt(lang)),
          themeComp.current.of([baseTheme(theme), syntaxHighlighting(highlight(theme))]),
          EditorView.lineWrapping,
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    if (autoFocus) v.focus();
    return () => {
      v.destroy();
      view.current = null;
    };
    // The editor is created once: value, language and theme arrive via separate effects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External value change (reset after Submit, language switch, input history)
  useEffect(() => {
    const v = view.current;
    if (!v || v.state.doc.toString() === value) return;
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({ effects: langComp.current.reconfigure(langExt(lang)) });
  }, [lang]);

  useEffect(() => {
    view.current?.dispatch({
      effects: themeComp.current.reconfigure([baseTheme(theme), syntaxHighlighting(highlight(theme))]),
    });
  }, [theme]);

  return <div ref={host} className="cm-host" style={{ cursor: "text" }} />;
}
