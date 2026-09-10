import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/lib/cx";
import { useStudio } from "@/store/studio";
import { nodePalette } from "./colors";

/**
 * Node avatar: a 20 px circle with the first letter of the name in the node tone. Captured from the reference:
 * this is how log entries, the node settings header and configuration fields
 * (`Used in node`) are labeled. A custom icon can be placed inside: subgraph or user input.
 */
export function NodeAvatar({
  node,
  square = false,
  className,
  style,
  title,
  children,
}: {
  node: string;
  /** Rounded square instead of a circle: this is how a subgraph node is marked in the log. */
  square?: boolean;
  className?: string;
  style?: CSSProperties;
  title?: string;
  children?: ReactNode;
}) {
  const theme = useStudio((s) => s.theme);
  const palette = nodePalette(node, theme);
  return (
    <span
      title={title}
      className={cx(
        "flex size-5 items-center justify-center border text-center text-[10px] font-semibold uppercase",
        square ? "rounded" : "rounded-full",
        className,
      )}
      style={{ color: palette.text, backgroundColor: palette.avatarBackground, borderColor: palette.border, ...style }}
    >
      {children ?? node.slice(0, 1)}
    </span>
  );
}

/** Chip with the node name: this is how the reference shows the next node under the `Continue` button. */
export function NodeChip({ node }: { node: string }) {
  const theme = useStudio((s) => s.theme);
  const palette = nodePalette(node, theme);
  return (
    <span
      className="rounded-md border px-2 text-sm leading-relaxed font-medium"
      style={{ color: palette.text, backgroundColor: palette.avatarBackground, borderColor: palette.border }}
    >
      {node}
    </span>
  );
}
