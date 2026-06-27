"use client";

import { formatAdvancedTopic } from "@/lib/codex-advanced-display";
import { useCodexSearch } from "@/lib/use-codex-search";
import { useCodexUrlParam } from "@/lib/use-codex-url-params";
import { trpc } from "@/lib/trpc/client";

import { AdvancedDetail } from "./advanced-detail";

export function AdvancedBrowser({
  selectedSlug,
  onSelect,
}: {
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
}) {
  const [search, setSearch] = useCodexSearch();
  const [topic, setTopic] = useCodexUrlParam("topic");

  const facets = trpc.codex.advancedFacets.useQuery();
  const list = trpc.codex.listAdvancedRules.useQuery(
    { search: search || undefined, topic },
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
              placeholder="trap, poison, madness…"
              className="w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent"
            />
          </div>

          {(facets.data?.topics.length ?? 0) > 0 && (
            <FilterGroup
              title="Topic"
              options={facets.data!.topics}
              value={topic}
              render={(v) => formatAdvancedTopic(v)}
              onChange={setTopic}
            />
          )}
        </aside>

        <section>
          <p className="mb-4 text-sm text-lore-muted">
            {list.isLoading
              ? "Loading…"
              : `${items.length} rule${items.length === 1 ? "" : "s"}`}
          </p>

          {!list.isLoading && items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
              No advanced rules match. Run `npm run ingest:open5e-advanced-rules`
              in packages/db if the table is empty.
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((rule) => (
                <li key={rule.slug}>
                  <button
                    type="button"
                    onClick={() => onSelect(rule.slug)}
                    className="flex h-full w-full flex-col gap-2 rounded-lg border border-lore-border bg-lore-surface p-4 text-left transition-colors hover:border-lore-accent"
                  >
                    <span className="font-display text-lg leading-tight">
                      {rule.name}
                    </span>
                    <span className="text-xs text-lore-muted">
                      {formatAdvancedTopic(rule.topic)}
                    </span>
                    {rule.description ? (
                      <span className="line-clamp-2 text-xs text-lore-muted">
                        {rule.description}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {selectedSlug ? (
        <AdvancedDetail slug={selectedSlug} onClose={() => onSelect(null)} />
      ) : null}
    </>
  );
}

function FilterGroup({
  title,
  options,
  value,
  render,
  onChange,
}: {
  title: string;
  options: string[];
  value: string | undefined;
  render: (value: string) => string;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-xs uppercase tracking-wide text-lore-muted">
        {title}
      </div>
      <div className="space-y-1.5">
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
      className={`block w-full rounded border px-2.5 py-1 text-left text-sm transition-colors ${
        active
          ? "border-lore-accent bg-lore-accent-dim text-lore-text"
          : "border-lore-border text-lore-muted hover:text-lore-text"
      }`}
    >
      {children}
    </button>
  );
}
