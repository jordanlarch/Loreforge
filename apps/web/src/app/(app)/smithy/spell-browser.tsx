"use client";

import { useMemo, useState } from "react";

import { SPELL_LEVELS, SPELL_SCHOOLS, type SpellSchool } from "@app/engine";

import {
  SmithyBrowseToolbar,
  SmithyLibraryViews,
  spellRowToLibraryEntry,
  useSmithyBrowseState,
} from "@/components/smithy-library-browse";
import { SmithySpellForm } from "@/components/smithy-spell-form";
import { trpc } from "@/lib/trpc/client";

import { CopyFromCodexButton } from "./codex-spell-copy";

export function SpellBrowser() {
  const [levelFilter, setLevelFilter] = useState<number | undefined>();
  const [schoolFilter, setSchoolFilter] = useState<SpellSchool | undefined>();
  const [inscribing, setInscribing] = useState(false);
  const browse = useSmithyBrowseState();

  const list = trpc.smithy.listSpells.useQuery({
    level: levelFilter,
    school: schoolFilter,
    ...browse.queryInput,
  });

  const entries = useMemo(
    () => (list.data ?? []).map(spellRowToLibraryEntry),
    [list.data],
  );

  const countLabel = list.isLoading
    ? "Loading…"
    : `${entries.length} spell${entries.length === 1 ? "" : "s"}`;

  return (
    <div className="grid gap-6 md:grid-cols-[200px_1fr]">
      <aside className="space-y-4">
        <div>
          <div className="mb-2 text-xs uppercase tracking-wide text-lore-muted">
            Level
          </div>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              active={levelFilter === undefined}
              onClick={() => setLevelFilter(undefined)}
            >
              All
            </FilterChip>
            {SPELL_LEVELS.map((l) => (
              <FilterChip
                key={l}
                active={levelFilter === l}
                onClick={() => setLevelFilter(l)}
              >
                {l === 0 ? "C" : l}
              </FilterChip>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs uppercase tracking-wide text-lore-muted">
            School
          </div>
          <div className="space-y-1.5">
            <FilterChip
              active={schoolFilter === undefined}
              onClick={() => setSchoolFilter(undefined)}
              block
            >
              All
            </FilterChip>
            {SPELL_SCHOOLS.map((s) => (
              <FilterChip
                key={s}
                active={schoolFilter === s}
                onClick={() => setSchoolFilter(s)}
                block
              >
                <span className="capitalize">{s}</span>
              </FilterChip>
            ))}
          </div>
        </div>
      </aside>

      <section>
        <SmithyBrowseToolbar
          search={browse.search}
          onSearchChange={browse.setSearch}
          source={browse.source}
          onSourceChange={browse.setSource}
          sort={browse.sort}
          onSortChange={browse.setSort}
          view={browse.view}
          onViewChange={browse.setView}
          countLabel={countLabel}
          actions={
            <>
              <CopyFromCodexButton />
              <button
                onClick={() => setInscribing((f) => !f)}
                className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent"
              >
                {inscribing ? "Cancel" : "+ Inscribe New"}
              </button>
            </>
          }
        />

        {inscribing ? (
          <SmithySpellForm
            mode="create"
            className="mb-8"
            onDone={() => setInscribing(false)}
          />
        ) : null}

        {!list.isLoading && entries.length === 0 && !inscribing ? (
          <SmithyLibraryViews
            entries={[]}
            view={browse.view}
            emptyMessage={
              browse.search || browse.source || levelFilter != null || schoolFilter
                ? "No spells match these filters."
                : "No homebrew spells yet — inscribe your first into the grimoire."
            }
          />
        ) : (
          <SmithyLibraryViews
            entries={entries}
            view={browse.view}
            emptyMessage="No spells match these filters."
          />
        )}
      </section>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  block = false,
  children,
}: {
  active: boolean;
  onClick: () => void;
  block?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded border px-2.5 py-1 text-sm transition-colors ${
        block ? "block w-full text-left" : ""
      } ${
        active
          ? "border-lore-accent bg-lore-accent-dim text-lore-text"
          : "border-lore-border text-lore-muted hover:text-lore-text"
      }`}
    >
      {children}
    </button>
  );
}
