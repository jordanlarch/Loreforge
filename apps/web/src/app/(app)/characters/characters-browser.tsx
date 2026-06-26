"use client";

import Link from "next/link";
import { useState } from "react";

import { buildCharacterSheet } from "@app/engine";
import type { characters } from "@app/db";

import { trpc } from "@/lib/trpc/client";

type CharacterRow = typeof characters.$inferSelect;

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
          {(list.data ?? []).map((character) => (
            <CharacterCard key={character.id} character={character} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CharacterCard({ character }: { character: CharacterRow }) {
  const utils = trpc.useUtils();
  const [confirming, setConfirming] = useState(false);
  const remove = trpc.characters.delete.useMutation({
    onSuccess: async () => {
      setConfirming(false);
      await utils.characters.list.invalidate();
    },
  });

  const sheet = buildCharacterSheet(character);

  return (
    <li className="relative flex h-full flex-col rounded-lg border border-lore-border bg-lore-surface transition-colors hover:border-lore-accent">
      <Link
        href={`/characters/${character.id}`}
        className="flex flex-1 flex-col gap-3 p-5"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="font-display text-xl">{sheet.name}</span>
          <span className="rounded bg-lore-bg px-2 py-0.5 text-xs text-lore-accent">
            Lvl {sheet.level}
          </span>
        </div>
        <span className="text-sm text-lore-muted">
          {[sheet.species, sheet.classLine].filter(Boolean).join(" · ")}
        </span>
        <div className="mt-auto flex gap-4 text-sm text-lore-muted">
          <span>AC {sheet.ac}</span>
          <span>
            HP {sheet.hp.current}/{sheet.hp.max}
          </span>
          <span>Speed {sheet.speed}</span>
        </div>
      </Link>

      <div className="border-t border-lore-border px-5 py-3">
        {confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-lore-muted">Delete permanently?</span>
            <button
              type="button"
              onClick={() => remove.mutate({ id: character.id })}
              disabled={remove.isPending}
              className="rounded border border-red-500/60 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-40"
            >
              {remove.isPending ? "Deleting…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={remove.isPending}
              className="text-xs text-lore-muted transition-colors hover:text-lore-text"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-xs text-red-300/80 transition-colors hover:text-red-300"
          >
            Delete character
          </button>
        )}
      </div>
    </li>
  );
}
