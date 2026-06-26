"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { buildCharacterSheet } from "@app/engine";
import type { characters } from "@app/db";

import { trpc } from "@/lib/trpc/client";

type CharacterRow = typeof characters.$inferSelect;

export function CharactersBrowser() {
  const list = trpc.characters.list.useQuery();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"name" | "level">("name");
  const [layout, setLayout] = useState<"grid" | "list">("grid");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = list.data ?? [];
    if (q) {
      rows = rows.filter((c) => {
        const sheet = buildCharacterSheet(c);
        return (
          sheet.name.toLowerCase().includes(q) ||
          sheet.species.toLowerCase().includes(q) ||
          (c.classes as { class: string }[]).some((cl) =>
            cl.class.toLowerCase().includes(q),
          )
        );
      });
    }
    return [...rows].sort((a, b) => {
      const sa = buildCharacterSheet(a);
      const sb = buildCharacterSheet(b);
      if (sort === "level") return sb.level - sa.level || sa.name.localeCompare(sb.name);
      return sa.name.localeCompare(sb.name);
    });
  }, [list.data, search, sort]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-lore-muted">
          {list.isLoading
            ? "Loading…"
            : `${filtered.length} character${filtered.length === 1 ? "" : "s"}`}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search characters…"
            className="rounded border border-lore-border bg-lore-surface px-3 py-1.5 text-sm outline-none focus:border-lore-accent"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "name" | "level")}
            className="rounded border border-lore-border bg-lore-surface px-2 py-1.5 text-sm"
          >
            <option value="name">Name A–Z</option>
            <option value="level">Level (high first)</option>
          </select>
          <div className="flex rounded border border-lore-border text-xs">
            <button
              type="button"
              onClick={() => setLayout("grid")}
              className={`px-2 py-1.5 ${layout === "grid" ? "bg-lore-accent-dim text-lore-text" : "text-lore-muted"}`}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={() => setLayout("list")}
              className={`px-2 py-1.5 ${layout === "list" ? "bg-lore-accent-dim text-lore-text" : "text-lore-muted"}`}
            >
              List
            </button>
          </div>
          <Link
            href="/characters/new"
            className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent"
          >
            New character
          </Link>
        </div>
      </div>

      {!list.isLoading && filtered.length === 0 ? (
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
        <ul
          className={
            layout === "grid"
              ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              : "flex flex-col gap-3"
          }
        >
          {filtered.map((character) => (
            <CharacterCard key={character.id} character={character} layout={layout} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CharacterCard({
  character,
  layout = "grid",
}: {
  character: CharacterRow;
  layout?: "grid" | "list";
}) {
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
    <li
      className={`relative flex h-full flex-col rounded-lg border border-lore-border bg-lore-surface transition-colors hover:border-lore-accent ${
        layout === "list" ? "sm:flex-row sm:items-center" : ""
      }`}
    >
      <Link
        href={`/characters/${character.id}`}
        className={`flex flex-1 flex-col gap-3 p-5 ${layout === "list" ? "sm:flex-row sm:items-center sm:gap-6" : ""}`}
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
