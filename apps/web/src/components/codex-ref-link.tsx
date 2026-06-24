"use client";

import { useRouter } from "next/navigation";

import type { CodexCategory } from "@/lib/codex-categories";

/**
 * Inline link to another Codex entry with a hover preview of its summary text.
 */
export function CodexRefLink({
  category,
  slug,
  label,
  preview,
  onNavigate,
}: {
  category: CodexCategory;
  slug: string;
  label: string;
  preview?: string | null;
  onNavigate?: () => void;
}) {
  const router = useRouter();

  return (
    <span className="group relative inline">
      <button
        type="button"
        className="text-lore-accent underline decoration-lore-accent/40 underline-offset-2 transition-colors hover:decoration-lore-accent"
        onClick={() => {
          const params = new URLSearchParams({
            category,
            slug,
          });
          router.push(`/codex?${params.toString()}`);
          onNavigate?.();
        }}
      >
        {label}
      </button>
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
