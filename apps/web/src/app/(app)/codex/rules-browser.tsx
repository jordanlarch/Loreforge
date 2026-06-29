"use client";

import { useMemo, useState } from "react";

import {
  EXPLORATION_HAZARDS_OVERVIEW_SLUG,
  isExplorationHazardsContextSlug,
  isExplorationHazardGlossarySlug,
} from "@/lib/codex-exploration-hazards";
import { useCodexSearch } from "@/lib/use-codex-search";
import { trpc } from "@/lib/trpc/client";

import { ExplorationHazardsRulesPanel } from "./exploration-hazards-rules-panel";
import { RuleDetail } from "./rule-detail";

export function RulesBrowser({
  selectedSlug,
  onSelect,
}: {
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
}) {
  const [search, setSearch] = useCodexSearch();
  const [chapterSlug, setChapterSlug] = useState<string | undefined>();

  const chapters = trpc.codex.listRuleChapters.useQuery();
  const sections = trpc.codex.listRuleSections.useQuery(
    { chapterSlug, search: search || undefined },
    {
      placeholderData: (prev) => prev,
      enabled: !isExplorationHazardsContextSlug(selectedSlug),
    },
  );

  const chapterNameBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const chapter of chapters.data ?? []) {
      map.set(chapter.slug, chapter.name);
    }
    return map;
  }, [chapters.data]);

  const items = sections.data ?? [];
  const showExplorationHazards =
    selectedSlug === EXPLORATION_HAZARDS_OVERVIEW_SLUG ||
    (selectedSlug != null && isExplorationHazardGlossarySlug(selectedSlug));

  const glossaryDetailSlug =
    selectedSlug && isExplorationHazardGlossarySlug(selectedSlug)
      ? selectedSlug
      : null;

  return (
    <>
      {showExplorationHazards ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="rounded border border-lore-border px-3 py-1.5 text-sm text-lore-muted transition-colors hover:border-lore-accent hover:text-lore-text"
            >
              ← All rules
            </button>
          </div>
          <ExplorationHazardsRulesPanel
            selectedGlossarySlug={glossaryDetailSlug}
            onSelectGlossary={onSelect}
          />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          <aside className="space-y-6">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-lore-muted">
                Search
              </label>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="initiative, concentration…"
                className="w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent"
              />
            </div>

            <nav aria-label="Rule chapters">
              <div className="mb-2 text-xs uppercase tracking-wide text-lore-muted">
                Chapters
              </div>
              <ul className="space-y-1">
                <li>
                  <ChapterButton
                    active={chapterSlug === undefined}
                    onClick={() => setChapterSlug(undefined)}
                  >
                    All chapters
                  </ChapterButton>
                </li>
                {(chapters.data ?? []).map((chapter) => (
                  <li key={chapter.slug}>
                    <ChapterButton
                      active={chapterSlug === chapter.slug}
                      onClick={() => setChapterSlug(chapter.slug)}
                    >
                      {chapter.name}
                    </ChapterButton>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          <section>
            <p className="mb-4 text-sm text-lore-muted">
              {sections.isLoading
                ? "Loading…"
                : `${items.length} section${items.length === 1 ? "" : "s"}`}
            </p>

            {!sections.isLoading && items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
                No rules match. Run `npm run ingest:open5e-rules` in packages/db
                if the tables are empty.
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((section) => (
                  <li key={section.slug}>
                    <button
                      type="button"
                      onClick={() => onSelect(section.slug)}
                      className="flex w-full flex-col gap-1 rounded-lg border border-lore-border bg-lore-surface px-4 py-3 text-left transition-colors hover:border-lore-accent"
                    >
                      <span className="font-display text-base leading-tight">
                        {section.name}
                      </span>
                      {!chapterSlug && (
                        <span className="text-xs text-lore-muted">
                          {chapterNameBySlug.get(section.chapterSlug) ??
                            section.chapterSlug}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {glossaryDetailSlug ? (
        <RuleDetail slug={glossaryDetailSlug} onClose={() => onSelect(EXPLORATION_HAZARDS_OVERVIEW_SLUG)} />
      ) : selectedSlug && !showExplorationHazards ? (
        <RuleDetail slug={selectedSlug} onClose={() => onSelect(null)} />
      ) : null}
    </>
  );
}

function ChapterButton({
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
      className={`w-full rounded px-2 py-1.5 text-left text-sm transition-colors ${
        active
          ? "bg-lore-accent-dim text-lore-text"
          : "text-lore-muted hover:bg-lore-surface hover:text-lore-text"
      }`}
    >
      {children}
    </button>
  );
}
