"use client";

import { useState } from "react";

import { abilityBonusLine } from "@/lib/codex-display";
import { trpc } from "@/lib/trpc/client";

import { SpeciesDetail } from "./species-detail";

export function SpeciesBrowser({
  selectedSlug,
  onSelect,
}: {
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
}) {
  const [search, setSearch] = useState("");

  const list = trpc.codex.listSpecies.useQuery(
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
          placeholder="dwarf, elf…"
          className="w-full max-w-md rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent"
        />
      </div>

      <p className="mb-4 text-sm text-lore-muted">
        {list.isLoading
          ? "Loading…"
          : `${items.length} spec${items.length === 1 ? "y" : "ies"}`}
      </p>

      {!list.isLoading && items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
          No species match.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((s) => (
            <li key={s.slug}>
              <button
                type="button"
                onClick={() => onSelect(s.slug)}
                className="flex h-full w-full flex-col gap-2 rounded-lg border border-lore-border bg-lore-surface p-4 text-left transition-colors hover:border-lore-accent"
              >
                <span className="font-display text-lg leading-tight">{s.name}</span>
                <span className="text-sm text-lore-accent">
                  {abilityBonusLine(s.abilityBonuses)}
                </span>
                <span className="text-xs text-lore-muted">
                  {s.size} · {s.speed} ft
                </span>
                <span className="text-xs text-lore-muted">
                  {s.traits.slice(0, 3).join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedSlug && (
        <SpeciesDetail slug={selectedSlug} onClose={() => onSelect(null)} />
      )}
    </>
  );
}
