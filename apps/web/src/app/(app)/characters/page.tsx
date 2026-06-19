import Link from "next/link";

import { buildCharacterSheet, FIXTURE_CHARACTERS } from "@app/engine";

function slugFor(id: string): string {
  return id.split(":").pop() ?? id;
}

export default function CharactersPage() {
  const sheets = FIXTURE_CHARACTERS.map((c) => ({
    slug: slugFor(c.id),
    sheet: buildCharacterSheet(c),
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          Characters
        </h1>
        <p className="mt-2 text-lore-muted">
          Read-only sheets on fixture data. Character creation and editing arrive
          in P2.
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sheets.map(({ slug, sheet }) => (
          <li key={slug}>
            <Link
              href={`/characters/${slug}`}
              className="flex h-full flex-col gap-3 rounded-lg border border-lore-border bg-lore-surface p-5 transition-colors hover:border-lore-accent"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-display text-xl">{sheet.name}</span>
                <span className="rounded bg-lore-bg px-2 py-0.5 text-xs text-lore-accent">
                  Lvl {sheet.level}
                </span>
              </div>
              <span className="text-sm text-lore-muted">
                {sheet.species} · {sheet.classLine}
              </span>
              <div className="mt-auto flex gap-4 text-sm text-lore-muted">
                <span>AC {sheet.ac}</span>
                <span>
                  HP {sheet.hp.current}/{sheet.hp.max}
                </span>
                <span>Speed {sheet.speed}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
