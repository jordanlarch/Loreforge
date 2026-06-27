"use client";

import { useState } from "react";

import { useCodexSearch } from "@/lib/use-codex-search";
import { trpc } from "@/lib/trpc/client";
import { SpellDetail } from "./spell-detail";

const PAGE_SIZE = 48;

type SpellView = "grid" | "list" | "table";
type SpellSort = "level" | "name" | "school";
type SpellSortDir = "asc" | "desc";

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
  const [spellClass, setSpellClass] = useState<string | undefined>();
  const [concentration, setConcentration] = useState<boolean | undefined>();
  const [ritual, setRitual] = useState<boolean | undefined>();
  const [sortBy, setSortBy] = useState<SpellSort>("level");
  const [sortDir, setSortDir] = useState<SpellSortDir>("asc");
  const [view, setView] = useState<SpellView>("grid");
  const [page, setPage] = useState(0);

  const facets = trpc.codex.spellFacets.useQuery();
  const list = trpc.codex.listSpells.useQuery(
    {
      search: search || undefined,
      level,
      school,
      spellClass,
      concentration,
      ritual,
      sortBy,
      sortDir,
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

  function toggleSort(column: SpellSort) {
    resetPageAnd(() => {
      if (sortBy === column) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortBy(column);
        setSortDir(column === "name" ? "asc" : "asc");
      }
    });
  }

  function sortIndicator(column: SpellSort): string {
    if (sortBy !== column) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  return (
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
        <FilterGroup
          title="Class"
          options={facets.data?.classes ?? []}
          value={spellClass}
          render={(v) => v}
          onChange={(v) => resetPageAnd(() => setSpellClass(v))}
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

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-lore-muted">
          <span>
            {list.isLoading
              ? "Loading…"
              : `${total} spell${total === 1 ? "" : "s"}`}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs">
              <span className="uppercase tracking-wide">Sort</span>
              <select
                value={`${sortBy}-${sortDir}`}
                onChange={(e) => {
                  const [col, dir] = e.target.value.split("-") as [
                    SpellSort,
                    SpellSortDir,
                  ];
                  resetPageAnd(() => {
                    setSortBy(col);
                    setSortDir(dir);
                  });
                }}
                className="rounded border border-lore-border bg-lore-surface px-2 py-1 text-lore-text"
              >
                <option value="level-asc">Level (low → high)</option>
                <option value="level-desc">Level (high → low)</option>
                <option value="name-asc">Name (A → Z)</option>
                <option value="name-desc">Name (Z → A)</option>
                <option value="school-asc">School (A → Z)</option>
                <option value="school-desc">School (Z → A)</option>
              </select>
            </label>
            <SpellViewToggle view={view} onChange={setView} />
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
        </div>

        {!list.isLoading && spells.length === 0 ? (
          <div className="rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
            No spells match these filters.
          </div>
        ) : view === "table" ? (
          <div className="overflow-x-auto rounded-lg border border-lore-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-lore-border bg-lore-surface text-xs uppercase tracking-wide text-lore-muted">
                <tr>
                  <th className="px-3 py-2">
                    <SortHeader
                      label="Name"
                      indicator={sortIndicator("name")}
                      onClick={() => toggleSort("name")}
                    />
                  </th>
                  <th className="px-3 py-2">
                    <SortHeader
                      label="Level"
                      indicator={sortIndicator("level")}
                      onClick={() => toggleSort("level")}
                    />
                  </th>
                  <th className="px-3 py-2">
                    <SortHeader
                      label="School"
                      indicator={sortIndicator("school")}
                      onClick={() => toggleSort("school")}
                    />
                  </th>
                  <th className="px-3 py-2">Classes</th>
                  <th className="px-3 py-2">C / R</th>
                </tr>
              </thead>
              <tbody>
                {spells.map((spell) => (
                  <tr
                    key={spell.id}
                    className="cursor-pointer border-b border-lore-border/60 transition-colors hover:bg-lore-surface/80"
                    onClick={() => onSelectSlug(spell.slug)}
                  >
                    <td className="px-3 py-2 font-medium">{spell.name}</td>
                    <td className="px-3 py-2 text-lore-muted">
                      {levelLabel(spell.level)}
                    </td>
                    <td className="px-3 py-2 capitalize text-lore-muted">
                      {spell.school ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-lore-muted">
                      {spell.classes?.join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-lore-muted">
                      {[spell.concentration && "C", spell.ritual && "R"]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : view === "list" ? (
          <ul className="divide-y divide-lore-border rounded-lg border border-lore-border">
            {spells.map((spell) => (
              <li key={spell.id}>
                <button
                  type="button"
                  onClick={() => onSelectSlug(spell.slug)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-lore-surface"
                >
                  <div>
                    <div className="font-medium">{spell.name}</div>
                    <div className="text-xs capitalize text-lore-muted">
                      {[levelLabel(spell.level), spell.school, spell.classes?.join(", ")]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-lore-muted">
                    {[spell.concentration && "Conc.", spell.ritual && "Ritual"]
                      .filter(Boolean)
                      .join(" ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {spells.map((spell) => (
              <li key={spell.id}>
                <button
                  type="button"
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
                  {spell.classes && spell.classes.length > 0 && (
                    <span className="text-xs text-lore-muted">
                      {spell.classes.join(", ")}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedSlug && (
        <SpellDetail slug={selectedSlug} onClose={() => onSelectSlug(null)} />
      )}
    </div>
  );
}

function SortHeader({
  label,
  indicator,
  onClick,
}: {
  label: string;
  indicator: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-inherit uppercase tracking-wide text-lore-muted hover:text-lore-text"
    >
      {label}
      {indicator}
    </button>
  );
}

function SpellViewToggle({
  view,
  onChange,
}: {
  view: SpellView;
  onChange: (view: SpellView) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-lore-border p-1">
      {(["grid", "list", "table"] as SpellView[]).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`rounded px-3 py-1 text-xs capitalize transition-colors ${
            view === v
              ? "bg-lore-accent-dim text-lore-text"
              : "text-lore-muted hover:text-lore-text"
          }`}
        >
          {v}
        </button>
      ))}
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
