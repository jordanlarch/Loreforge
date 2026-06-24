"use client";

import { useState } from "react";

import {
  formatChallengeRating,
  formatCreatureType,
  formatSize,
} from "@/lib/codex-monster-display";
import { trpc } from "@/lib/trpc/client";

import { MonsterDetail } from "./monster-detail";

const PAGE_SIZE = 48;

export type MonsterBrowserMode = "monsters" | "animals";

export function MonsterBrowser({
  mode,
  selectedSlug,
  onSelect,
}: {
  mode: MonsterBrowserMode;
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string | undefined>();
  const [page, setPage] = useState(0);

  const facets = trpc.codex.monsterFacets.useQuery(undefined, {
    enabled: mode === "monsters",
  });

  const list = trpc.codex.listMonsters.useQuery(
    {
      search: search || undefined,
      type: mode === "monsters" ? type : undefined,
      beastsOnly: mode === "animals",
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    },
    { placeholderData: (prev) => prev },
  );

  const total = list.data?.total ?? 0;
  const monsters = list.data?.monsters ?? [];
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function resetPageAnd(fn: () => void) {
    fn();
    setPage(0);
  }

  const emptyMessage =
    mode === "animals"
      ? "No beasts match. Run `npm run ingest:open5e-creatures` in packages/db if the table is empty."
      : "No creatures match these filters.";

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
              placeholder={mode === "animals" ? "wolf, horse…" : "dragon, goblin…"}
              className="w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent"
            />
          </div>

          {mode === "monsters" && (facets.data?.types.length ?? 0) > 0 && (
            <div>
              <div className="mb-2 text-xs uppercase tracking-wide text-lore-muted">
                Type
              </div>
              <div className="flex flex-wrap gap-1.5">
                <FilterChip
                  active={type === undefined}
                  onClick={() => resetPageAnd(() => setType(undefined))}
                >
                  All
                </FilterChip>
                {facets.data!.types.map((t) => (
                  <FilterChip
                    key={t}
                    active={type === t}
                    onClick={() => resetPageAnd(() => setType(t))}
                  >
                    {formatCreatureType(t)}
                  </FilterChip>
                ))}
              </div>
            </div>
          )}

          {mode === "animals" && (
            <p className="text-xs text-lore-muted">
              SRD beasts with challenge rating 1 or lower — mounts, familiars,
              and wild-shape options.
            </p>
          )}
        </aside>

        <section>
          <div className="mb-4 flex items-center justify-between text-sm text-lore-muted">
            <span>
              {list.isLoading
                ? "Loading…"
                : `${total} creature${total === 1 ? "" : "s"}`}
            </span>
            {pageCount > 1 && (
              <div className="flex items-center gap-2">
                <button
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
                  disabled={page + 1 >= pageCount}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded border border-lore-border px-2 py-1 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {!list.isLoading && monsters.length === 0 ? (
            <div className="rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
              {emptyMessage}
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {monsters.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(m.slug)}
                    className="flex h-full w-full flex-col gap-2 rounded-lg border border-lore-border bg-lore-surface p-4 text-left transition-colors hover:border-lore-accent"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-display text-lg leading-tight">
                        {m.name}
                      </span>
                      <span className="shrink-0 rounded bg-lore-bg px-2 py-0.5 text-xs font-semibold text-lore-accent">
                        CR {formatChallengeRating(m.challengeRating)}
                      </span>
                    </div>
                    <span className="text-xs capitalize text-lore-muted">
                      {[
                        formatSize(m.size),
                        formatCreatureType(m.creatureType),
                        m.armorClass != null ? `AC ${m.armorClass}` : null,
                        m.hitPoints != null ? `${m.hitPoints} HP` : null,
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
        <MonsterDetail slug={selectedSlug} onClose={() => onSelect(null)} />
      )}
    </>
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
