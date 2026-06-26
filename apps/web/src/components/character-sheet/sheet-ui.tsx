"use client";

import { useMemo, useState, type ReactNode } from "react";

/** Roll20-style collapsible section header with optional add action. */
export function SheetSection({
  title,
  weight,
  onAdd,
  children,
  defaultOpen = true,
}: {
  title: string;
  weight?: string;
  onAdd?: () => void;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-lg border border-lore-border bg-lore-surface">
      <header className="flex items-center gap-2 border-b border-lore-border px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="text-lore-muted" aria-hidden>
            {open ? "▾" : "▸"}
          </span>
          <span className="font-display text-xs uppercase tracking-widest text-lore-accent">
            {title}
          </span>
          {weight && (
            <span className="ml-auto text-xs text-lore-muted">{weight}</span>
          )}
        </button>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            aria-label={`Add to ${title}`}
            className="rounded px-2 py-0.5 text-sm text-lore-muted hover:bg-lore-bg hover:text-lore-text"
          >
            +
          </button>
        )}
      </header>
      {open && <div className="p-3">{children}</div>}
    </section>
  );
}

export function SheetSearchBar({
  value,
  onChange,
  filter,
  onFilterChange,
  filterOptions = ["All"],
}: {
  value: string;
  onChange: (v: string) => void;
  filter?: string;
  onFilterChange?: (v: string) => void;
  filterOptions?: string[];
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lore-muted">
          🔍
        </span>
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search…"
          className="w-full rounded border border-lore-border bg-lore-bg py-2 pl-9 pr-3 text-sm outline-none focus:border-lore-accent"
        />
      </div>
      {onFilterChange && (
        <select
          value={filter ?? "All"}
          onChange={(e) => onFilterChange(e.target.value)}
          className="rounded border border-lore-border bg-lore-bg px-3 py-2 text-sm"
        >
          {filterOptions.map((o) => (
            <option key={o} value={o}>
              Show: {o}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

export function SheetTag({
  label,
  title,
  onRemove,
}: {
  label: string;
  title?: string;
  onRemove?: () => void;
}) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 rounded-full border border-lore-border bg-lore-bg px-2.5 py-0.5 text-xs text-lore-text"
    >
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-lore-muted hover:text-red-400"
          aria-label={`Remove ${label}`}
        >
          ×
        </button>
      )}
    </span>
  );
}

/** Limited-use resource checkboxes (Action Surge, Fighting Spirit, etc.). */
export function ResourceBoxes({
  total,
  used,
  onToggle,
  color = "red",
}: {
  total: number;
  used: boolean[];
  onToggle: (index: number) => void;
  color?: "red" | "gold";
}) {
  return (
    <span className="inline-flex gap-1">
      {Array.from({ length: total }, (_, i) => {
        const spent = used[i] ?? false;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onToggle(i)}
            aria-label={spent ? "Mark available" : "Mark used"}
            className={`h-3.5 w-3.5 rounded-sm border ${
              spent
                ? color === "red"
                  ? "border-red-500 bg-red-500/80"
                  : "border-lore-accent bg-lore-accent"
                : "border-lore-muted bg-transparent"
            }`}
          />
        );
      })}
    </span>
  );
}

export function SheetRowActions({
  onExpand,
  expanded,
}: {
  onExpand?: () => void;
  expanded?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {onExpand && (
        <button
          type="button"
          onClick={onExpand}
          className="rounded p-1 text-lore-muted hover:bg-lore-bg hover:text-lore-text"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? "▴" : "▾"}
        </button>
      )}
    </div>
  );
}

export function SheetTableHeader({
  columns,
}: {
  columns: { label: string; className?: string }[];
}) {
  return (
    <div className="mb-1 grid gap-2 border-b border-lore-border/60 pb-1 text-[10px] uppercase tracking-widest text-lore-muted">
      {columns.map((col) => (
        <span key={col.label} className={col.className}>
          {col.label}
        </span>
      ))}
    </div>
  );
}

/** Client-side search filter hook for tab lists. */
export function useSheetSearch<T>(
  items: T[],
  query: string,
  accessor: (item: T) => string,
): T[] {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => accessor(item).toLowerCase().includes(q));
  }, [items, query, accessor]);
}

export function StubBanner({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 rounded border border-dashed border-lore-border bg-lore-bg/50 px-3 py-2 text-xs text-lore-muted">
      {children}
    </p>
  );
}
