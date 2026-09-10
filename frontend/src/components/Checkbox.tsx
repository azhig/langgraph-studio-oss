import { Check } from "lucide-react";
import { cx } from "@/lib/cx";

/**
 * Labeled checkbox — `Before` / `After` in the `Interrupts` menu and `Interrupt Before` /
 * `Interrupt After` in the node card. A 16 px square with radius 4; when checked —
 * a brand border and `bg-brand-tertiary` fill.
 */
export function Checkbox({
  label,
  checked,
  onToggle,
  className,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  /** Wrapper button classes: the gap between the square and the label differs between the menu and the card. */
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cx("inline-flex shrink-0 items-center py-2 text-xs text-text-tertiary", className)}
      onClick={onToggle}
    >
      <span
        className={cx(
          "flex size-4 items-center justify-center rounded-[4px] border",
          checked ? "border-bg-brand bg-bg-brand-tertiary text-text-brand-secondary" : "border-border-secondary",
        )}
      >
        {/* The reference's check mark: lucide `Check` 16 px with stroke 2, inside a bordered square */}
        {checked && <Check strokeWidth={2} className="size-4" aria-hidden />}
      </span>
      <span>{label}</span>
    </button>
  );
}
