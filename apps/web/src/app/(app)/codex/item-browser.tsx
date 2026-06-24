"use client";

import { useState } from "react";

import {
  formatItemCategory,
  formatItemCost,
  formatItemWeight,
} from "@/lib/codex-item-display";
import { trpc } from "@/lib/trpc/client";

import { ItemDetail } from "./item-detail";

const PAGE_SIZE = 48;

export function ItemBrowser({
  selectedSlug,
  onSelect,
}: {
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | undefined>();
  const [page, setPage] = useState(0);

  const facets = trpc.codex.itemFacets.useQuery();
  const list = trpc.codex.listItems.useQuery(
    {
      search: search || undefined,
      category,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    },
    { placeholderData: (prev) => prev },
  );

  const total = list.data?.total ?? 0;
  const items = list.data?.items ?? [];
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function resetPageAnd(fn: () => void) {
    fn();
    setPage(0);
  }

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
              onChange={(e) => resetPageAnd(() => setSearch(e.target.value))}
              placeholder="longsword, rope…"
              className="w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent"
            />
          </div>

          {(facets.data?.categories.length ?? 0) > 0 && (
            <FilterGroup
              title="Category"
              options={facets.data!.categories}
              value={category}
              render={(v) => formatItemCategory(v)}
              onChange={(v) => resetPageAnd(() => setCategory(v))}
            />
          )}
        </aside>

        <section>
          <div className="mb-4 flex items-center justify-between text-sm text-lore-muted">
            <span>
              {list.isLoading
                ? "Loading…"
                : `${total} item${total === 1 ? "" : "s"}`}
            </span>
            {pageCount > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="rounded border border-lore-border px-2 py-1 disabled:opacity-40"
                >
                  Prev
                </button>
                <span>
                  {page + 1} / {pageCount}
                </span>
                <button
                  type="button"
                  disabled={page + 1 >= pageCount}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded border border-lore-border px-2 py-1 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {!list.isLoading && items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
              No items match. Run `npm run ingest:open5e-items` in packages/db
              if the table is empty.
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(item.slug)}
                    className="flex h-full w-full flex-col gap-2 rounded-lg border border-lore-border bg-lore-surface p-4 text-left transition-colors hover:border-lore-accent"
                  >
                    <span className="font-display text-lg leading-tight">
                      {item.name}
                    </span>
                    <span className="text-xs capitalize text-lore-muted">
                      {[
                        formatItemCategory(item.category),
                        formatItemCost(item.cost),
                        formatItemWeight(item.weight, item.weightUnit),
                      ]
                        .filter((part) => part !== "—")
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
        <ItemDetail slug={selectedSlug} onClose={() => onSelect(null)} />
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
