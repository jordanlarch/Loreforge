"use client";

import Link from "next/link";

import {
  EXPLORATION_HAZARDS_OVERVIEW_SLUG,
} from "@/lib/codex-exploration-hazards";
import { codexDetailPath } from "@/lib/codex-routes";
import { trpc } from "@/lib/trpc/client";

export function ExplorationHazardsRulesPanel({
  selectedGlossarySlug,
  onSelectGlossary,
}: {
  selectedGlossarySlug: string | null;
  onSelectGlossary: (slug: string | null) => void;
}) {
  const page = trpc.codex.getExplorationHazardsPage.useQuery();

  if (page.isLoading) {
    return <p className="text-sm text-lore-muted">Loading exploration hazards…</p>;
  }

  if (!page.data?.overview) {
    return (
      <div className="rounded-lg border border-dashed border-lore-border p-10 text-center text-sm text-lore-muted">
        Run `npm run seed:exploration-hazards` in packages/db if exploration
        hazard rules are missing.
      </div>
    );
  }

  const overview = page.data.overview;
  const glossary = page.data.glossary;

  return (
    <section className="space-y-6">
      <article className="rounded-lg border border-lore-border bg-lore-surface p-5">
        <h2 className="font-display text-xl">{overview.name}</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-lore-text">
          {overview.description}
        </p>
      </article>

      <div>
        <p className="mb-4 text-sm text-lore-muted">
          {glossary.length} glossary entr{glossary.length === 1 ? "y" : "ies"}
        </p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {glossary.map((entry) => {
            const active = selectedGlossarySlug === entry.slug;
            return (
              <li key={entry.slug}>
                <button
                  type="button"
                  onClick={() => onSelectGlossary(entry.slug)}
                  className={`flex h-full w-full flex-col gap-2 rounded-lg border bg-lore-surface p-4 text-left transition-colors ${
                    active
                      ? "border-lore-accent"
                      : "border-lore-border hover:border-lore-accent"
                  }`}
                >
                  <span className="font-display text-lg leading-tight">
                    {entry.name}
                  </span>
                  <span className="text-xs text-lore-muted">Rules Glossary</span>
                  {entry.description ? (
                    <span className="line-clamp-3 text-xs text-lore-muted">
                      {entry.description}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="text-xs text-lore-muted">
        <Link
          href={codexDetailPath("Rules", EXPLORATION_HAZARDS_OVERVIEW_SLUG)}
          className="text-lore-accent hover:underline"
        >
          Bookmark this overview
        </Link>
        {" · "}
        Environmental terrain modifiers (Extreme Cold, Thin Ice, …) live under{" "}
        <Link href="/codex/toolbox" className="text-lore-accent hover:underline">
          Gameplay Toolbox → Environmental Effects
        </Link>
        .
      </p>
    </section>
  );
}
