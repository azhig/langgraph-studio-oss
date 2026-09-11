import { useEffect, useRef } from "react";
import { Copy, GripVertical, Paperclip, Plus, Trash2 } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import { buildContent, contentImages, messagePlainText, roleTitle, type MessageLike } from "@/lib/messages";
import { Popover } from "@/components/Popover";
import { Select } from "@/components/Select";
import { parseText, toText, type Lang } from "./format";

/**
 * Message builder for the `messages` field. Captured from the reference: one card per
 * message (`rounded-lg border px-4 py-3`), with a role picker and actions in the header
 * that appear on hover; under the list a `Message` button that adds an empty
 * message. The value stays the same field text; it is simply edited through the form.
 */
const ROLES = ["Human", "AI", "System", "Tool", "Function"] as const;
type Role = (typeof ROLES)[number];

/** Role for the picker list; anything unknown the reference shows as `Human`. */
const roleOf = (m: MessageLike): Role => {
  const title = roleTitle(m);
  return (ROLES as readonly string[]).includes(title) ? (title as Role) : "Human";
};

export function MessagesField({ text, lang, onText }: { text: string; lang: Lang; onText: (value: string) => void }) {
  const parsed = parseText(text, lang);
  const messages: MessageLike[] = Array.isArray(parsed.value) ? (parsed.value as MessageLike[]) : [];
  const write = (next: MessageLike[]) => onText(toText(next, lang));
  const edit = (i: number, patch: (m: MessageLike) => MessageLike) =>
    write(messages.map((x, j) => (j === i ? patch(x) : x)));

  return (
    <div className="flex flex-col items-stretch gap-2 overflow-y-hidden">
      <div className="scroll-thin overflow-y-auto">
        {messages.map((m, i) => {
          const body = messagePlainText(m.content);
          const images = contentImages(m.content);
          return (
            <div key={i} className="py-1">
              <div data-testid={`editable-message-${i}`}>
                <div className="group/actions flex flex-row items-start gap-1">
                  <div className="group grow cursor-auto rounded-lg border border-border-secondary px-4 py-3 transition-all focus-within:border-border-brand">
                    <div className="flex items-center justify-between">
                      <Select
                        compact
                        value={roleOf(m)}
                        options={[...ROLES]}
                        onChange={(role) => edit(i, (x) => ({ ...x, type: role.toLowerCase() }))}
                      />
                      <div className="flex items-center gap-1">
                        <div className="flex items-start gap-1 opacity-0 transition-all group-hover:opacity-100 focus-within:opacity-100 [&:has([data-state='open'])]:opacity-100">
                          <AttachButton
                            onAdd={(url) => edit(i, (x) => ({ ...x, content: buildContent(body, [...images, url]) }))}
                          />
                          <button
                            type="button"
                            aria-label="Delete message"
                            className="btn btn-ghost btn-icon !rounded-md !p-1"
                            onClick={() => write(messages.filter((_, j) => j !== i))}
                          >
                            <Trash2 size={16} strokeWidth={1.5} />
                          </button>
                          <button
                            type="button"
                            aria-label="Copy"
                            className="btn btn-ghost btn-icon !rounded-sm !p-1"
                            onClick={() => copyText(body)}
                          >
                            <Copy size={16} strokeWidth={1.5} />
                          </button>
                          <span className="flex cursor-grab items-center justify-center rounded-md border border-border-secondary p-1 text-text-secondary">
                            <GripVertical size={16} strokeWidth={1.5} />
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="p-0">
                      <div className="flex flex-row items-end justify-between">
                        <div className="grid w-full">
                          <MessageBody
                            text={body}
                            images={images}
                            onChange={(next, urls) => edit(i, (x) => ({ ...x, content: buildContent(next, urls) }))}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Message"
          data-testid="playground-add-message"
          className="btn btn-outline !rounded-sm"
          onClick={() => write([...messages, { type: "human", content: "" }])}
        >
          <Plus size={14} strokeWidth={1.8} />
          Message
        </button>
      </div>
    </div>
  );
}

/**
 * Message body. The reference keeps an editor here with a content flow: a text paragraph
 * and attachment images in sequence. We mimic it with `contenteditable` so text and attachments
 * stay in one flow and the card height matches the reference.
 */
function MessageBody({
  text,
  images,
  onChange,
}: {
  text: string;
  images: string[];
  onChange: (text: string, images: string[]) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Write to the DOM only on mismatch: otherwise the cursor jumps on every keystroke.
  // The text always lives in a `<p>` (created on mount, even when empty), so the
  // browser's first keystroke lands inside it and the comparison below stays stable.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const p = el.querySelector("p");
    const current = p ? p.textContent : null;
    const shown = [...el.querySelectorAll("img")].map((img) => img.getAttribute("src") ?? "");
    if (current === text && shown.join(" ") === images.join(" ")) return;
    const focused = document.activeElement === el;
    el.textContent = "";
    const next = document.createElement("p");
    // An empty block needs a <br> to keep its height and accept the caret
    if (text) next.textContent = text;
    else next.append(document.createElement("br"));
    el.append(next, ...images.map((url) => Object.assign(document.createElement("img"), { src: url })));
    if (focused) {
      const range = document.createRange();
      range.selectNodeContents(next);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [text, images]);

  const read = () => {
    const el = ref.current;
    if (!el) return;
    const next = el.querySelector("p")?.textContent ?? el.textContent ?? "";
    onChange(
      next,
      [...el.querySelectorAll("img")].map((img) => img.getAttribute("src") ?? ""),
    );
  };

  return (
    <div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        className="cursor-text bg-transparent text-sm [overflow-wrap:anywhere] whitespace-pre-wrap focus:outline-none"
        onInput={read}
      />
    </div>
  );
}

/** Attachments button: in the reference it opens a panel for uploading a file and inserting a link. */
function AttachButton({ onAdd }: { onAdd: (url: string) => void }) {
  const url = useRef<HTMLInputElement>(null);
  return (
    <Popover
      width={350}
      align="end"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          aria-label="Add multimodal content"
          data-state={open ? "open" : "closed"}
          className="btn btn-ghost btn-icon !rounded-md !p-1"
          onClick={toggle}
        >
          <Paperclip size={16} strokeWidth={1.5} />
        </button>
      )}
    >
      {({ close }) => (
        <div className="flex flex-col gap-2 p-4">
          <div className="group relative grid">
            <button
              type="button"
              className="col-start-1 col-end-2 flex items-center gap-4 rounded-lg border border-border-secondary p-4 pr-8 text-left transition-colors"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-secondary pt-1">
                <Paperclip size={16} strokeWidth={1.5} className="text-text-secondary" />
              </span>
              <span className="text-xs">Upload a file or drag and drop</span>
            </button>
            <input
              type="file"
              className="absolute inset-0 opacity-0"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  onAdd(String(reader.result));
                  close();
                };
                reader.readAsDataURL(file);
              }}
            />
          </div>
          <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-2">
            <span className="h-px w-full bg-border-muted" />
            <span className="text-xs text-text-tertiary">OR</span>
            <span className="h-px w-full bg-border-muted" />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs">Embed link</span>
            <div className="flex items-center gap-2">
              <input
                ref={url}
                type="text"
                placeholder="Enter URL..."
                className="h-9 w-full rounded-lg border border-border-secondary bg-transparent px-3 text-xs outline-none focus:border-border-brand"
              />
              <button
                type="button"
                className="btn btn-primary h-9 shrink-0 !rounded-lg !px-4 !py-1 text-xs font-medium"
                onClick={() => {
                  const value = url.current?.value.trim();
                  if (!value) return;
                  onAdd(value);
                  close();
                }}
              >
                Embed
              </button>
            </div>
          </div>
        </div>
      )}
    </Popover>
  );
}
