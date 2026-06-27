"use client";

import type { CodexCategory } from "@/lib/codex-categories";
import { readCodexBookmarks } from "@/lib/codex-bookmarks";

const SRD_ATTRIBUTION =
  "Loreforge uses the System Reference Document 5.2 (SRD 5.2) under the Open Game License 1.0a. " +
  "Wizards of the Coast owns Dungeons & Dragons; this product is not affiliated with or endorsed by Wizards.";

export function CodexFooter({ category }: { category: CodexCategory }) {
  function exportBookmarks() {
    const bookmarks = readCodexBookmarks();
    const blob = new Blob(
      [
        JSON.stringify(
          { exportedAt: new Date().toISOString(), category, bookmarks },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `loreforge-codex-bookmarks-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <footer className="mt-12 border-t border-lore-border pt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl text-xs leading-relaxed text-lore-muted">
          {SRD_ATTRIBUTION}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportBookmarks}
            className="rounded border border-lore-border px-3 py-1.5 text-xs text-lore-muted transition-colors hover:border-lore-accent hover:text-lore-text"
          >
            Export bookmarks (JSON)
          </button>
          <span
            className="rounded border border-dashed border-lore-border px-3 py-1.5 text-xs text-lore-muted opacity-70"
            title="Full section PDF/JSON export deferred to GA"
          >
            Export section — soon
          </span>
        </div>
      </div>
    </footer>
  );
}
