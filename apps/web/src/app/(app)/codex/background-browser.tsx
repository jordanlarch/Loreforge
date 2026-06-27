"use client";

import { useCodexSearch } from "@/lib/use-codex-search";
import { trpc } from "@/lib/trpc/client";
import type { CodexCategory } from "@/lib/codex-categories";

import { BackgroundDetail } from "./background-detail";

export function BackgroundBrowser({
  selectedSlug,
  onSelect,
  onNavigateRef,
}: {
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
  onNavigateRef?: (category: CodexCategory, slug: string) => void;
}) {
  const [search, setSearch] = useCodexSearch();

  const list = trpc.codex.listBackgrounds.useQuery(
    { search: search || undefined },
    { placeholderData: (prev) => prev },
  );

  const items = list.data ?? [];

  return (
    <>
      <div className="mb-4">
        <label className="mb-1 block text-xs uppercase tracking-wide text-lore-muted">
          Search
        </label>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="acolyte, criminal…"
          className="w-full max-w-md rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent"
        />
      </div>

      <p className="mb-4 text-sm text-lore-muted">
        {list.isLoading
          ? "Loading…"
          : `${items.length} background${items.length === 1 ? "" : "s"}`}
      </p>

      {!list.isLoading && items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
          No backgrounds match. Run `npm run ingest:open5e-backgrounds` in
          packages/db if the table is empty.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((bg) => (
            <li key={bg.slug}>
              <button
                type="button"
                onClick={() => onSelect(bg.slug)}
                className="flex h-full w-full flex-col gap-2 rounded-lg border border-lore-border bg-lore-surface p-4 text-left transition-colors hover:border-lore-accent"
              >
                <span className="font-display text-lg leading-tight">{bg.name}</span>
                <span className="text-xs text-lore-muted">
                  {bg.skillSummary ??
                    bg.description?.trim() ??
                    "SRD 2024 background"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedSlug && (
        <BackgroundDetail
          slug={selectedSlug}
          onClose={() => onSelect(null)}
          onNavigateRef={onNavigateRef}
        />
      )}
    </>
  );
}
