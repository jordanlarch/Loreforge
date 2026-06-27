"use client";

import { useState } from "react";

import { useCodexSearch } from "@/lib/use-codex-search";
import { trpc } from "@/lib/trpc/client";
import { SpellDetail } from "./spell-detail";

const PAGE_SIZE = 48;

function levelLabel(level: string | null): string {
  if (level == null) return "—";
  return level === "0" ? "Cantrip" : `Level ${level}`;
}

function levelBadge(level: string | null): string {
  return level == null ? "·" : level === "0" ? "C" : level;
}

export function CodexBrowser({
  selectedSlug,
  onSelectSlug,
}: {
  selectedSlug: string | null;
  onSelectSlug: (slug: string | null) => void;
}) {
  const [search, setSearch] = useCodexSearch();
  const [level, setLevel] = useState<string | undefined>();
  const [school, setSchool] = useState<string | undefined>();
  const [concentration, setConcentration] = useState<boolean | undefined>();
  const [ritual, setRitual] = useState<boolean | undefined>();
  const [page, setPage] = useState(0);

  const facets = trpc.codex.spellFacets.useQuery();
  const list = trpc.codex.listSpells.useQuery(
    {
      search: search || undefined,
      level,
      school,
      concentration,
      ritual,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    },
    { placeholderData: (prev) => prev },
  );

  const total = list.data?.total ?? 0;
  const spells = list.data?.spells ?? [];
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function resetPageAnd(fn: () => void) {
    fn();
    setPage(0);
  }

  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      {/* Filters sidebar */}
      <aside className="space-y-6">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-lore-muted">
            Search
          </label>
          <input
            type="search"
            value={search}
            onChange={(e) => resetPageAnd(() => setSearch(e.target.value))}
            placeholder="fireball…"
            className="w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent"
          />
        </div>

        <FilterGroup
          title="Level"
          options={facets.data?.levels ?? []}
          value={level}
          render={(v) => levelLabel(v)}
          onChange={(v) => resetPageAnd(() => setLevel(v))}
        />
        <FilterGroup
          title="School"
          options={facets.data?.schools ?? []}
          value={school}
          render={(v) => v}
          onChange={(v) => resetPageAnd(() => setSchool(v))}
        />
        <TriFilter
          title="Concentration"
          value={concentration}
          onChange={(v) => resetPageAnd(() => setConcentration(v))}
        />
        <TriFilter
          title="Ritual"
          value={ritual}
          onChange={(v) => resetPageAnd(() => setRitual(v))}
        />
      </aside>

      {/* Results */}
      <section>
        <div className="mb-4 flex items-center justify-between text-sm text-lore-muted">
          <span>
            {list.isLoading
              ? "Loading…"
              : `${total} spell${total === 1 ? "" : "s"}`}
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

        {!list.isLoading && spells.length === 0 ? (
          <div className="rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
            No spells match these filters.
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {spells.map((spell) => (
              <li key={spell.id}>
                <button
                  onClick={() => onSelectSlug(spell.slug)}
                  className="flex h-full w-full flex-col gap-2 rounded-lg border border-lore-border bg-lore-surface p-4 text-left transition-colors hover:border-lore-accent"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-display text-lg leading-tight">
                      {spell.name}
                    </span>
                    <span className="shrink-0 rounded bg-lore-bg px-2 py-0.5 text-xs font-semibold text-lore-accent">
                      {levelBadge(spell.level)}
                    </span>
                  </div>
                  <span className="text-xs capitalize text-lore-muted">
                    {[levelLabel(spell.level), spell.school]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedSlug && (
        <SpellDetail
          slug={selectedSlug}
          onClose={() => onSelectSlug(null)}
        />
      )}
    </div>
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

function TriFilter({
  title,
  value,
  onChange,
}: {
  title: string;
  value: boolean | undefined;
  onChange: (value: boolean | undefined) => void;
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
        <FilterChip active={value === true} onClick={() => onChange(true)}>
          Yes
        </FilterChip>
        <FilterChip active={value === false} onClick={() => onChange(false)}>
          No
        </FilterChip>
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
