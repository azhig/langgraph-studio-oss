import { Check, ChevronDown } from "lucide-react";
import { Popover } from "./Popover";

/**
 * Studio-style dropdown: a combobox button with the current value and an arrow,
 * a list of items with a check mark next to the selected one. Geometry taken from the reference —
 * a 34 px button (`px-2.5 py-1.5`, border-default border, radius 6),
 * an item `px-2 py-1.5` with 14 px text and a 16 px check mark on the left.
 */
export function Select({
  value,
  options,
  onChange,
  placeholder = "Select",
  up = false,
  compact = false,
}: {
  value?: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  up?: boolean;
  /** Compact variant: this is how the role picker looks in the message builder. */
  compact?: boolean;
}) {
  return (
    <Popover
      minWidth={compact ? 97 : 160}
      up={up}
      trigger={({ toggle }) => (
        <button
          type="button"
          className={`flex items-center justify-between gap-2 rounded-md border border-border-default bg-transparent ${
            compact ? "h-[26px] px-2 text-xs" : "px-2.5 py-1.5 text-sm"
          }`}
          onClick={toggle}
        >
          <span className={value ? undefined : "text-text-secondary"}>{value ?? placeholder}</span>
          <ChevronDown size={16} strokeWidth={1.5} className="shrink-0 text-text-secondary" />
        </button>
      )}
    >
      {({ close }) => (
        <div className="p-1">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none select-none hover:bg-bg-secondary"
              onClick={() => {
                onChange(option);
                close();
              }}
            >
              <Check
                size={16}
                strokeWidth={1.8}
                className={`shrink-0 ${option === value ? "opacity-100" : "opacity-0"}`}
              />
              <span className="min-w-0 flex-1 truncate text-sm leading-normal">{option}</span>
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}
