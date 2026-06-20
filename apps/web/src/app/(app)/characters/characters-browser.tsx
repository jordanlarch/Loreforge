"use client";

import Link from "next/link";

import { buildCharacterSheet } from "@app/engine";

import { trpc } from "@/lib/trpc/client";

export function CharactersBrowser() {
  const list = trpc.characters.list.useQuery();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <span className="text-sm text-lore-muted">
          {list.isLoading
            ? "Loading…"
            : `${list.data?.length ?? 0} character${
                list.data?.length === 1 ? "" : "s"
              }`}
        </span>
        <Link
          href="/characters/new"
          className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent"
        >
          New character
        </Link>
      </div>

      {!list.isLoading && (list.data?.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
          No characters yet.{" "}
          <Link
            href="/characters/new"
            className="text-lore-accent hover:underline"
          >
            Create your first one
          </Link>{" "}
          to get started.
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(list.data ?? []).map((character) => {
            const sheet = buildCharacterSheet(character);
            return (
              <li key={character.id}>
                <Link
                  href={`/characters/${character.id}`}
                  className="flex h-full flex-col gap-3 rounded-lg border border-lore-border bg-lore-surface p-5 transition-colors hover:border-lore-accent"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-display text-xl">{sheet.name}</span>
                    <span className="rounded bg-lore-bg px-2 py-0.5 text-xs text-lore-accent">
                      Lvl {sheet.level}
                    </span>
                  </div>
                  <span className="text-sm text-lore-muted">
                    {[sheet.species, sheet.classLine]
                      .filter(Boolean)
                      .join(" · ")}
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
            );
          })}
        </ul>
      )}
    </div>
  );
}
