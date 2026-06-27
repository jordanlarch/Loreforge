"use client";

import { useState } from "react";

import { SPELL_LEVELS, SPELL_SCHOOLS, type SpellSchool } from "@app/engine";

import { SmithySpellForm } from "@/components/smithy-spell-form";
import { SmithyLibraryCard } from "@/components/smithy-library-card";
import { trpc } from "@/lib/trpc/client";

import { CopyFromCodexButton } from "./codex-spell-copy";

function levelLabel(level: number): string {
  return level === 0 ? "Cantrip" : `Level ${level}`;
}

export function SpellBrowser() {
  const [levelFilter, setLevelFilter] = useState<number | undefined>();
  const [schoolFilter, setSchoolFilter] = useState<SpellSchool | undefined>();
  const [inscribing, setInscribing] = useState(false);

  const list = trpc.smithy.listSpells.useQuery({
    level: levelFilter,
    school: schoolFilter,
  });

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
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-lore-muted">
            {list.isLoading
              ? "Loading…"
              : `${list.data?.length ?? 0} spell${
                  list.data?.length === 1 ? "" : "s"
                }`}
          </span>
          <div className="flex flex-wrap gap-2">
            <CopyFromCodexButton />
            <button
              onClick={() => setInscribing((f) => !f)}
              className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent"
            >
              {inscribing ? "Cancel" : "+ Inscribe New"}
            </button>
          </div>
        </div>

        {inscribing ? (
          <SmithySpellForm
            mode="create"
            className="mb-8"
            onDone={() => setInscribing(false)}
          />
        ) : null}

        {!list.isLoading && (list.data?.length ?? 0) === 0 && !inscribing ? (
          <div className="rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
            No homebrew spells yet — inscribe your first into the grimoire.
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(list.data ?? []).map((spell) => (
              <li key={spell.id}>
                <SmithyLibraryCard
                  id={spell.id}
                  kind="spell"
                  name={spell.name}
                  href={`/smithy/spells/${spell.id}`}
                  subtitle={`${levelLabel(spell.level)} · ${spell.school}`}
                  source={spell.source}
                  descriptionSnippet={
                    spell.description.trim().slice(0, 120) || null
                  }
                  updatedAt={spell.updatedAt}
                  useOnCharacter
                />
              </li>
            ))}
          </ul>
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
