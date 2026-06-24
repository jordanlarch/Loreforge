"use client";

import Link from "next/link";

import type { CodexCategory } from "@/lib/codex-categories";

/**
 * Inline link to another Codex entry with a hover preview of its summary text.
 */
export function CodexRefLink({
  category,
  slug,
  label,
  preview,
  onNavigateRef,
}: {
  category: CodexCategory;
  slug: string;
  label: string;
  preview?: string | null;
  /** Preferred: single atomic navigation (avoids racing with modal close). */
  onNavigateRef?: (category: CodexCategory, slug: string) => void;
}) {
  const href = `/codex?${new URLSearchParams({ category, slug }).toString()}`;

  const className =
    "text-lore-accent underline decoration-lore-accent/40 underline-offset-2 transition-colors hover:decoration-lore-accent";

  const link = onNavigateRef ? (
    <button
      type="button"
      className={className}
      onClick={(e) => {
        e.stopPropagation();
        onNavigateRef(category, slug);
      }}
    >
      {label}
    </button>
  ) : (
    <Link href={href} className={className} onClick={(e) => e.stopPropagation()}>
      {label}
    </Link>
  );

  return (
    <span className="group relative inline">
      {link}
      {preview ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-56 -translate-x-1/2 rounded-lg border border-lore-border bg-lore-surface px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed text-lore-muted shadow-lg group-hover:block group-focus-within:block"
        >
          <span className="mb-0.5 block font-medium text-lore-text">{label}</span>
          {preview}
        </span>
      ) : null}
    </span>
  );
}
