import { cx } from "@/lib/cx";

/** Parse error below a field: 13 px in `text-error-secondary`, as in the reference's `Input` card. */
export function FieldError({ text, className }: { text: string; className?: string }) {
  return <div className={cx("px-1 text-[13px] leading-tight text-text-error-secondary", className)}>{text}</div>;
}
