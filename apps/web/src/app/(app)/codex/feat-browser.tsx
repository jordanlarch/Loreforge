"use client";

import { useState } from "react";

import { formatFeatType } from "@/lib/codex-background-feat-display";
import { useCodexSearch } from "@/lib/use-codex-search";
import { trpc } from "@/lib/trpc/client";

import { FeatDetail } from "./feat-detail";

export function FeatBrowser({
  selectedSlug,
  onSelect,
}: {
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
}) {
  const [search, setSearch] = useCodexSearch();
  const [featType, setFeatType] = useState<string | undefined>();

  const facets = trpc.codex.featFacets.useQuery();
  const list = trpc.codex.listFeats.useQuery(
    { search: search || undefined, featType },
    { placeholderData: (prev) => prev },
  );

  const items = list.data ?? [];

  return (
    <>
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <aside className="space-y-6">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-lore-muted">
              Search
            </label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="alert, grappler…"
              className="w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent"
            />
          </div>

          {(facets.data?.types.length ?? 0) > 0 && (
            <FilterGroup
              title="Type"
              options={facets.data!.types}
              value={featType}
              render={(v) => formatFeatType(v)}
              onChange={setFeatType}
            />
          )}
        </aside>

        <section>
          <p className="mb-4 text-sm text-lore-muted">
            {list.isLoading
              ? "Loading…"
              : `${items.length} feat${items.length === 1 ? "" : "s"}`}
          </p>

          {!list.isLoading && items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
              No feats match. Run `npm run ingest:open5e-feats` in packages/db if
              the table is empty.
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((feat) => (
                <li key={feat.slug}>
                  <button
                    type="button"
                    onClick={() => onSelect(feat.slug)}
                    className="flex h-full w-full flex-col gap-2 rounded-lg border border-lore-border bg-lore-surface p-4 text-left transition-colors hover:border-lore-accent"
                  >
                    <span className="font-display text-lg leading-tight">
                      {feat.name}
                    </span>
                    <span className="text-xs capitalize text-lore-muted">
                      {[
                        formatFeatType(feat.featType),
                        feat.prerequisite || null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {selectedSlug && (
        <FeatDetail slug={selectedSlug} onClose={() => onSelect(null)} />
      )}
    </>
  );
}

function FilterGroup({
  title,
  options,
  value,
  onChange,
  render,
}: {
  title: string;
  options: string[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  render: (value: string) => string;
}) {
  return (
    <div>
      <div className="mb-2 text-xs uppercase tracking-wide text-lore-muted">
        {title}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={value === undefined} onClick={() => onChange(undefined)}>
          All
        </FilterChip>
        {options.map((opt) => (
          <FilterChip
            key={opt}
            active={value === opt}
            onClick={() => onChange(opt)}
          >
            {render(opt)}
          </FilterChip>
        ))}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs capitalize transition-colors ${
        active
          ? "border-lore-accent bg-lore-accent-dim text-lore-text"
          : "border-lore-border text-lore-muted hover:text-lore-text"
      }`}
    >
      {children}
    </button>
  );
}
