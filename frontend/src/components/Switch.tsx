import { cx } from "@/lib/cx";

/**
 * Toggle switch. Taken from the reference: a 40×20 track with a 16 px thumb (`Enable messages
 * stream mode`, `Show tool calls`); a compact 32×16 variant with a 12 px thumb and
 * brand fill — the `Active` toggle in the assistant settings.
 */
export function Switch({
  checked,
  onChange,
  compact = false,
  disabled = false,
  id,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  compact?: boolean;
  disabled?: boolean;
  id?: string;
  /** Screen reader label when there is no visible label nearby. */
  label?: string;
}) {
  const on = compact ? "bg-bg-brand" : "bg-bg-control-active";
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-state={checked ? "checked" : "unchecked"}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "inline-flex items-center rounded-full transition",
        compact ? "h-4 w-8" : "h-5 w-10",
        checked ? on : "bg-bg-quaternary",
        disabled && "cursor-not-allowed",
      )}
    >
      <span
        className={cx(
          "rounded-full bg-white transition",
          compact ? "size-3" : "size-4",
          checked ? (compact ? "translate-x-[18px]" : "translate-x-[22px]") : "translate-x-[2px]",
        )}
      />
    </button>
  );
}
