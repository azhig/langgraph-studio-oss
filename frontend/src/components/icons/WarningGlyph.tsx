/**
 * Filled warning triangle: the reference marks the "no configuration schema" notice with it.
 * Drawn as one path with `evenodd`, so the bar and the dot are holes in the triangle.
 */
export function WarningGlyph({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className={className} aria-hidden="true">
      <path d="M13.74 4.52a2 2 0 0 0-3.48 0L2.3 18.48A2 2 0 0 0 4.04 21.5h15.92a2 2 0 0 0 1.74-3.02L13.74 4.52ZM11 9.75a1 1 0 0 1 2 0v4.25a1 1 0 0 1-2 0V9.75Zm1 8.75a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Z" />
    </svg>
  );
}
