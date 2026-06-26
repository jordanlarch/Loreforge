"use client";

import Link from "next/link";

export function SheetToolbar({
  characterId,
  saving,
  lastSaved,
}: {
  characterId: string;
  saving: boolean;
  lastSaved: Date | null;
}) {
  const savedLabel = saving
    ? "Saving…"
    : lastSaved
      ? `Saved ${lastSaved.toLocaleTimeString()}`
      : "Auto-save on blur";

  return (
    <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 flex-wrap items-center gap-2 rounded-full border border-lore-border bg-lore-bg/95 px-4 py-2 shadow-xl backdrop-blur">
      <span className="text-xs text-lore-muted">{savedLabel}</span>
      <span className="hidden h-4 w-px bg-lore-border sm:block" aria-hidden />
      <Link
        href={`/characters/new?from=${characterId}`}
        className="rounded-full border border-lore-border px-3 py-1 text-xs text-lore-muted hover:text-lore-text"
      >
        Full Builder
      </Link>
    </div>
  );
}
