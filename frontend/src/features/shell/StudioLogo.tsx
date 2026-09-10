/** Значок Studio в шапке: два узла и ребро между ними. */
export function StudioLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <path d="M10.5 6.75h3.75a1.5 1.5 0 0 1 1.5 1.5v5.25" />
      <path d="M6.75 10.5v3.75a1.5 1.5 0 0 0 1.5 1.5h5.25" />
    </svg>
  );
}
