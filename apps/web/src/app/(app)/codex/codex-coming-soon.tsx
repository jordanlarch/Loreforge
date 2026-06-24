"use client";

import { COMING_SOON_COPY, type CodexCategory } from "@/lib/codex-categories";

export function CodexComingSoon({ category }: { category: CodexCategory }) {
  const copy =
    COMING_SOON_COPY[category] ??
    "This category is not ingested yet. Spells, Species, and Classes are available today.";

  return (
    <div className="rounded-lg border border-dashed border-lore-border p-12 text-center">
      <p className="font-display text-xl text-lore-text">{category}</p>
      <p className="mx-auto mt-3 max-w-md text-sm text-lore-muted">{copy}</p>
      <p className="mt-4 text-xs text-lore-muted">
        Track progress in{" "}
        <code className="text-lore-text">docs/deferrals.md</code> (CODEX-1).
      </p>
    </div>
  );
}
