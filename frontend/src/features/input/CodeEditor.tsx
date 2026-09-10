import { useEffect, useRef } from "react";
import { EditorState, Compartment, type Extension } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, drawSelection } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import {
  bracketMatching,
  foldGutter,
  indentUnit,
  syntaxHighlighting,
  HighlightStyle,
} from "@codemirror/language";
import { yaml } from "@codemirror/lang-yaml";
import { json } from "@codemirror/lang-json";
import { tags } from "@lezer/highlight";
import type { Lang } from "./format";
import { useStudio, type Theme } from "@/store/studio";

/**
 * Редактор значения поля.
 *
 * Геометрия снята с эталона (docs/DESIGN-TOKENS.md, «Редактор»): гуттер 52 px с
 * выравниванием номеров вправо, контент с отступом 12 px, шрифт 13px/18.2px,
 * поэтому одна строка даёт ровно 42.2 px высоты. Палитра — тоже измеренная:
 * основной текст #3760bf (светлая) / #7982a9 (тёмная), литералы — зелёные.
 */

const PALETTE: Record<Theme, { text: string; literal: string }> = {
  light: { text: "#3760bf", literal: "#587539" },
  dark: { text: "#7982a9", literal: "#9ece6a" },
};

/**
 * В YAML значения без кавычек размечены как `content`, в кавычках — `string`;
 * ключи, скобки и разделители остаются основным цветом. Так же выглядит эталон.
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
    // Колонка сворачивания: 20 px со стрелкой 16 px — как в эталоне
    ".cm-foldGutter": { minWidth: "20px" },
    ".cm-foldGutter .cm-gutterElement": { padding: "0 2px", color: "var(--text-quaternary)" },
    ".cm-foldGutter .cm-gutterElement span": { fontSize: "16px", lineHeight: "18.2px" },
    ".cm-gutters + .cm-content": { marginLeft: "0" },
    "&.cm-focused": { outline: "none" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--text-primary)" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "var(--bg-quaternary)",
    },
    // Парная скобка подсвечивается только в фокусе и тем же зелёным, что у эталона
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
  /** Ставится в фокус после монтирования (эталон фокусирует первое поле формы). */
  autoFocus?: boolean;
  /** Только для чтения: так показан снимок состояния в `View state`. */
  readOnly?: boolean;
  /** Без номеров строк и колонки сворачивания — как снимок в `View state`. */
  plain?: boolean;
}

export function CodeEditor({ value, lang, onChange, autoFocus, readOnly = false, plain = false }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
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
          ...(plain ? [] : [lineNumbers(), foldGutter()]),
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
    // Редактор создаётся один раз: значение, язык и тема доезжают отдельными эффектами
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Внешнее изменение значения (сброс после Submit, переключение языка, история ввода)
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
