"use client";

import { TOOLBOX_TOPICS, type ToolboxTopic } from "@app/engine";

import { formatToolboxTopic } from "@/lib/codex-toolbox-display";
import { useCodexSearch } from "@/lib/use-codex-search";
import { useCodexUrlParam } from "@/lib/use-codex-url-params";
import { trpc } from "@/lib/trpc/client";

import { ToolboxEntryDetail } from "./toolbox-entry-detail";

export function ToolboxBrowser({
  selectedSlug,
  onSelect,
}: {
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
}) {
  const [search, setSearch] = useCodexSearch();
  const [topicParam, setTopicParam] = useCodexUrlParam("topic");
  const topic: ToolboxTopic =
    TOOLBOX_TOPICS.find((t) => t === topicParam) ?? "trap";

  const facets = trpc.codex.toolboxFacets.useQuery();
  const rules = trpc.codex.getToolboxTopicRules.useQuery({ topic });
  const list = trpc.codex.listToolboxEntries.useQuery(
    { search: search || undefined, topic },
    { placeholderData: (prev) => prev },
  );

  const items = list.data ?? [];
  const topicOptions =
    (facets.data?.topics.length ?? 0) > 0
      ? facets.data!.topics
      : (["trap"] as ToolboxTopic[]);

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
              placeholder="poison needle, falling net…"
              className="w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent"
            />
          </div>

          <FilterGroup
            title="Topic"
            options={TOOLBOX_TOPICS}
            value={topic}
            render={(v) => formatToolboxTopic(v)}
            onChange={(v) => setTopicParam(v === "trap" ? undefined : v)}
          />
        </aside>

        <section className="space-y-6">
          {rules.data ? (
            <article className="rounded-lg border border-lore-border bg-lore-surface p-5">
              <h2 className="font-display text-xl">{rules.data.name}</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-lore-text">
                {rules.data.description}
              </p>
            </article>
          ) : rules.isLoading ? (
            <p className="text-sm text-lore-muted">Loading rules…</p>
          ) : topic !== "trap" ? (
            <div className="rounded-lg border border-dashed border-lore-border p-6 text-center text-sm text-lore-muted">
              Rules article for {formatToolboxTopic(topic)} coming in a future
              update.
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-lore-border p-6 text-center text-sm text-lore-muted">
              Run `npm run seed:toolbox-traps` in packages/db if trap rules are
              missing.
            </div>
          )}

          <div>
            <p className="mb-4 text-sm text-lore-muted">
              {list.isLoading
                ? "Loading…"
                : `${items.length} sample entr${items.length === 1 ? "y" : "ies"}`}
            </p>

            {!list.isLoading && items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
                {topicOptions.includes(topic)
                  ? "No entries match your search."
                  : `Sample entries for ${formatToolboxTopic(topic)} are not seeded yet.`}
              </div>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((entry) => (
                  <li key={entry.slug}>
                    <button
                      type="button"
                      onClick={() => onSelect(entry.slug)}
                      className="flex h-full w-full flex-col gap-2 rounded-lg border border-lore-border bg-lore-surface p-4 text-left transition-colors hover:border-lore-accent"
                    >
                      <span className="font-display text-lg leading-tight">
                        {entry.name}
                      </span>
                      <span className="text-xs text-lore-muted">
                        {formatToolboxTopic(entry.topic)}
                      </span>
                      {entry.description ? (
                        <span className="line-clamp-2 text-xs text-lore-muted">
                          {entry.description}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {selectedSlug ? (
        <ToolboxEntryDetail
          slug={selectedSlug}
          onClose={() => onSelect(null)}
        />
      ) : null}
    </>
  );
}

function FilterGroup<T extends string>({
  title,
  options,
  value,
  render,
  onChange,
}: {
  title: string;
  options: readonly T[];
  value: T;
  render: (value: T) => string;
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-xs uppercase tracking-wide text-lore-muted">
        {title}
      </div>
      <div className="space-y-1.5">
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
