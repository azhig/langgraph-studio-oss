import type { GraphSchema } from "@langchain/langgraph-sdk";
import type { StateCreator } from "zustand";
import { useStudio } from "@/store/studio";
import { convertText, defaultValue, inputFields, parseText, toText, type Lang } from "@/features/input/format";

/** Input form: text and language of each `input_schema` field, history of submissions. */
export interface InputSlice {
  inputText: Record<string, string>;
  inputLang: Record<string, Lang>;
  /** Submitted inputs, for the ↑ / ↓ buttons next to the `Input` heading. */
  history: Record<string, string>[];
  historyIndex: number;
  /** Input form parse error: shown in the footer of the `Input` card. */
  inputError?: string;

  setInput: (key: string, text: string) => void;
  /** Switching the language keeps the value: parse with the old one, print with the new. */
  setLang: (key: string, lang: Lang) => void;
  /** Fills the form with defaults from `input_schema`. */
  initInput: (schemas?: GraphSchema) => void;
  /** Clears the fields after submit, keeping the input history (as the reference does). */
  resetInput: () => void;
  stepHistory: (delta: number) => void;
  rememberInput: () => void;
  /** Builds the input object; on a parse error returns the message. */
  buildInput: () => { input?: Record<string, unknown>; error?: string };
  setInputError: (message?: string) => void;
}

export const createInputSlice: StateCreator<InputSlice, [], [], InputSlice> = (set, get) => ({
  inputText: {},
  inputLang: {},
  history: [],
  historyIndex: -1,

  setInput: (key, text) => set((s) => ({ inputText: { ...s.inputText, [key]: text } })),

  setLang: (key, lang) =>
    set((s) => {
      const prev = s.inputLang[key] ?? "yaml";
      if (prev === lang) return s;
      return {
        inputLang: { ...s.inputLang, [key]: lang },
        inputText: { ...s.inputText, [key]: convertText(s.inputText[key] ?? "", prev, lang) },
      };
    }),

  initInput: (schemas) => {
    const inputText: Record<string, string> = {};
    const inputLang: Record<string, Lang> = {};
    for (const f of inputFields(schemas?.input_schema)) {
      inputText[f.key] = toText(defaultValue(f.schema), "yaml");
      inputLang[f.key] = "yaml";
    }
    set({ inputText, inputLang, history: [], historyIndex: -1 });
  },

  resetInput: () => {
    const { schemas } = useStudio.getState();
    const inputText: Record<string, string> = {};
    for (const f of inputFields(schemas?.input_schema)) {
      inputText[f.key] = toText(defaultValue(f.schema), get().inputLang[f.key] ?? "yaml");
    }
    set({ inputText });
  },

  stepHistory: (delta) => {
    const { history, historyIndex } = get();
    if (!history.length) return;
    const i = Math.min(history.length - 1, Math.max(0, historyIndex + delta));
    set({ historyIndex: i, inputText: { ...history[i] } });
  },

  rememberInput: () => set((s) => ({ history: [...s.history, { ...s.inputText }], historyIndex: s.history.length })),

  buildInput: () => {
    const { schemas } = useStudio.getState();
    const { inputText, inputLang } = get();
    const input: Record<string, unknown> = {};
    for (const f of inputFields(schemas?.input_schema)) {
      const parsed = parseText(inputText[f.key] ?? "", inputLang[f.key] ?? "yaml");
      if (parsed.error) return { error: `${f.title}: ${parsed.error}` };
      if (parsed.value !== undefined) input[f.key] = parsed.value;
    }
    return { input };
  },

  setInputError: (inputError) => set({ inputError }),
});
