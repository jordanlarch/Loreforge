"use client";

import type { Ability } from "@app/engine";

import { SrdHint } from "@/components/srd-hint";
import { ABILITY_LABELS } from "@/lib/codex-display";
import { useCodexSearch } from "@/lib/use-codex-search";
import { trpc } from "@/lib/trpc/client";

import { ClassDetail } from "./class-detail";

export function ClassBrowser({
  selectedSlug,
  onSelect,
}: {
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
}) {
  const [search, setSearch] = useCodexSearch();

  const list = trpc.codex.listClasses.useQuery(
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
          placeholder="wizard, fighter…"
          className="w-full max-w-md rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent"
        />
      </div>

      <p className="mb-4 text-sm text-lore-muted">
        {list.isLoading
          ? "Loading…"
          : `${items.length} class${items.length === 1 ? "" : "es"}`}
      </p>

      {!list.isLoading && items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
          No classes match.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <li key={c.slug}>
              <button
                type="button"
                onClick={() => onSelect(c.slug)}
                className="flex h-full w-full flex-col gap-2 rounded-lg border border-lore-border bg-lore-surface p-4 text-left transition-colors hover:border-lore-accent"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-display text-lg leading-tight">
                    {c.name}
                  </span>
                  <span className="shrink-0 rounded bg-lore-bg px-2 py-0.5 text-xs font-semibold text-lore-accent">
                    d{c.hitDie}
                  </span>
                </div>
                <span className="text-sm text-lore-muted">
                  Saves:{" "}
                  {c.savingThrows
                    .map((s: Ability) => ABILITY_LABELS[s])
                    .join(", ")}
                </span>
                <span className="text-xs text-lore-muted">
                  Skills: choose {c.skillChoice.choose}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedSlug && (
        <ClassDetail slug={selectedSlug} onClose={() => onSelect(null)} />
      )}
    </>
  );
}
