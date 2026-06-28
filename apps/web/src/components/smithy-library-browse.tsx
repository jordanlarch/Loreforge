"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { formatRelativeTime } from "@/lib/format-relative-time";
import type { SmithyLibraryCategory } from "@/lib/smithy-categories";
import { smithyCategoryLabel } from "@/lib/smithy-categories";
import type {
  SmithyLibrarySortBy,
  SmithyLibrarySortDir,
  SmithyLibraryViewMode,
} from "@/lib/smithy-library-filter";

import { SmithyLibraryCard } from "./smithy-library-card";

export type SmithyLibraryEntry = {
  kind: "item" | "spell" | "toolbox";
  id: string;
  name: string;
  source: "codex" | "original";
  category: SmithyLibraryCategory;
  subtitle: string;
  href: string;
  updatedAt: Date | string;
  descriptionSnippet: string | null;
  rarity?: string | null;
};

export type SmithyBrowseQuery = {
  search?: string;
  source?: "codex" | "original";
  sortBy?: SmithyLibrarySortBy;
  sortDir?: SmithyLibrarySortDir;
};

export function useSmithyBrowseState() {
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<"codex" | "original" | undefined>();
  const [sort, setSort] = useState<
    "updatedAt-desc" | "updatedAt-asc" | "name-asc" | "name-desc"
  >("updatedAt-desc");
  const [view, setView] = useState<SmithyLibraryViewMode>("grid");

  const queryInput = useMemo((): SmithyBrowseQuery => {
    const [sortBy, sortDir] = sort.split("-") as [
      SmithyLibrarySortBy,
      SmithyLibrarySortDir,
    ];
    return {
      search: search.trim() || undefined,
      source,
      sortBy,
      sortDir,
    };
  }, [search, source, sort]);

  return {
    search,
    setSearch,
    source,
    setSource,
    sort,
    setSort,
    view,
    setView,
    queryInput,
  };
}

const SEARCH_INPUT =
  "w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent sm:w-56";
const SELECT =
  "rounded border border-lore-border bg-lore-surface px-2 py-1.5 text-sm text-lore-text";

export function SmithyBrowseToolbar({
  search,
  onSearchChange,
  source,
  onSourceChange,
  sort,
  onSortChange,
  view,
  onViewChange,
  countLabel,
  actions,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  source: "codex" | "original" | undefined;
  onSourceChange: (value: "codex" | "original" | undefined) => void;
  sort: "updatedAt-desc" | "updatedAt-asc" | "name-asc" | "name-desc";
  onSortChange: (
    value: "updatedAt-desc" | "updatedAt-asc" | "name-asc" | "name-desc",
  ) => void;
  view: SmithyLibraryViewMode;
  onViewChange: (view: SmithyLibraryViewMode) => void;
  countLabel: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-lore-muted">{countLabel}</span>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1 sm:max-w-xs">
          <label className="mb-1 block text-xs uppercase tracking-wide text-lore-muted">
            Search
          </label>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search my homebrew…"
            className={SEARCH_INPUT}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-lore-muted">
            Source
          </label>
          <select
            value={source ?? "all"}
            onChange={(e) => {
              const v = e.target.value;
              onSourceChange(
                v === "all" ? undefined : (v as "codex" | "original"),
              );
            }}
            className={SELECT}
          >
            <option value="all">All sources</option>
            <option value="original">Original</option>
            <option value="codex">Copied from Codex</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-lore-muted">
            Sort
          </label>
          <select
            value={sort}
            onChange={(e) =>
              onSortChange(
                e.target.value as
                  | "updatedAt-desc"
                  | "updatedAt-asc"
                  | "name-asc"
                  | "name-desc",
              )
            }
            className={SELECT}
          >
            <option value="updatedAt-desc">Last edited (newest)</option>
            <option value="updatedAt-asc">Last edited (oldest)</option>
            <option value="name-asc">Name (A → Z)</option>
            <option value="name-desc">Name (Z → A)</option>
          </select>
        </div>

        <SmithyViewToggle view={view} onChange={onViewChange} />
      </div>
    </div>
  );
}

function SmithyViewToggle({
  view,
  onChange,
}: {
  view: SmithyLibraryViewMode;
  onChange: (view: SmithyLibraryViewMode) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-xs uppercase tracking-wide text-lore-muted">
        View
      </div>
      <div className="inline-flex rounded-lg border border-lore-border p-1">
        {(["grid", "list", "table"] as SmithyLibraryViewMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            className={`rounded px-3 py-1 text-xs capitalize transition-colors ${
              view === mode
                ? "bg-lore-accent-dim text-lore-text"
                : "text-lore-muted hover:text-lore-text"
            }`}
          >
            {mode}
          </button>
        ))}
      </div>
    </div>
  );
}

function sourceLabel(source: "codex" | "original"): string {
  return source === "codex" ? "Copied" : "Original";
}

export function SmithyLibraryViews({
  entries,
  view,
  emptyMessage,
}: {
  entries: SmithyLibraryEntry[];
  view: SmithyLibraryViewMode;
  emptyMessage: string;
}) {
  const router = useRouter();

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
        {emptyMessage}
      </div>
    );
  }

  if (view === "table") {
    return (
      <div className="overflow-x-auto rounded-lg border border-lore-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-lore-border bg-lore-surface text-xs uppercase tracking-wide text-lore-muted">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Details</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Edited</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={`${entry.kind}-${entry.id}`}
                className="cursor-pointer border-b border-lore-border/60 transition-colors hover:bg-lore-surface/80"
                onClick={() => router.push(entry.href)}
              >
                <td className="px-3 py-2 font-medium">{entry.name}</td>
                <td className="px-3 py-2 capitalize text-lore-muted">
                  {smithyCategoryLabel(entry.category)}
                </td>
                <td className="px-3 py-2 text-lore-muted">{entry.subtitle}</td>
                <td className="px-3 py-2 text-xs text-lore-muted">
                  {sourceLabel(entry.source)}
                </td>
                <td className="px-3 py-2 text-xs text-lore-muted">
                  {formatRelativeTime(entry.updatedAt) || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (view === "list") {
    return (
      <ul className="divide-y divide-lore-border rounded-lg border border-lore-border">
        {entries.map((entry) => (
          <li key={`${entry.kind}-${entry.id}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-lore-surface">
              <Link href={entry.href} className="min-w-0 flex-1">
                <div className="font-medium">{entry.name}</div>
                <div className="text-xs capitalize text-lore-muted">
                  {entry.subtitle}
                  {entry.descriptionSnippet
                    ? ` · ${entry.descriptionSnippet}`
                    : ""}
                </div>
              </Link>
              <div className="flex shrink-0 items-center gap-3 text-xs text-lore-muted">
                <span>{sourceLabel(entry.source)}</span>
                <span>{formatRelativeTime(entry.updatedAt)}</span>
                <Link
                  href={`${entry.href}?edit=1`}
                  className="text-lore-accent hover:underline"
                >
                  Edit
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((entry) => (
        <li key={`${entry.kind}-${entry.id}`}>
          <SmithyLibraryCard
            id={entry.id}
            kind={entry.kind}
            name={entry.name}
            href={entry.href}
            subtitle={entry.subtitle}
            source={entry.source}
            descriptionSnippet={entry.descriptionSnippet}
            updatedAt={entry.updatedAt}
            useOnCharacter={
              entry.kind === "spell" || entry.category === "Items"
            }
            rarity={entry.rarity}
          />
        </li>
      ))}
    </ul>
  );
}

/** Map a spell list row to a unified library entry for shared views. */
export function spellRowToLibraryEntry(spell: {
  id: string;
  name: string;
  level: number;
  school: string;
  source: "codex" | "original";
  updatedAt: Date | string;
  description: string;
}): SmithyLibraryEntry {
  return {
    kind: "spell",
    id: spell.id,
    name: spell.name,
    source: spell.source,
    category: "Spells",
    subtitle: `${spell.level === 0 ? "Cantrip" : `Level ${spell.level}`} · ${spell.school}`,
    href: `/smithy/spells/${spell.id}`,
    updatedAt: spell.updatedAt,
    descriptionSnippet: spell.description.trim().slice(0, 120) || null,
  };
}
